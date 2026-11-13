import * as THREE from 'three';
import { levelBand } from '../domain/config';

// The athletic 3D body: original, made in code, no model files.
//
// One smooth skin surface (lathe-turned torso and limbs) carries the muscle
// shapes itself: pecs, a six-pack, obliques, lat flare, erector ridges, glutes,
// deltoids, biceps/triceps, forearms, a quad sweep and teardrop, hamstrings and
// two-headed calves are sculpted into it as smooth bumps. Each vertex belongs to
// a sub-area (or bare skin / shorts) and is painted that area's health colour,
// with a darker line where muscles meet, like an anatomy app.
//
// Muscles grow with level: each area's bumps get fuller and the region swells
// slightly (up to ~20% more definition at 100). Mobility shows as beads and
// Cardio as a heart; both are snapped onto the surface so nothing floats.
// Units are metres; feet at y = 0, facing +z.

const SKIN = new THREE.Color(0xd2a17c);
const SHORTS = new THREE.Color(0x272c30);
const WHITE = new THREE.Color(0xffffff);
const RED = new THREE.Color(0xd1495b);
const HAIR = 0x3d281d;
const SHOE = 0x2fb3a1;
const SOLE = 0xf2f2f2;

const AREA_IDS = [
  'chest', 'shoulders', 'abs', 'obliques', 'lats', 'spinalStabilisers', 'lowerBack',
  'glutes', 'arms', 'quads', 'hamstrings', 'calves',
] as const;
const AREA_INDEX = new Map<string, number>(AREA_IDS.map((a, i) => [a, i]));
const SKIN_ID = -1;
const SHORTS_ID = -2;

export interface BodyStyle {
  levels: Record<string, number>;
  cardioLevel: number;
  selected: string | null;
  pinned: Set<string>;
  injured: Set<string>;
  accent: string;
}

export interface BodyModel {
  figure: THREE.Group;
  setStyle: (s: BodyStyle) => void;
  /** Advance animations (growth easing, heartbeat, injury pulse). */
  tick: (now: number, dt: number, reducedMotion: boolean) => void;
  /** The area under a raycast hit, if it's a muscle, mobility bead or the heart. */
  pick: (hit: THREE.Intersection) => string | undefined;
  dispose: () => void;
}

type V3 = [number, number, number];
const g1 = (d: number, s: number) => Math.exp(-(d * d) / (2 * s * s));
const g2 = (dx: number, dy: number, sx: number, sy: number) => Math.exp(-((dx * dx) / (2 * sx * sx) + (dy * dy) / (2 * sy * sy)));
const clamp01 = (v: number) => Math.max(0, Math.min(1, v));
/** Smallest signed angle difference. */
const dAng = (a: number, b: number) => Math.atan2(Math.sin(a - b), Math.cos(a - b));

// --- skin parts --------------------------------------------------------------------

interface SkinPart {
  mesh: THREE.Mesh;
  geo: THREE.BufferGeometry;
  base: Float32Array;
  /** Horizontal outward direction per vertex (seam-safe). */
  dir: Float32Array;
  area: Int16Array;
  bump: Float32Array;
  edge: Uint8Array;
  /** Which areas this part contains (for selective updates). */
  areas: Set<number>;
}

/**
 * A lathe-turned body part. `classify` assigns each vertex to an area (in the
 * part's own coordinates), and `bump` sculpts muscle shape (metres, outward).
 */
