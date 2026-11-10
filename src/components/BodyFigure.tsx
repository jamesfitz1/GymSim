import { useCallback, useEffect, useRef, useState } from 'react';
import { AREA_BY_ID, levelBand, LEVEL_BANDS, SUB_AREAS } from '../domain/config';

// An original flat-illustration avatar on a turntable. Muscle groups are
// filled by their sub-area's health band; the heart in the chest shows the
// Cardio system. Pinned priority areas get a dashed accent outline.
// Paths are drawn for the figure's left side and mirrored about x = 100.

const SKIN = '#d6a37c';
const SKIN_SHADE = '#c08d67';
const HAIR = '#4a2f22';
const SHORTS = '#23282c';
const SHOE = '#2fb3a1';
const SOLE = '#f4f4f4';

const MIRROR = 'matrix(-1 0 0 1 200 0)';

// --- Shared body parts (left side; mirrored for the right) -----------------
const LEG_BASE = 'M69,204 C64,250 66,300 72,330 C70,360 72,384 76,396 L94,396 C98,384 100,360 98,330 C100,300 102,250 100,212 Z';
const ARM_BASE = 'M52,112 C42,150 40,190 42,224 L56,226 C60,190 64,150 66,116 Z';
const TORSO_BASE = 'M68,92 C76,88 88,86 92,86 L108,86 C112,86 124,88 132,92 L136,150 C134,176 132,192 130,204 L70,204 C68,192 66,176 64,150 Z';
const SHOULDER = 'M78,91 C62,89 49,100 49,116 C49,122 51,126 54,128 L60,122 C64,112 70,104 82,99 Z';
const UPPER_ARM = 'M54,126 C48,140 46,156 48,170 C50,176 58,176 61,170 C63,156 63,140 60,124 Z';
const FOREARM = 'M48,180 C44,193 42,206 44,219 C46,223 52,223 54,219 C58,206 60,193 60,180 Z';
const SHOE_PATH = 'M72,389 C70,399 70,406 73,409 L102,409 C104,402 101,394 96,389 Z';
const SOLE_PATH = 'M72,406 L103,406 C103,409 102,412 100,412 L74,412 C72,412 72,409 72,406 Z';
const HEART = 'M0,-3.6 C-1.8,-9 -9,-9 -9,-2.7 C-9,2.7 -2.7,6.3 0,9 C2.7,6.3 9,2.7 9,-2.7 C9,-9 1.8,-9 0,-3.6 Z';

// --- Front muscles -------------------------------------------------------------
const CHEST = 'M98,96 L98,126 C90,132 78,131 72,124 C68,116 70,104 78,99 C84,96 92,95 98,96 Z';
const ABS = 'M87,132 h26 a6,6 0 0 1 6,6 v50 a6,6 0 0 1 -6,6 h-26 a6,6 0 0 1 -6,-6 v-50 a6,6 0 0 1 6,-6 Z';
const OBLIQUE = 'M78,134 L78,192 C73,190 69,182 67,170 C65,156 67,142 69,132 C72,133 75,134 78,134 Z';
const QUAD = 'M71,224 C67,248 67,272 71,296 C76,302 91,302 95,296 C99,272 99,248 98,236 C90,230 78,226 71,224 Z';
const SHIN = 'M75,312 C71,330 73,356 78,378 C82,384 89,384 91,378 C95,356 97,330 94,312 C88,308 81,308 75,312 Z';
const BRIEF = 'M69,201 L131,201 L133,224 C121,226 108,230 100,236 C92,230 79,226 67,224 Z';

// --- Back muscles --------------------------------------------------------------
const LAT = 'M93,100 L93,168 C86,174 78,172 74,164 C68,148 64,124 67,104 C76,99 86,98 93,100 Z';
const LOWER_BACK = 'M72,170 C80,176 88,178 94,176 L106,176 C112,178 120,176 128,170 L130,194 L70,194 Z';
const GLUTE = 'M99,202 L99,236 C88,241 75,237 71,228 C67,216 68,206 71,202 Z';
const HAMSTRING = 'M71,236 C68,258 70,280 73,298 C79,304 91,304 95,298 C98,280 99,258 98,240 C90,236 78,234 71,236 Z';
const CALF = 'M74,310 C68,326 70,350 78,370 C83,376 90,374 93,366 C97,348 97,328 94,312 C88,306 80,306 74,310 Z';

