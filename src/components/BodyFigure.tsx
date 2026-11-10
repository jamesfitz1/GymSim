import { AREA_BY_ID, levelBand, LEVEL_BANDS } from '../domain/config';

// A stylised front/back body built from simple shapes. Each muscle region is
// filled by its sub-area's health band; pinned priority areas get an accent
// outline. Cardio and mobility aren't muscles, so they're shown as bars below.

type Shape =
  | { kind: 'rect'; x: number; y: number; w: number; h: number; r?: number }
  | { kind: 'circle'; cx: number; cy: number; r: number };

interface Region {
  area: string;
  shapes: Shape[];
}

const rect = (x: number, y: number, w: number, h: number, r = 7): Shape => ({ kind: 'rect', x, y, w, h, r });
const circle = (cx: number, cy: number, r: number): Shape => ({ kind: 'circle', cx, cy, r });
const mirror = (s: Shape): Shape =>
  s.kind === 'rect' ? { ...s, x: 120 - s.x - s.w } : { ...s, cx: 120 - s.cx };
const pair = (s: Shape) => [s, mirror(s)];

const ARMS: Region = { area: 'arms', shapes: [...pair(rect(19, 70, 13, 38, 6)), ...pair(rect(15, 111, 12, 36, 6))] };
const SHOULDERS: Region = { area: 'shoulders', shapes: pair(circle(32, 62, 11)) };

const FRONT: Region[] = [
  SHOULDERS,
  { area: 'chest', shapes: pair(rect(40, 56, 19, 24)) },
  { area: 'abs', shapes: [rect(47, 83, 26, 40, 6)] },
  { area: 'obliques', shapes: pair(rect(38, 84, 8, 36, 4)) },
  ARMS,
  { area: 'quads', shapes: pair(rect(40, 130, 18, 54, 8)) },
  { area: 'calves', shapes: pair(rect(42, 190, 14, 50, 7)) },
];

const BACK: Region[] = [
  SHOULDERS,
  { area: 'lats', shapes: pair(rect(39, 58, 19, 44)) },
  { area: 'lowerBack', shapes: [rect(43, 104, 34, 20, 6)] },
  { area: 'spinalStabilisers', shapes: [rect(57, 56, 6, 70, 3)] },
  ARMS,
  { area: 'glutes', shapes: pair(rect(40, 128, 19, 24, 9)) },
  { area: 'hamstrings', shapes: pair(rect(41, 155, 17, 32, 7)) },
  { area: 'calves', shapes: pair(rect(42, 192, 14, 48, 7)) },
];

function Silhouette() {
  // Neutral body underlay so gaps between regions read as one figure.
  return (
    <g fill="var(--figure-base)" pointerEvents="none">
      <circle cx="60" cy="24" r="15" />
      <rect x="54" y="37" width="12" height="12" rx="4" />
      <rect x="30" y="50" width="60" height="78" rx="18" />
      <rect x="36" y="122" width="48" height="30" rx="12" />
      <rect x="38" y="128" width="22" height="114" rx="10" />
      <rect x="60" y="128" width="22" height="114" rx="10" />
      <rect x="17" y="58" width="16" height="92" rx="8" />
      <rect x="87" y="58" width="16" height="92" rx="8" />
    </g>
  );
}

function ShapeEl({ s, ...rest }: { s: Shape } & React.SVGProps<SVGElement>) {
  if (s.kind === 'circle') return <circle cx={s.cx} cy={s.cy} r={s.r} {...(rest as React.SVGProps<SVGCircleElement>)} />;
  return <rect x={s.x} y={s.y} width={s.w} height={s.h} rx={s.r} {...(rest as React.SVGProps<SVGRectElement>)} />;
}

function Figure({ regions, levels, pinned, onSelect, label }: {
  regions: Region[];
  levels: Record<string, number>;
  pinned: Set<string>;
  onSelect?: (areaId: string) => void;
  label: string;
}) {
  return (
    <div className="figure">
      <svg viewBox="0 0 120 250" role="img" aria-label={`${label} view of body health`}>
        <Silhouette />
        {regions.map((r) => {
          const level = levels[r.area] ?? 0;
          const band = levelBand(level);
          const isPinned = pinned.has(r.area);
          const name = AREA_BY_ID[r.area]?.name ?? r.area;
          return (
            <g
              key={r.area}
              data-area={r.area}
              onClick={() => onSelect?.(r.area)}
              fill={band.color}
              stroke={isPinned ? 'var(--accent)' : 'var(--figure-stroke)'}
              strokeWidth={isPinned ? 2.2 : 1.2}
              strokeDasharray={isPinned ? '3 2' : undefined}
            >
              <title>{`${name}: ${Math.round(level)} (${band.label})`}</title>
              {r.shapes.map((s, i) => (
                <ShapeEl key={i} s={s} />
              ))}
            </g>
          );
        })}
      </svg>
      <div className="caption">{label}</div>
    </div>
  );
}

export function BodyFigure({ levels, pinned, onSelect }: {
  levels: Record<string, number>;
  pinned: Set<string>;
  onSelect?: (areaId: string) => void;
}) {
  return (
    <>
      <div className="figures">
        <Figure regions={FRONT} levels={levels} pinned={pinned} onSelect={onSelect} label="Front" />
        <Figure regions={BACK} levels={levels} pinned={pinned} onSelect={onSelect} label="Back" />
      </div>
      <div className="legend" aria-hidden="true">
        {[...LEVEL_BANDS].reverse().map((b) => (
          <span key={b.label}>
            <i className="swatch" style={{ background: b.color }} />
            {b.label}
          </span>
        ))}
        {pinned.size > 0 && (
          <span>
            <i className="swatch" style={{ border: '2px dashed var(--accent)' }} />
            Priority
          </span>
        )}
      </div>
    </>
  );
}