function skinPart(
  points: [number, number][],
  opts: {
    sz?: (y: number) => number;
    samples?: number;
    segments?: number;
    classify: (x: number, y: number, z: number) => number;
    bump: (x: number, y: number, z: number) => number;
  },
  material: THREE.Material,
): SkinPart {
  // Profiles must run bottom → top or the lathe's faces point inwards.
  const ordered = points[0][1] > points[points.length - 1][1] ? [...points].reverse() : points;
  const curve = new THREE.SplineCurve(ordered.map(([r, y]) => new THREE.Vector2(r, y)));
  // Seam at the back (phiStart = π), under the spine beads.
  const geo = new THREE.LatheGeometry(curve.getPoints(opts.samples ?? 64), opts.segments ?? 40, Math.PI, Math.PI * 2);
  const pos = geo.attributes.position as THREE.BufferAttribute;
  const n = pos.count;
  const base = new Float32Array(n * 3);
  const dir = new Float32Array(n * 3);
  const area = new Int16Array(n);
  const bump = new Float32Array(n);
  const areas = new Set<number>();
  for (let i = 0; i < n; i++) {
    const y = pos.getY(i);
    const x = pos.getX(i);
    const z = pos.getZ(i) * (opts.sz?.(y) ?? 1);
    base[i * 3] = x;
    base[i * 3 + 1] = y;
    base[i * 3 + 2] = z;
    const len = Math.hypot(x, z);
    dir[i * 3] = len > 1e-6 ? x / len : 0;
    dir[i * 3 + 2] = len > 1e-6 ? z / len : 0;
    area[i] = opts.classify(x, y, z);
    bump[i] = opts.bump(x, y, z);
    if (area[i] >= 0) areas.add(area[i]);
  }
  // Mark vertices on a boundary between regions, for the separation lines.
  const edge = new Uint8Array(n);
  const index = geo.index!;
  for (let t = 0; t < index.count; t += 3) {
    const a = index.getX(t), b = index.getX(t + 1), c = index.getX(t + 2);
    if (area[a] !== area[b] || area[b] !== area[c]) {
      for (const v of [a, b, c]) if (area[v] >= 0) edge[v] = 1;
    }
  }
  geo.setAttribute('color', new THREE.BufferAttribute(new Float32Array(n * 3), 3));
  const mesh = new THREE.Mesh(geo, material);
  return { mesh, geo, base, dir, area, bump, edge, areas };
}

/** Bump amplitude multiplier for an area at a level, and extra swelling (m). */
const growth = (level: number) => {
  const l = clamp01(level / 100);
  return { amp: 0.55 + 0.9 * l, swell: 0.004 * l };
};

function applyShape(p: SkinPart, shown: Float32Array) {
  const pos = p.geo.attributes.position as THREE.BufferAttribute;
  const arr = pos.array as Float32Array;
  for (let i = 0; i < p.area.length; i++) {
    const a = p.area[i];
    let d = p.bump[i];
    if (a >= 0) {
      const g = growth(shown[a]);
      d = d * g.amp + g.swell;
    }
    arr[i * 3] = p.base[i * 3] + p.dir[i * 3] * d;
    arr[i * 3 + 1] = p.base[i * 3 + 1];
    arr[i * 3 + 2] = p.base[i * 3 + 2] + p.dir[i * 3 + 2] * d;
  }
  pos.needsUpdate = true;
  p.geo.computeVertexNormals();
  p.geo.computeBoundingSphere();
}

function applyColours(p: SkinPart, areaColour: THREE.Color[]) {
  const col = p.geo.attributes.color as THREE.BufferAttribute;
  const arr = col.array as Float32Array;
  for (let i = 0; i < p.area.length; i++) {
    const a = p.area[i];
    const c = a === SKIN_ID ? SKIN : a === SHORTS_ID ? SHORTS : areaColour[a];
    // Muscle bellies catch the light; the gaps between them and region edges are darker.
    const k = a >= 0 ? (p.edge[i] ? 0.6 : 0.78 + 0.22 * clamp01(p.bump[i] / 0.016)) : 1;
    arr[i * 3] = c.r * k;
    arr[i * 3 + 1] = c.g * k;
    arr[i * 3 + 2] = c.b * k;
  }
  col.needsUpdate = true;
}

// --- the body ------------------------------------------------------------------------