interface FigureProps {
  levels: Record<string, number>;
  cardioLevel: number;
  pinned: Set<string>;
  selected: string | null;
  onSelect?: (id: string) => void;
}

function Pair({ d, ...rest }: { d: string } & React.SVGProps<SVGPathElement>) {
  return (
    <>
      <path d={d} {...rest} />
      <path d={d} transform={MIRROR} {...rest} />
    </>
  );
}

function Muscle({ area, props, children }: { area: string; props: FigureProps; children: React.ReactNode }) {
  const level = props.levels[area] ?? 0;
  const band = levelBand(level);
  const isPinned = props.pinned.has(area);
  const isSelected = props.selected === area;
  return (
    <g
      data-area={area}
      onClick={() => props.onSelect?.(area)}
      fill={band.color}
      stroke={isSelected ? 'var(--text)' : isPinned ? 'var(--accent)' : 'rgba(255,255,255,0.75)'}
      strokeWidth={isSelected ? 2.6 : isPinned ? 2.2 : 1}
      strokeDasharray={isPinned && !isSelected ? '4 2.5' : undefined}
      strokeLinejoin="round"
    >
      <title>{`${AREA_BY_ID[area]?.name ?? area}: ${Math.round(level)} (${band.label})`}</title>
      {children}
    </g>
  );
}

function Heart({ x, faded, props }: { x: number; faded?: boolean; props: FigureProps }) {
  const band = levelBand(props.cardioLevel);
  const cardioPinned = SUB_AREAS.some((a) => a.systemId === 'cardio' && props.pinned.has(a.id));
  const isSelected = props.selected === 'cardio';
  return (
    <g
      data-area="cardio"
      transform={`translate(${x} 113)`}
      opacity={faded ? 0.45 : 1}
      pointerEvents={faded ? 'none' : undefined}
      onClick={() => props.onSelect?.('cardio')}
    >
      <title>{`Cardio (heart): ${Math.round(props.cardioLevel)} (${band.label})`}</title>
      {/* Skin-coloured disc keeps the heart readable whatever colour the chest is. */}
      <circle r="13.5" fill={SKIN} stroke="#ffffff" strokeWidth="1.4" />
      <path
        className="heart-beat"
        d={HEART}
        fill={band.color}
        stroke={isSelected ? 'var(--text)' : cardioPinned ? 'var(--accent)' : '#ffffff'}
        strokeWidth={isSelected ? 2.4 : 1.6}
        strokeDasharray={cardioPinned && !isSelected ? '3 2' : undefined}
      />
    </g>
  );
}

function Base({ back }: { back?: boolean }) {
  return (
    <g pointerEvents="none">
      <ellipse cx="100" cy="413" rx="58" ry="7" fill="rgba(0,0,0,0.13)" />
      <Pair d={LEG_BASE} fill={SKIN} />
      <Pair d={ARM_BASE} fill={SKIN} />
      <ellipse cx="49" cy="231" rx="6.5" ry="9" fill={SKIN} />
      <ellipse cx="151" cy="231" rx="6.5" ry="9" fill={SKIN} />
      <path d={TORSO_BASE} fill={SKIN} />
      <path d="M90,68 L110,68 L112,90 L88,90 Z" fill={SKIN_SHADE} />
      <ellipse cx="79" cy="52" rx="4" ry="7" fill={SKIN_SHADE} />
      <ellipse cx="121" cy="52" rx="4" ry="7" fill={SKIN_SHADE} />
      <ellipse cx="100" cy="48" rx="21" ry="25" fill={SKIN} />
      {back ? (
        <>
          <path d="M79,48 C77,28 88,20 100,20 C112,20 123,28 121,48 C120,60 114,66 100,66 C86,66 80,60 79,48 Z" fill={HAIR} />
          <path d="M98,22 C101,13 110,11 112,17 C107,17 103,19 98,22 Z" fill={HAIR} />
        </>
      ) : (
        <path d="M79,46 C77,26 88,18 100,19 C105,12 114,12 112,19 C120,22 124,32 121,46 C117,36 110,31 100,31 C90,31 83,36 79,46 Z" fill={HAIR} />
      )}
    </g>
  );
}

