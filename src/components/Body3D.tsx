import { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { LEVEL_BANDS, SUB_AREAS } from '../domain/config';
import { buildBody, type BodyModel } from './bodyModel';

// The 3D body view. The athletic figure itself is built in ./bodyModel.ts.
// Each muscle is coloured by its sub-area's health band and grows (up to 20%)
// with its level; mobility shows as beads; the heart shows Cardio.
// Drag to spin, tap a part to select it.

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
  /** Areas with an active injury: they pulse red. */
  injured?: Set<string>;
  selected: string | null;
  onSelect?: (id: string) => void;
}

export default function Body3D({ levels, cardioLevel, pinned, injured, selected, onSelect }: Body3DProps) {
  const hostRef = useRef<HTMLDivElement>(null);
  const api = useRef<{
    model: BodyModel;
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

    // Key + fill + rim lighting so muscle shapes read clearly.
    scene.add(new THREE.HemisphereLight(0xffffff, 0x7d8a84, 1.25));
    const key = new THREE.DirectionalLight(0xffffff, 1.9);
    key.position.set(1.6, 2.6, 2.8);
    scene.add(key);
    const fill = new THREE.DirectionalLight(0xfff4ea, 0.55);
    fill.position.set(-2.2, 1.2, 1.8);
    scene.add(fill);
    const rim = new THREE.DirectionalLight(0xffffff, 1.1);
    rim.position.set(-1.2, 2.2, -2.8);
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

    const model = buildBody();
    figure.add(model.figure);

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
      model.tick(now, dt, reducedMotion());
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
      // Only the nearest surface counts, so a tap never selects a muscle hidden behind skin.
      const hit = raycaster.intersectObject(figure, true)[0];
      return hit ? model.pick(hit) : undefined;
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
      model,
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
      model.dispose();
      shadow.geometry.dispose();
      (shadow.material as THREE.Material).dispose();
      renderer.dispose();
      el.remove();
      api.current = null;
    };
  }, []);

  // Restyle whenever levels / focus / injuries / selection change.
  useEffect(() => {
    const a = api.current;
    if (!a) return;
    const cardioPinned = SUB_AREAS.some((s) => s.systemId === 'cardio' && pinned.has(s.id));
    a.model.setStyle({
      levels,
      cardioLevel,
      selected,
      pinned: cardioPinned ? new Set([...pinned, 'cardio']) : pinned,
      injured: injured ?? new Set(),
      accent: getComputedStyle(document.documentElement).getPropertyValue('--accent').trim() || '#1f7a6a',
    });
    a.render();
  }, [levels, cardioLevel, pinned, injured, selected]);

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
        <span>••• Mobility</span>
        {injured && injured.size > 0 && (
          <span>
            <i className="swatch" style={{ background: '#d1495b', boxShadow: '0 0 6px #d1495b' }} />
            Injured
          </span>
        )}
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