export function buildBody(): BodyModel {
  const figure = new THREE.Group();
  const geometries: THREE.BufferGeometry[] = [];
  const materials: THREE.Material[] = [];
  const skinParts: SkinPart[] = [];

  const skinMat = new THREE.MeshPhysicalMaterial({ vertexColors: true, roughness: 0.52, sheen: 0.3, sheenRoughness: 0.6, sheenColor: new THREE.Color(0xffe2cc), clearcoat: 0.08 });
  const plainSkin = new THREE.MeshPhysicalMaterial({ color: SKIN, roughness: 0.6, sheen: 0.3, sheenColor: new THREE.Color(0xffe2cc) });
  const hairMat = new THREE.MeshStandardMaterial({ color: HAIR, roughness: 0.85 });
  const shoeMat = new THREE.MeshStandardMaterial({ color: SHOE, roughness: 0.55 });
  const soleMat = new THREE.MeshStandardMaterial({ color: SOLE, roughness: 0.7 });
  materials.push(skinMat, plainSkin, hairMat, shoeMat, soleMat);

  const addSkin = (parent: THREE.Object3D, part: SkinPart) => {
    parent.add(part.mesh);
    part.mesh.userData.skinPart = skinParts.length;
    skinParts.push(part);
    geometries.push(part.geo);
    return part;
  };
  const addMesh = (parent: THREE.Object3D, geo: THREE.BufferGeometry, mat: THREE.Material, pos: V3, scale?: V3, rot?: V3) => {
    geometries.push(geo);
    const m = new THREE.Mesh(geo, mat);
    m.position.set(...pos);
    if (scale) m.scale.set(...scale);
    if (rot) m.rotation.set(...rot);
    parent.add(m);
    return m;
  };
  const A = (id: (typeof AREA_IDS)[number]) => AREA_INDEX.get(id)!;

  // ===========================================================================
  // Torso: V-taper, narrow waist, broad shoulders, sculpted front and back.
  // ===========================================================================
  const torsoDepth = (y: number) => (y < 1.0 ? 0.76 : y < 1.2 ? 0.76 - ((y - 1.0) / 0.2) * 0.12 : 0.64 - Math.min(0.06, (y - 1.2) * 0.25));
  addSkin(
    figure,
    skinPart(
      [
        [0.0, 0.83], [0.11, 0.845], [0.152, 0.9], [0.152, 0.96], [0.138, 1.03], [0.137, 1.09],
        [0.15, 1.17], [0.17, 1.25], [0.185, 1.32], [0.188, 1.355], [0.172, 1.395], [0.14, 1.432], [0.095, 1.466], [0.06, 1.49], [0.0, 1.5],
      ],
      {
        sz: torsoDepth,
        samples: 200,
        segments: 128,
        classify: (x, y, z) => {
          const ax = Math.abs(x);
          const f = Math.cos(Math.atan2(x, z)); // 1 front, −1 back
          if (y > 1.335 && ax > 0.15) return A('shoulders');
          if (f > 0.15) {
            const pec = ((ax - 0.088) / 0.088) ** 2 + ((y - 1.305) / 0.062) ** 2;
            if (pec < 1 && ax > 0.01) return A('chest');
            if (y >= 0.965 && y < 1.215) return ax < 0.006 ? SKIN_ID : ax < 0.058 ? A('abs') : A('obliques');
            if (y < 0.965) return SHORTS_ID;
            return SKIN_ID;
          }
          if (f < -0.15) {
            if (y > 1.3 && ax < 0.13) {
              if (ax <= 0.052 && y <= 1.43) return A('spinalStabilisers');
              return SKIN_ID; // traps / upper back
            }
            if (y >= 1.08 && y <= 1.4 && ax > 0.052) return A('lats');
            if (y >= 1.04 && y <= 1.43 && ax <= 0.052) return A('spinalStabilisers');
            if (y >= 0.955 && y < 1.1 && ax < 0.1) return A('lowerBack');
            if (y >= 0.955 && y < 1.1) return A('obliques');
            if (y < 0.955 && y > 0.84) return A('glutes');
            return SKIN_ID;
          }
          if (y >= 0.965 && y < 1.235) return A('obliques');
          if (y >= 1.235 && y <= 1.38) return A('lats');
          if (y < 0.965) return SHORTS_ID;
          return SKIN_ID;
        },
        bump: (x, y, z) => 1.35 * torsoBump(x, y, z),
      },
      skinMat,
    ),
  );
  function torsoBump(x: number, y: number, z: number) {
          const ax = Math.abs(x);
          const th = Math.atan2(x, z);
          const f = Math.cos(th);
          const front = clamp01(f * 1.4);
          const back = clamp01(-f * 1.4);
          const sideF = Math.abs(Math.sin(th));
          let b = 0;
          b += 0.021 * g2(ax - 0.085, y - 1.312, 0.05, 0.03) * front * (y < 1.29 ? 1 + (1.29 - y) * 8 : 1); // pecs, fuller lower edge
          for (const y0 of [1.172, 1.106, 1.04]) b += 0.0085 * g2(ax - 0.031, y - y0, 0.015, 0.016) * clamp01(f * 2 - 1); // six-pack
          b += 0.005 * g2(ax, y - 0.985, 0.03, 0.017) * front; // lower abs
          b += 0.006 * g2(ax - 0.128, y - 1.08, 0.022, 0.055) * sideF; // obliques
          b += 0.022 * g2(ax - 0.125, y - 1.24, 0.045, 0.075) * clamp01(back + 0.35 * sideF); // lat flare
          b += 0.009 * g2(ax - 0.03, y - 1.17, 0.013, 0.11) * back; // erectors
          b += 0.004 * g2(ax, y - 1.0, 0.05, 0.03) * back; // lower back
          b += 0.021 * g2(ax - 0.07, y - 0.9, 0.05, 0.045) * clamp01(back * 1.3); // glutes
          b += 0.012 * g2(ax - 0.178, y - 1.39, 0.03, 0.03); // deltoid top
          b += 0.012 * g2(ax - 0.075, y - 1.445, 0.05, 0.028) * clamp01(back + 0.3); // traps
          return b;
  }

  // Neck and head (plain skin). Faceless by design, with a tapered chin.
  addMesh(figure, new THREE.CylinderGeometry(0.052, 0.06, 0.12, 28), plainSkin, [0, 1.53, 0.004]);
  const headGeo = new THREE.SphereGeometry(0.094, 40, 28);
  {
    const p = headGeo.attributes.position as THREE.BufferAttribute;
    for (let i = 0; i < p.count; i++) {
      const y = p.getY(i) / 0.094;
      if (y < 0) {
        p.setX(i, p.getX(i) * (1 + y * 0.22));
        p.setZ(i, p.getZ(i) * (1 + y * 0.08) + -y * 0.008);
      }
    }
    headGeo.computeVertexNormals();
  }
  addMesh(figure, headGeo, plainSkin, [0, 1.668, 0.006], [0.95, 1.18, 1.04]);
  for (const s of [1, -1]) addMesh(figure, new THREE.SphereGeometry(0.019, 16, 12), plainSkin, [0.09 * s, 1.67, -0.004], [0.55, 1.1, 0.9]);
  addMesh(figure, new THREE.SphereGeometry(0.1, 40, 20, 0, Math.PI * 2, 0, Math.PI * 0.5), hairMat, [0, 1.69, -0.008], [0.97, 1.06, 1.07], [-0.34, 0, 0]);
  addMesh(figure, new THREE.SphereGeometry(0.03, 20, 14), hairMat, [0.01, 1.786, 0.038], [1.4, 0.55, 1], [0.4, 0, 0.3]);

  // ===========================================================================
  // Arms and legs (built per side so geometry stays correctly oriented).
  // ===========================================================================
  for (const s of [1, -1]) {
    // --- arm, hanging from the shoulder joint, angled ~10° out
    const arm = new THREE.Group();
    arm.position.set(0.178 * s, 1.392, 0);
    arm.rotation.z = 0.17 * s;
    figure.add(arm);
    const armTheta = (x: number, z: number) => Math.atan2(x * s, z); // 0 front, +π/2 outside
    addSkin(
      arm,
      skinPart(
        [[0.0, 0.05], [0.04, 0.035], [0.056, 0.0], [0.058, -0.055], [0.05, -0.13], [0.046, -0.2], [0.04, -0.27], [0.037, -0.3], [0.044, -0.35], [0.042, -0.42], [0.033, -0.5], [0.027, -0.55], [0.0, -0.56]],
        {
          sz: () => 0.94,
          samples: 150,
          segments: 56,
          classify: (_x, y) => (y > -0.075 ? A('shoulders') : y > -0.285 ? A('arms') : y > -0.315 ? SKIN_ID : y > -0.535 ? A('arms') : SKIN_ID),
          bump: (x, y, z) => {
            const th = armTheta(x, z);
            const f = Math.cos(th);
            let b = 0;
            b += 0.016 * g1(y + 0.015, 0.04) * (0.55 + 0.45 * clamp01(Math.sin(th))); // deltoid
            b += 0.013 * g1(y + 0.145, 0.045) * clamp01(f); // biceps
            b += 0.011 * g1(y + 0.13, 0.05) * clamp01(-f); // triceps
            b += 0.009 * g1(y + 0.37, 0.04) * clamp01(0.5 + 0.5 * f + 0.3 * Math.sin(th)); // forearm
            return 1.6 * b;
          },
        },
        skinMat,
      ),
    );
    addMesh(arm, new THREE.SphereGeometry(0.034, 20, 16), plainSkin, [0, -0.6, 0.004], [0.8, 1.3, 0.55]);

    // --- leg, from the hip joint
    const leg = new THREE.Group();
    leg.position.set(0.085 * s, 0.86, 0);
    leg.rotation.z = 0.025 * s;
    figure.add(leg);
    const legTheta = (x: number, z: number) => Math.atan2(x * s, z);
    addSkin(
      leg,
      skinPart(
        [[0.0, 0.03], [0.089, 0.0], [0.091, -0.07], [0.083, -0.18], [0.071, -0.3], [0.055, -0.39], [0.05, -0.42], [0.052, -0.48], [0.055, -0.54], [0.045, -0.64], [0.032, -0.75], [0.03, -0.79], [0.0, -0.8]],
        {
          sz: () => 0.96,
          samples: 200,
          segments: 64,
          classify: (x, y, z) => {
            const th = legTheta(x, z);
            if (y > -0.075) return SHORTS_ID;
            if (y > -0.385) return Math.abs(th) < 1.75 ? A('quads') : A('hamstrings');
            if (y > -0.445 || y < -0.72) return SKIN_ID;
            const c = Math.cos(th);
            return c < 0.2 || (th > 0.2 && th < 1.4) ? A('calves') : SKIN_ID;
          },
          bump: (x, y, z) => {
            const th = legTheta(x, z);
            let b = 0;
            if (y > -0.4) {
              b += 0.013 * g1(y + 0.19, 0.08) * g1(dAng(th, 1.0), 0.55); // outer quad sweep
              b += 0.01 * g1(y + 0.17, 0.09) * g1(dAng(th, 0), 0.42); // rectus femoris
              b += 0.014 * g1(y + 0.33, 0.03) * g1(dAng(th, -0.9), 0.35); // teardrop above the knee
              b += 0.008 * g1(y + 0.2, 0.08) * clamp01(-Math.cos(th)); // hamstrings
            } else {
              b += 0.016 * g1(y + 0.53, 0.05) * (g1(dAng(th, 2.55), 0.45) + g1(dAng(th, -2.55), 0.45)); // two calf heads
              b += 0.005 * g1(y + 0.57, 0.07) * g1(dAng(th, 0.6), 0.4); // shin muscle
            }
            return 1.6 * b;
          },
        },
        skinMat,
      ),
    );
    // Trainer.
    addMesh(leg, new THREE.CapsuleGeometry(0.045, 0.13, 8, 20), shoeMat, [0.004 * s, -0.83, 0.03], [1.1, 1, 0.75], [Math.PI / 2, 0, 0]);
    addMesh(leg, new THREE.CylinderGeometry(0.05, 0.05, 0.012, 24), soleMat, [0.004 * s, -0.858, 0.03], [1.0, 1, 2.1]);
  }

  // ===========================================================================
  // Shape at a middle level, then snap beads and the heart onto the surface.
  // ===========================================================================
  const shown = new Float32Array(AREA_IDS.length).fill(50);
  const target = new Float32Array(AREA_IDS.length).fill(50);
  skinParts.forEach((p) => applyShape(p, shown));
  figure.updateMatrixWorld(true);

  const caster = new THREE.Raycaster();
  const skinMeshes = skinParts.map((p) => p.mesh);
  const nm = new THREE.Matrix3();
  /** Cast from `from` along `dir` onto the skin; return the surface point pushed out by `lift`. */
  const snap = (from: V3, dir: V3, lift: number) => {
    caster.set(new THREE.Vector3(...from), new THREE.Vector3(...dir).normalize());
    const hit = caster.intersectObjects(skinMeshes, false)[0];
    if (!hit || !hit.face) return { point: new THREE.Vector3(...from), normal: new THREE.Vector3(...dir).negate() };
    nm.getNormalMatrix(hit.object.matrixWorld);
    const normal = hit.face.normal.clone().applyMatrix3(nm).normalize();
    return { point: hit.point.clone().addScaledVector(normal, lift), normal };
  };

  const extras: { mesh: THREE.Mesh; area: string; joint: boolean; mat: THREE.MeshPhysicalMaterial }[] = [];
  const extraMat = new Map<string, THREE.MeshPhysicalMaterial>();
  const matFor = (area: string, joint: boolean) => {
    let m = extraMat.get(area);
    if (!m) {
      m = new THREE.MeshPhysicalMaterial({ color: 0xcccccc, roughness: joint ? 0.35 : 0.45, clearcoat: 0.35, clearcoatRoughness: 0.4 });
      extraMat.set(area, m);
      materials.push(m);
    }
    return m;
  };
  const beadGeo = new THREE.SphereGeometry(0.016, 16, 12);
  // Invisible, finger-sized tap target around each bead (raycasts ignore visibility).
  const hitGeo = new THREE.SphereGeometry(0.03, 8, 6);
  const hitMat = new THREE.MeshBasicMaterial({ visible: false });
  geometries.push(beadGeo, hitGeo);
  materials.push(hitMat);
  const bead = (area: string, from: V3, dir: V3) => {
    const { point } = snap(from, dir, 0.007);
    const mat = matFor(area, true);
    const m = new THREE.Mesh(beadGeo, mat);
    m.position.copy(point);
    m.userData.area = area;
    figure.add(m);
    const target = new THREE.Mesh(hitGeo, hitMat);
    target.position.copy(point);
    target.userData.area = area;
    figure.add(target);
    extras.push({ mesh: m, area, joint: true, mat });
  };

  // Back mobility: down the spine.
  for (const y of [1.0, 1.08, 1.16, 1.24, 1.32, 1.4]) bead('backMobility', [0, y, -0.6], [0, 0, 1]);
  for (const s of [1, -1]) {
    // Shoulder mobility: an arc over the top of each shoulder, aimed at the joint.
    const cx = 0.19 * s, cy = 1.39;
    for (const deg of [-55, 0, 55]) {
      const t = (deg * Math.PI) / 180;
      const o: V3 = [cx + 0.02 * s, cy + 0.3 * Math.cos(t), 0.3 * Math.sin(t)];
      bead('shoulderMobility', o, [cx - o[0], cy - o[1], -o[2]]);
    }
    // Hip mobility: along the front hip crease, then round the outside.
    for (const x of [0.055, 0.105]) bead('hipMobility', [x * s, 0.84, 0.6], [0, 0, -1]);
    bead('hipMobility', [0.21 * s, 0.86, 0.01], [-s, 0, 0]); // start inside the hanging arm
    // Hamstring flexibility: down the back of each thigh.
    for (const y of [0.77, 0.7, 0.63, 0.56]) bead('hamstringFlex', [0.088 * s, y, -0.6], [0, 0, 1]);
  }

  // Heart (Cardio) on the figure's left pec (+x when facing us).
  const heartGeo = heartGeometry(0.045);
  geometries.push(heartGeo);
  const hs = snap([0.075, 1.322, 0.6], [0, 0, -1], 0.012);
  const heartMat = matFor('cardio', false);
  const heart = new THREE.Mesh(heartGeo, heartMat);
  heart.position.copy(hs.point);
  heart.lookAt(hs.point.clone().add(hs.normal));
  heart.userData.area = 'cardio';
  figure.add(heart);
  extras.push({ mesh: heart, area: 'cardio', joint: false, mat: heartMat });

  // ===========================================================================
  // Styling: colours, selection, focus, injuries, growth.
  // ===========================================================================
  let style: BodyStyle | null = null;
  let firstStyle = true;
  const areaColour = AREA_IDS.map(() => new THREE.Color());
  const accent = new THREE.Color();
  let pulse = 0;

  const paint = () => {
    if (!style) return;
    const st = style;
    accent.set(st.accent || '#1f7a6a');
    AREA_IDS.forEach((id, i) => {
      const c = areaColour[i].set(levelBand(st.levels[id] ?? 0).color);
      if (st.selected === id) c.lerp(WHITE, 0.38);
      else if (st.injured.has(id)) c.lerp(RED, pulse);
      else if (st.pinned.has(id)) c.lerp(accent, 0.22);
    });
    skinParts.forEach((p) => applyColours(p, areaColour));
    for (const e of extras) {
      const level = e.area === 'cardio' ? st.cardioLevel : st.levels[e.area] ?? 0;
      const band = levelBand(level).color;
      e.mat.color.set(band);
      if (st.selected === e.area) e.mat.emissive.set(0xffffff), (e.mat.emissiveIntensity = 0.38);
      else if (st.injured.has(e.area)) e.mat.emissive.copy(RED), (e.mat.emissiveIntensity = pulse);
      else if (st.pinned.has(e.area)) e.mat.emissive.copy(accent), (e.mat.emissiveIntensity = 0.28);
      else if (e.joint) e.mat.emissive.set(band), (e.mat.emissiveIntensity = 0.25);
      else e.mat.emissive.set(0x000000), (e.mat.emissiveIntensity = 0);
    }
  };

  const reshape = (only?: Set<number>) => {
    for (const p of skinParts) if (!only || [...p.areas].some((a) => only.has(a))) applyShape(p, shown);
  };

  return {
    figure,
    setStyle: (s) => {
      style = s;
      AREA_IDS.forEach((id, i) => (target[i] = Math.max(0, Math.min(100, s.levels[id] ?? 0))));
      if (firstStyle) {
        // Start at the real size; only later changes animate.
        shown.set(target);
        reshape();
        firstStyle = false;
      }
      if (!s.injured.size) pulse = 0;
      paint();
    },
    tick: (now, dt, reduced) => {
      // Heartbeat.
      if (!reduced) {
        const t = (now / 1000) % 1.1;
        const beat = t < 0.12 ? 1 + 0.18 * Math.sin((t / 0.12) * Math.PI) : t > 0.22 && t < 0.34 ? 1 + 0.1 * Math.sin(((t - 0.22) / 0.12) * Math.PI) : 1;
        heart.scale.setScalar(beat);
      }
      // Growth easing.
      const changed = new Set<number>();
      const k = Math.min(1, dt * 3);
      for (let i = 0; i < shown.length; i++) {
        const d = target[i] - shown[i];
        if (Math.abs(d) > 0.05) {
          shown[i] += d * k;
          changed.add(i);
        } else if (d !== 0) {
          shown[i] = target[i];
          changed.add(i);
        }
      }
      if (changed.size) reshape(changed);
      // Injured areas pulse red slowly (steady with reduced motion).
      if (style && style.injured.size) {
        pulse = reduced ? 0.5 : 0.2 + 0.45 * (0.5 + 0.5 * Math.sin((now / 2400) * Math.PI * 2));
        paint();
      }
    },
    pick: (hit) => {
      if (hit.object.userData.area) return hit.object.userData.area as string;
      const pi = hit.object.userData.skinPart as number | undefined;
      if (pi === undefined || !hit.face) return undefined;
      const p = skinParts[pi];
      const votes = [hit.face.a, hit.face.b, hit.face.c].map((v) => p.area[v]).filter((a) => a >= 0);
      if (!votes.length) return undefined;
      const count = (a: number) => votes.filter((v) => v === a).length;
      const best = votes.reduce((m, a) => (count(a) > count(m) ? a : m), votes[0]);
      return AREA_IDS[best];
    },
    dispose: () => {
      geometries.forEach((g) => g.dispose());
      materials.forEach((m) => m.dispose());
    },
  };
}

function heartGeometry(size: number) {
  const s = new THREE.Shape();
  s.moveTo(0, -0.35);
  s.bezierCurveTo(-0.15, -0.2, -0.5, 0.05, -0.5, 0.3);
  s.bezierCurveTo(-0.5, 0.55, -0.2, 0.62, 0, 0.4);
  s.bezierCurveTo(0.2, 0.62, 0.5, 0.55, 0.5, 0.3);
  s.bezierCurveTo(0.5, 0.05, 0.15, -0.2, 0, -0.35);
  const g = new THREE.ExtrudeGeometry(s, { depth: 0.2, bevelEnabled: true, bevelSize: 0.06, bevelThickness: 0.06, bevelSegments: 3 });
  g.center();
  g.scale(size * 1.6, size * 1.6, size * 1.6);
  return g;
}