function Shoes({ laces }: { laces?: boolean }) {
  return (
    <g pointerEvents="none">
      <Pair d={SHOE_PATH} fill={SHOE} />
      <Pair d={SOLE_PATH} fill={SOLE} />
      {laces && (
        <Pair d="M80,392 L88,398 M88,392 L80,398 M81,398 L89,403 M89,398 L81,403" stroke="#ffffff" strokeWidth="1.3" strokeLinecap="round" fill="none" />
      )}
    </g>
  );
}

function FrontFigure(props: FigureProps) {
  return (
    <svg viewBox="0 0 200 420" role="img" aria-label="Body health, front view">
      <Base />
      <Muscle area="quads" props={props}><Pair d={QUAD} /></Muscle>
      <Muscle area="calves" props={props}><Pair d={SHIN} /></Muscle>
      <path d={BRIEF} fill={SHORTS} pointerEvents="none" />
      <rect x="68" y="194" width="64" height="8" rx="3" fill={SHORTS} pointerEvents="none" />
      <Muscle area="obliques" props={props}><Pair d={OBLIQUE} /></Muscle>
      <Muscle area="abs" props={props}>
        <path d={ABS} />
        <path d="M100,135 V191 M84,150 H116 M84,166 H116 M85,180 H115" fill="none" stroke="rgba(0,0,0,0.16)" strokeWidth="1.2" strokeDasharray="none" />
      </Muscle>
      <Muscle area="chest" props={props}><Pair d={CHEST} /></Muscle>
      <Muscle area="arms" props={props}>
        <Pair d={UPPER_ARM} />
        <Pair d={FOREARM} />
      </Muscle>
      <Muscle area="shoulders" props={props}><Pair d={SHOULDER} /></Muscle>
      <Heart x={113} props={props} />
      <Shoes laces />
    </svg>
  );
}

function BackFigure(props: FigureProps) {
  return (
    <svg viewBox="0 0 200 420" role="img" aria-label="Body health, back view">
      <Base back />
      <Muscle area="hamstrings" props={props}><Pair d={HAMSTRING} /></Muscle>
      <Muscle area="calves" props={props}><Pair d={CALF} /></Muscle>
      <Muscle area="glutes" props={props}><Pair d={GLUTE} /></Muscle>
      <Muscle area="lowerBack" props={props}><path d={LOWER_BACK} /></Muscle>
      <Muscle area="lats" props={props}><Pair d={LAT} /></Muscle>
      <Muscle area="spinalStabilisers" props={props}><rect x="95" y="94" width="10" height="98" rx="5" /></Muscle>
      <rect x="68" y="194" width="64" height="8" rx="3" fill={SHORTS} pointerEvents="none" />
      <Muscle area="arms" props={props}>
        <Pair d={UPPER_ARM} />
        <Pair d={FOREARM} />
      </Muscle>
      <Muscle area="shoulders" props={props}><Pair d={SHOULDER} /></Muscle>
      <Heart x={87} faded props={props} />
      <Shoes />
    </svg>
  );
}

// --- Turntable ---------------------------------------------------------------
// Auto mode spins a half-turn, pauses on that side, then spins again. Dragging
// takes over and snaps to the nearest side on release.

const SPIN_MS = 2600;
const DWELL_MS = 1800;
const ease = (p: number) => 0.5 - 0.5 * Math.cos(Math.PI * p);
const reducedMotion = () =>
  typeof window !== 'undefined' && !!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

type Side = 'front' | 'back';

