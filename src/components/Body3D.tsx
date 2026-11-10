import { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { levelBand, LEVEL_BANDS, SUB_AREAS } from '../domain/config';

// A code-built 3D mannequin (original, no model files). Every muscle group is
// its own mesh, coloured by that sub-area's health band. Mobility shows as
// rings at the shoulders, hips and knees, and beads along the spine. The heart
// in the chest shows Cardio. Drag to spin, tap a part to select it.

const SKIN = 0xd6a37c;
const HAIR = 0x4a2f22;
const SHORTS = 0x23282c;
const SHOE = 0x2fb3a1;

type Geo = 'sphere' | 'capsule' | 'torus' | 'heart';
interface Part {
  /** Sub-area id, 'cardio' for the heart, or undefined for neutral parts. */
  area?: string;
  geo: Geo;
  /** sphere: [r]; capsule: [r, length]; torus: [r, tube] */
  size: number[];
  pos: [number, number, number];
  scale?: [number, number, number];
  rot?: [number, number, number];
  color?: number;
  /** Also place a copy mirrored across x = 0. */
  pair?: boolean;
  /** Mobility rings and spine beads: slightly glowing. */
  joint?: boolean;
}

const PARTS: Part[] = [
  // --- neutral body -------------------------------------------------------
  { geo: 'sphere', size: [0.105], pos: [0, 1.63, 0], scale: [1, 1.15, 1.02], color: SKIN },
  { geo: 'sphere', size: [0.112], pos: [0, 1.67, -0.012], scale: [1.02, 1.0, 1.04], color: HAIR },
  { geo: 'capsule', size: [0.048, 0.08], pos: [0, 1.48, 0], color: SKIN },
  { geo: 'capsule', size: [0.14, 0.3], pos: [0, 1.2, 0], scale: [1.18, 1, 0.7], color: SKIN },
  { geo: 'sphere', size: [0.15], pos: [0, 0.93, 0], scale: [1.08, 0.62, 0.74], color: SHORTS },
  { geo: 'sphere', size: [0.045], pos: [0.305, 0.78, 0.01], scale: [0.8, 1.25, 0.6], color: SKIN, pair: true },
  // Continuous skin arm under the arm muscles, so shoulder → elbow → wrist reads as one limb.
  { geo: 'capsule', size: [0.036, 0.5], pos: [0.272, 1.08, 0.005], rot: [0, 0, 0.075], color: SKIN, pair: true },
  { geo: 'sphere', size: [0.04], pos: [0.272, 1.1, 0.005], color: SKIN, pair: true },
  { geo: 'capsule', size: [0.056, 0.62], pos: [0.09, 0.48, 0], color: SKIN, pair: true },
  { geo: 'capsule', size: [0.05, 0.12], pos: [0.09, 0.05, 0.035], rot: [Math.PI / 2, 0, 0], scale: [1.05, 1, 0.75], color: SHOE, pair: true },

  // --- muscles --------------------------------------------------------------
  { area: 'shoulders', geo: 'sphere', size: [0.074], pos: [0.2, 1.41, 0], scale: [1, 0.92, 1], pair: true },
  { area: 'chest', geo: 'sphere', size: [0.1], pos: [0.078, 1.33, 0.072], scale: [1, 0.74, 0.55], pair: true },
  { area: 'abs', geo: 'capsule', size: [0.066, 0.15], pos: [0, 1.1, 0.078], scale: [1, 1, 0.5] },
  { area: 'obliques', geo: 'capsule', size: [0.04, 0.15], pos: [0.125, 1.1, 0.045], scale: [1, 1, 0.75], pair: true },
  { area: 'lats', geo: 'sphere', size: [0.11], pos: [0.098, 1.28, -0.066], scale: [0.9, 1.3, 0.5], pair: true },
  { area: 'spinalStabilisers', geo: 'capsule', size: [0.026, 0.38], pos: [0, 1.18, -0.096] },
  { area: 'lowerBack', geo: 'sphere', size: [0.1], pos: [0, 1.02, -0.072], scale: [1.32, 0.6, 0.5] },
  { area: 'arms', geo: 'capsule', size: [0.047, 0.15], pos: [0.255, 1.23, 0.005], rot: [0, 0, 0.1], pair: true },
  { area: 'arms', geo: 'capsule', size: [0.04, 0.17], pos: [0.29, 0.97, 0.01], rot: [0, 0, 0.05], pair: true },
  { area: 'glutes', geo: 'sphere', size: [0.086], pos: [0.075, 0.9, -0.07], scale: [1, 1, 0.82], pair: true },
  { area: 'quads', geo: 'capsule', size: [0.073, 0.22], pos: [0.09, 0.69, 0.024], scale: [1, 1, 0.9], pair: true },
  { area: 'hamstrings', geo: 'capsule', size: [0.066, 0.2], pos: [0.09, 0.69, -0.03], pair: true },
  { area: 'calves', geo: 'capsule', size: [0.055, 0.15], pos: [0.09, 0.32, -0.018], pair: true },

  // --- mobility -------------------------------------------------------------
  { area: 'shoulderMobility', geo: 'torus', size: [0.085, 0.011], pos: [0.2, 1.41, 0], rot: [0, Math.PI / 2, 0], pair: true, joint: true },
  { area: 'hipMobility', geo: 'torus', size: [0.092, 0.011], pos: [0.09, 0.84, 0], rot: [Math.PI / 2, 0, 0], pair: true, joint: true },
  { area: 'hamstringFlex', geo: 'torus', size: [0.066, 0.01], pos: [0.09, 0.5, 0], rot: [Math.PI / 2, 0, 0], pair: true, joint: true },
  ...[1.0, 1.09, 1.18, 1.27, 1.36].map(
    (y): Part => ({ area: 'backMobility', geo: 'sphere', size: [0.02], pos: [0, y, -0.122], joint: true }),
  ),

  // --- heart (Cardio) -------------------------------------------------------
  { area: 'cardio', geo: 'heart', size: [0.05], pos: [0.072, 1.33, 0.118] },
];

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

function geometry(p: Part): THREE.BufferGeometry {
  switch (p.geo) {
    case 'sphere':
      return new THREE.SphereGeometry(p.size[0], 28, 20);
    case 'capsule':
      return new THREE.CapsuleGeometry(p.size[0], p.size[1], 8, 20);
    case 'torus':
      return new THREE.TorusGeometry(p.size[0], p.size[1], 10, 36);
    case 'heart':
      return heartGeometry(p.size[0]);
  }
}

export function webglAvailable(): boolean {
  try {
    const c = document.createElement('canvas');
    return !!(c.getContext('webgl2') || c.getContext('webgl'));
  } catch {
    return false;
  }
}

const reducedMotion = () => !!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

export interface Body3DProps {
  levels: Record<string, number>;
  cardioLevel: number;
  pinned: Set<string>;
  selected: string | null;
  onSelect?: (id: string) => void;
}

export default function Body3D({ levels, cardioLevel, pinned, selected, onSelect }: Body3DProps) {
  const hostRef = useRef<HTMLDivElement>(null);
  const api = useRef<{
    meshes: { mesh: THREE.Mesh; part: Part }[];
    figure: THREE.Group;
    heart?: THREE.Mesh;
    render: () => void;
    setAngle: (a: number, animate?: boolean) => void;
    getAngle: () => number;
  } | null>(null);
  const [auto, setAuto] = useState(() => !reducedMotion());
  const autoRef = useRef(auto);
  autoRef.current = auto;
  const onSelectRef = useRef(onSelect);
  onSelectRef.current = onSelect;
  const [side, setSide] = useState<'front' | 'back'>('front');

  // Build the scene once.
  useEffect(() => {
    const host = hostRef.current!;
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    host.appendChild(renderer.domElement);
    renderer.domElement.style.touchAction = 'pan-y';

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(26, 1, 0.1, 20);
    camera.position.set(0, 1.02, 4.3);
    camera.lookAt(0, 0.9, 0);

    scene.add(new THREE.HemisphereLight(0xffffff, 0x8a9690, 1.6));
    const key = new THREE.DirectionalLight(0xffffff, 1.5);
    key.position.set(1.5, 2.5, 3);
    scene.add(key);
    const rim = new THREE.DirectionalLight(0xffffff, 0.7);
    rim.position.set(-2, 1.5, -2.5);
    scene.add(rim);

    const figure = new THREE.Group();
    scene.add(figure);

    // Ground shadow.
    const shadow = new THREE.Mesh(
      new THREE.CircleGeometry(0.32, 40),
      new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.12 }),
    );
    shadow.rotation.x = -Math.PI / 2;
    shadow.scale.set(1, 0.55, 1);
    scene.add(shadow);

    const meshes: { mesh: THREE.Mesh; part: Part }[] = [];
    let heart: THREE.Mesh | undefined;
    for (const part of PARTS) {
      const sides = part.pair ? [1, -1] : [1];
      for (const sx of sides) {
        const mat = new THREE.MeshStandardMaterial({ color: part.color ?? 0xcccccc, roughness: part.color === SHORTS ? 0.9 : 0.62, metalness: 0 });
        const mesh = new THREE.Mesh(geometry(part), mat);
        mesh.position.set(part.pos[0] * sx, part.pos[1], part.pos[2]);
        if (part.scale) mesh.scale.set(...part.scale);
        if (part.rot) mesh.rotation.set(part.rot[0], part.rot[1] * sx, part.rot[2] * sx);
        mesh.userData.area = part.area;
        figure.add(mesh);
        if (part.area) meshes.push({ mesh, part });
        if (part.geo === 'heart') heart = mesh;
      }
    }

    // --- sizing ---------------------------------------------------------------
    const resize = () => {
      const w = host.clientWidth;
      const h = host.clientHeight;
      renderer.setSize(w, h, false);
      renderer.domElement.style.width = `${w}px`;
      renderer.domElement.style.height = `${h}px`;
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      render();
    };
    const ro = new ResizeObserver(resize);
    ro.observe(host);

    // --- rotation state ---------------------------------------------------------
    let angle = 0;
    let velocity = 0;
    let tween: { from: number; to: number; start: number; dur: number } | null = null;
    let dragging: { x: number; a0: number; moved: boolean; lastX: number; lastT: number } | null = null;
    let raf = 0;
    let last = performance.now();

    const render = () => renderer.render(scene, camera);

    const updateSide = () => {
      const n = ((angle % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2);
      setSide(n < Math.PI / 2 || n > (Math.PI * 3) / 2 ? 'front' : 'back');
    };

    const loop = (now: number) => {
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      if (tween) {
        const p = Math.min(1, (now - tween.start) / tween.dur);
        angle = tween.from + (tween.to - tween.from) * (0.5 - 0.5 * Math.cos(Math.PI * p));
        if (p >= 1) tween = null;
      } else if (!dragging) {
        if (Math.abs(velocity) > 0.01) {
          angle += velocity * dt;
          velocity *= Math.pow(0.04, dt); // fling decays quickly
        } else if (autoRef.current) {
          angle += 0.55 * dt;
        }
      }
      figure.rotation.y = angle;
      if (heart && !reducedMotion()) {
        const t = (now / 1000) % 1.1;
        const beat = t < 0.12 ? 1 + 0.18 * Math.sin((t / 0.12) * Math.PI) : t > 0.22 && t < 0.34 ? 1 + 0.1 * Math.sin(((t - 0.22) / 0.12) * Math.PI) : 1;
        heart.scale.setScalar(beat);
      }
      updateSide();
      render();
      raf = requestAnimationFrame(loop);
    };

    const onVisibility = () => {
      cancelAnimationFrame(raf);
      if (!document.hidden) {
        last = performance.now();
        raf = requestAnimationFrame(loop);
      }
    };
    document.addEventListener('visibilitychange', onVisibility);
    raf = requestAnimationFrame(loop);

    // --- input ----------------------------------------------------------------------
    const raycaster = new THREE.Raycaster();
    const pick = (clientX: number, clientY: number) => {
      const r = renderer.domElement.getBoundingClientRect();
      const ndc = new THREE.Vector2(((clientX - r.left) / r.width) * 2 - 1, -((clientY - r.top) / r.height) * 2 + 1);
      raycaster.setFromCamera(ndc, camera);
      const hit = raycaster.intersectObjects(figure.children, false)[0];
      return hit?.object.userData.area as string | undefined;
    };

    const el = renderer.domElement;
    const down = (e: PointerEvent) => {
      tween = null;
      velocity = 0;
      dragging = { x: e.clientX, a0: angle, moved: false, lastX: e.clientX, lastT: performance.now() };
    };
    const move = (e: PointerEvent) => {
      if (!dragging) return;
      const dx = e.clientX - dragging.x;
      if (Math.abs(dx) > 6 && !dragging.moved) {
        dragging.moved = true;
        setAuto(false);
      }
      if (dragging.moved) {
        angle = dragging.a0 + dx * 0.012;
        const now = performance.now();
        const dtm = Math.max(1, now - dragging.lastT);
        velocity = ((e.clientX - dragging.lastX) * 0.012 * 1000) / dtm;
        dragging.lastX = e.clientX;
        dragging.lastT = now;
      }
    };
    const up = (e: PointerEvent) => {
      if (!dragging) return;
      const wasMove = dragging.moved;
      dragging = null;
      if (!wasMove) {
        velocity = 0;
        const area = pick(e.clientX, e.clientY);
        if (area) {
          setAuto(false);
          onSelectRef.current?.(area);
        }
      }
    };
    el.addEventListener('pointerdown', down);
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
    window.addEventListener('pointercancel', up);

    api.current = {
      meshes,
      figure,
      heart,
      render,
      getAngle: () => angle,
      setAngle: (target, animate = true) => {
        velocity = 0;
        tween = { from: angle, to: target, start: performance.now(), dur: animate && !reducedMotion() ? 700 : 1 };
      },
    };

    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
      document.removeEventListener('visibilitychange', onVisibility);
      el.removeEventListener('pointerdown', down);
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
      window.removeEventListener('pointercancel', up);
      figure.traverse((o) => {
        if (o instanceof THREE.Mesh) {
          o.geometry.dispose();
          (o.material as THREE.Material).dispose();
        }
      });
      renderer.dispose();
      el.remove();
      api.current = null;
    };
  }, []);

  // Recolour whenever levels / focus / selection change.
  useEffect(() => {
    const a = api.current;
    if (!a) return;
    const cardioPinned = SUB_AREAS.some((s) => s.systemId === 'cardio' && pinned.has(s.id));
    for (const { mesh, part } of a.meshes) {
      const area = part.area!;
      const level = area === 'cardio' ? cardioLevel : levels[area] ?? 0;
      const mat = mesh.material as THREE.MeshStandardMaterial;
      mat.color.set(levelBand(level).color);
      const isSel = selected === area;
      const isPinned = area === 'cardio' ? cardioPinned : pinned.has(area);
      if (isSel) mat.emissive.set(0xffffff), (mat.emissiveIntensity = 0.38);
      else if (isPinned) mat.emissive.set(getComputedStyle(document.documentElement).getPropertyValue('--accent').trim() || '#1f7a6a'), (mat.emissiveIntensity = 0.28);
      else if (part.joint) mat.emissive.set(levelBand(level).color), (mat.emissiveIntensity = 0.25);
      else mat.emissive.set(0x000000), (mat.emissiveIntensity = 0);
    }
    a.render();
  }, [levels, cardioLevel, pinned, selected]);

  const showSide = (s: 'front' | 'back') => {
    const a = api.current;
    if (!a) return;
    setAuto(false);
    const cur = a.getAngle();
    const base = Math.round(cur / (Math.PI * 2)) * Math.PI * 2;
    a.setAngle(s === 'front' ? base : Math.round((cur - Math.PI) / (Math.PI * 2)) * Math.PI * 2 + Math.PI);
  };

  return (
    <>
      <div ref={hostRef} className="body3d" role="img" aria-label="3D body: drag to rotate, tap a muscle to see its level" />
      <div className="row" style={{ justifyContent: 'center', gap: 8, marginTop: 8 }}>
        <div className="segmented" style={{ width: 170 }}>
          <button type="button" aria-pressed={side === 'front'} onClick={() => showSide('front')}>Front</button>
          <button type="button" aria-pressed={side === 'back'} onClick={() => showSide('back')}>Back</button>
        </div>
        <button type="button" className="btn ghost small" onClick={() => setAuto((v) => !v)} aria-label={auto ? 'Stop rotating' : 'Start rotating'}>
          {auto ? '❚❚ Pause' : '⟳ Rotate'}
        </button>
      </div>
      <div className="legend" aria-hidden="true">
        {[...LEVEL_BANDS].reverse().map((b) => (
          <span key={b.label}>
            <i className="swatch" style={{ background: b.color }} />
            {b.label}
          </span>
        ))}
        <span>♥ Cardio</span>
        <span>◯ Mobility</span>
        {pinned.size > 0 && (
          <span>
            <i className="swatch" style={{ boxShadow: '0 0 0 2px var(--accent)' }} />
            Focus
          </span>
        )}
      </div>
    </>
  );
}
