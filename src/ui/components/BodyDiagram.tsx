import type { MuscleId } from '../../types';
import { MUSCLE_LABELS } from '../../types';
import { fatigueColor } from '../../domain/fatigue';

type Shape = { id: MuscleId; d: string };

// Left half of each view (viewer's left); the right half is mirrored around x = 100.
const FRONT: Shape[] = [
  { id: 'traps', d: 'M100 54 L88 52 L74 62 L88 68 L100 64 Z' },
  { id: 'shoulders_front', d: 'M74 63 Q58 62 52 78 Q52 90 61 92 L72 82 L78 70 Z' },
  { id: 'shoulders_side', d: 'M52 78 Q45 84 45 97 Q52 99 59 93 Q50 90 52 78 Z' },
  { id: 'chest', d: 'M100 68 L88 68 L78 71 Q73 84 80 97 Q92 101 100 97 Z' },
  { id: 'abs', d: 'M100 101 L89 101 L88 150 Q94 157 100 157 Z' },
  { id: 'obliques', d: 'M87 101 L79 100 Q74 126 80 153 L87 150 Z' },
  { id: 'biceps', d: 'M59 95 Q51 98 49 119 Q56 125 64 121 L68 99 Z' },
  { id: 'forearms', d: 'M49 123 Q43 142 39 170 L49 172 Q58 148 64 124 Z' },
  { id: 'adductors', d: 'M100 160 L91 160 Q87 190 91 216 L100 196 Z' },
  { id: 'quads', d: 'M89 160 L70 157 Q62 190 67 238 L84 240 Q92 200 90 162 Z' },
  { id: 'calves', d: 'M70 252 Q64 282 68 322 L80 322 Q85 282 82 252 Z' },
];

const BACK: Shape[] = [
  { id: 'traps', d: 'M100 50 L86 52 L74 63 L88 74 L100 80 Z' },
  { id: 'shoulders_rear', d: 'M74 64 Q58 63 52 79 Q53 91 63 92 L73 82 L78 70 Z' },
  { id: 'upper_back', d: 'M88 76 L78 70 L74 84 L84 98 L100 102 L100 82 Z' },
  { id: 'lats', d: 'M84 100 L74 86 Q68 112 78 134 L86 132 Z' },
  { id: 'triceps', d: 'M59 95 Q51 98 49 119 Q56 125 64 121 L68 99 Z' },
  { id: 'forearms', d: 'M49 123 Q43 142 39 170 L49 172 Q58 148 64 124 Z' },
  { id: 'lower_back', d: 'M100 106 L87 104 L87 134 L100 152 Z' },
  { id: 'glutes', d: 'M100 156 L80 154 Q72 172 79 192 Q92 198 100 192 Z' },
  { id: 'hamstrings', d: 'M98 196 L79 196 Q71 220 75 246 L90 248 Q98 222 98 196 Z' },
  { id: 'calves', d: 'M75 254 Q69 284 73 322 L86 322 Q91 284 87 252 Z' },
];


function Half({ shapes, fatigue, fills, selected, onSelect, mirror, readOnly }: {
  shapes: Shape[]; fatigue: Record<MuscleId, number>; fills?: Record<MuscleId, string>; selected: MuscleId | null;
  onSelect: (m: MuscleId) => void; mirror?: boolean; readOnly?: boolean;
}) {
  return (
    <g transform={mirror ? 'translate(200 0) scale(-1 1)' : undefined}>
      {shapes.map((s) => (
        readOnly ? (
          <path key={s.id} d={s.d} data-muscle={s.id} fill={fills ? fills[s.id] : fatigueColor(fatigue[s.id])} strokeWidth={1} style={{ stroke: 'var(--muscle-stroke)' }} />
        ) : (
          <path
            key={s.id}
            d={s.d}
            data-muscle={s.id}
            role="button"
            tabIndex={0}
            aria-label={`${MUSCLE_LABELS[s.id]}, ${Math.round(100 - fatigue[s.id])}% recovered`}
            fill={fills ? fills[s.id] : fatigueColor(fatigue[s.id])}
                        strokeWidth={selected === s.id ? 2.5 : 1}
            style={{ cursor: 'pointer', stroke: selected === s.id ? 'var(--text)' : 'var(--muscle-stroke)' }}
            onClick={() => onSelect(s.id)}
            onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && onSelect(s.id)}
          />
        )
      ))}
    </g>
  );
}

function Silhouette() {
  return (
    <g style={{ fill: 'var(--neutral-muscle)' }}>
      <circle cx="100" cy="28" r="17" />
      <rect x="92" y="42" width="16" height="14" />
      <path d="M100 52 L74 60 L50 76 L36 172 L30 184 L50 188 L64 126 L80 156 L66 244 L66 326 L84 332 L92 250 L100 214 L108 250 L116 332 L134 326 L134 244 L120 156 L136 126 L150 188 L170 184 L164 172 L150 76 L126 60 Z" />
    </g>
  );
}

export function BodyDiagram({ fatigue, fills, selected, onSelect, readOnly }: {
  fatigue: Record<MuscleId, number>; fills?: Record<MuscleId, string>; selected: MuscleId | null; onSelect: (m: MuscleId) => void; readOnly?: boolean;
}) {
  const view = (title: string, shapes: Shape[]) => (
    <figure className="body-view">
      <svg viewBox="20 0 160 345" role={readOnly ? 'img' : 'group'} aria-label={`${title} muscle diagram`}>
        <Silhouette />
        <Half shapes={shapes} fatigue={fatigue} fills={fills} selected={selected} onSelect={onSelect} readOnly={readOnly} />
        <Half shapes={shapes} fatigue={fatigue} fills={fills} selected={selected} onSelect={onSelect} mirror readOnly={readOnly} />
      </svg>
      <figcaption>{title}</figcaption>
    </figure>
  );
  return (
    <div className="body-diagram">
      {view('Front', FRONT)}
      {view('Back', BACK)}
    </div>
  );
}

export function FatigueLegend() {
  return (
    <div className="legend" aria-label="Fatigue colour scale">
      <span>Recovered</span>
      <div className="legend-bar" style={{ background: `linear-gradient(90deg, ${fatigueColor(0)}, ${fatigueColor(50)}, ${fatigueColor(100)})` }} />
      <span>Fatigued</span>
    </div>
  );
}