export function BodyFigure(props: FigureProps) {
  const spinnerRef = useRef<HTMLDivElement>(null);
  const angle = useRef(0);
  const tween = useRef<{ from: number; to: number; start: number; dur: number } | null>(null);
  const dwellUntil = useRef(0);
  const drag = useRef<{ x: number; a0: number; moved: boolean } | null>(null);
  const suppressClick = useRef(false);
  const raf = useRef(0);
  const sideRef = useRef<Side>('front');
  const [side, setSide] = useState<Side>('front');
  const [auto, setAuto] = useState(() => !reducedMotion());
  const autoRef = useRef(auto);
  autoRef.current = auto;

  const apply = useCallback(() => {
    const a = angle.current;
    if (spinnerRef.current) spinnerRef.current.style.transform = `rotateY(${a}deg)`;
    const n = ((a % 360) + 360) % 360;
    const s: Side = n < 90 || n > 270 ? 'front' : 'back';
    if (s !== sideRef.current) {
      sideRef.current = s;
      setSide(s);
    }
  }, []);

  const tick = useCallback(
    (now: number) => {
      raf.current = 0;
      const tw = tween.current;
      if (tw) {
        const p = tw.dur <= 0 ? 1 : Math.min(1, (now - tw.start) / tw.dur);
        angle.current = tw.from + (tw.to - tw.from) * ease(p);
        if (p >= 1) {
          tween.current = null;
          dwellUntil.current = now + DWELL_MS;
        }
      } else if (autoRef.current && !drag.current && now >= dwellUntil.current) {
        const from = Math.round(angle.current / 180) * 180;
        tween.current = { from, to: from + 180, start: now, dur: SPIN_MS };
      }
      apply();
      if (tween.current || (autoRef.current && !drag.current)) raf.current = requestAnimationFrame(tick);
    },
    [apply],
  );

  const kick = useCallback(() => {
    if (!raf.current) raf.current = requestAnimationFrame(tick);
  }, [tick]);

  useEffect(() => {
    if (auto) {
      dwellUntil.current = performance.now() + DWELL_MS;
      kick();
    }
  }, [auto, kick]);

  useEffect(
    () => () => {
      cancelAnimationFrame(raf.current);
      raf.current = 0;
    },
    [],
  );

  const goTo = (target: number, dur = 700) => {
    tween.current = { from: angle.current, to: target, start: performance.now(), dur: reducedMotion() ? 0 : dur };
    kick();
  };

  const showSide = (s: Side) => {
    setAuto(false);
    autoRef.current = false;
    const a = angle.current;
    goTo(s === 'front' ? Math.round(a / 360) * 360 : Math.round((a - 180) / 360) * 360 + 180);
  };

  const onPointerDown = (e: React.PointerEvent) => {
    setAuto(false);
    autoRef.current = false;
    tween.current = null;
    drag.current = { x: e.clientX, a0: angle.current, moved: false };
    suppressClick.current = false;

    const move = (ev: PointerEvent) => {
      const d = drag.current;
      if (!d) return;
      const dx = ev.clientX - d.x;
      if (Math.abs(dx) > 6) d.moved = true;
      if (d.moved) {
        angle.current = d.a0 + dx * 0.9;
        apply();
      }
    };
    const up = () => {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
      window.removeEventListener('pointercancel', up);
      const d = drag.current;
      drag.current = null;
      if (d?.moved) {
        suppressClick.current = true;
        goTo(Math.round(angle.current / 180) * 180, 450);
      } else {
        // A tap: settle on whichever side is showing.
        goTo(Math.round(angle.current / 180) * 180, 300);
      }
    };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
    window.addEventListener('pointercancel', up);
  };

  return (
    <>
      <div
        className="turntable"
        onPointerDown={onPointerDown}
        onClickCapture={(e) => {
          if (suppressClick.current) {
            e.stopPropagation();
            suppressClick.current = false;
          }
        }}
      >
        <div className="spinner" ref={spinnerRef}>
          <div className="face" aria-hidden={side !== 'front'}>
            <FrontFigure {...props} />
          </div>
          <div className="face back" aria-hidden={side !== 'back'}>
            <BackFigure {...props} />
          </div>
        </div>
      </div>

      <div className="row" style={{ justifyContent: 'center', gap: 8, marginTop: 8 }}>
        <div className="segmented" style={{ width: 170 }}>
          <button type="button" aria-pressed={side === 'front'} onClick={() => showSide('front')}>Front</button>
          <button type="button" aria-pressed={side === 'back'} onClick={() => showSide('back')}>Back</button>
        </div>
        <button
          type="button"
          className="btn ghost small"
          onClick={() => setAuto((v) => !v)}
          aria-label={auto ? 'Stop rotating' : 'Start rotating'}
        >
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
        {props.pinned.size > 0 && (
          <span>
            <i className="swatch" style={{ border: '2px dashed var(--accent)' }} />
            Priority
          </span>
        )}
      </div>
    </>
  );
}
