import { useEffect, useRef, useState } from 'react';
import { REGIONS, REGION_LABELS, REGION_MUSCLES, MUSCLE_LABELS, type Criteria, type SetType } from '../../types';
import { exerciseCapacity, isFullBody, selectFullBody, selectionFits, toggleMuscle, toggleRegion, trimToCapacity } from '../../domain/targets';
import { displayToKg, kgToDisplay, type Units } from '../../domain/units';

export const SET_TYPE_LABELS: Record<SetType, string> = { regular: 'Regular sets', superset: 'Supersets', hiit: 'HIIT' };

export function WeightField({ label, kg, units, onChange }: { label: string; kg: number; units: Units; onChange: (kg: number) => void }) {
  const [text, setText] = useState(String(kgToDisplay(kg, units)));
  // Parent updates may arrive late (async persistence); ignore echoes of values this field emitted
  // so in-progress typing isn't overwritten. Unit changes always reformat.
  const emitted = useRef<number[]>([]);
  const lastUnits = useRef(units);
  useEffect(() => {
    const unitsChanged = lastUnits.current !== units;
    lastUnits.current = units;
    if (!unitsChanged && emitted.current.some((x) => Math.abs(x - kg) < 1e-9)) return;
    emitted.current = [];
    setText(String(kgToDisplay(kg, units)));
  }, [kg, units]);
  return (
    <label className="field">
      <span>{label} ({units})</span>
      <input
        type="number" inputMode="decimal" min={0} step="any" value={text}
        onChange={(e) => {
          setText(e.target.value);
          const v = parseFloat(e.target.value);
          if (!Number.isNaN(v) && v >= 0) {
            const next = displayToKg(v, units);
            emitted.current.push(next);
            onChange(next);
          }
        }}
      />
    </label>
  );
}

export function NumberField({ label, value, onChange, min = 0, max, step = 1 }: {
  label: string; value: number; onChange: (n: number) => void; min?: number; max?: number; step?: number;
}) {
  return (
    <label className="field">
      <span>{label}</span>
      <input
        type="number" inputMode="numeric" min={min} max={max} step={step} value={value}
        onChange={(e) => {
          const v = parseFloat(e.target.value);
          onChange(Number.isNaN(v) ? min : v);
        }}
      />
    </label>
  );
}

export function Chips<T extends string>({ options, selected, onToggle, label }: {
  options: { value: T; label: string }[]; selected: T[]; onToggle: (v: T) => void; label: string;
}) {
  return (
    <div className="chips" role="group" aria-label={label}>
      {options.map((o) => (
        <button
          key={o.value} type="button" className={`chip ${selected.includes(o.value) ? 'on' : ''}`}
          aria-pressed={selected.includes(o.value)} onClick={() => onToggle(o.value)}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

const toggle = <T,>(list: T[], v: T) => (list.includes(v) ? list.filter((x) => x !== v) : [...list, v]);

/**
 * Time, set types and warm-up come first because they decide how many exercises fit; the target tree
 * (full body > region > muscle) comes last and only allows selections that all fit in that capacity.
 */
export function CriteriaForm({ value, onChange, showFatigue = true, showTime = true }: {
  value: Criteria; onChange: (c: Criteria) => void; showFatigue?: boolean; showTime?: boolean;
}) {
  const capacity = exerciseCapacity(value);
  const change = (patch: Partial<Criteria>) => onChange(trimToCapacity({ ...value, ...patch }, exerciseCapacity({ ...value, ...patch })));
  const full = isFullBody(value);
  const regions = value.targetRegions ?? [];
  const chip = (on: boolean, label: string, onClick: () => void, next?: Criteria) => {
    const blocked = !on && !!next && !selectionFits(next, capacity);
    return (
      <button
        key={label} type="button" className={`chip ${on ? 'on' : ''}`} aria-pressed={on} disabled={blocked}
        title={blocked ? 'Not enough room in this workout for another target' : undefined} onClick={onClick}
      >
        {label}
      </button>
    );
  };
  const apply = (t: Pick<Criteria, 'targetMuscles' | 'targetRegions'>) => onChange({ ...value, ...t });

  return (
    <div className="stack">
      {showTime && (
        <label className="field">
          <span>Time available</span>
          <select value={value.maxMinutes ?? ''} onChange={(e) => change({ maxMinutes: e.target.value ? Number(e.target.value) : undefined })}>
            <option value="">Any (about 45 min)</option>
            {[15, 20, 30, 45, 60, 75, 90].map((m) => <option key={m} value={m}>{m} minutes</option>)}
          </select>
        </label>
      )}
      <fieldset>
        <legend>Set types <small>(select any combination)</small></legend>
        <Chips<SetType>
          label="Set types"
          options={(Object.keys(SET_TYPE_LABELS) as SetType[]).map((t) => ({ value: t, label: SET_TYPE_LABELS[t] }))}
          selected={value.setTypes}
          onToggle={(t) => change({ setTypes: toggle(value.setTypes, t) })}
        />
      </fieldset>
      <div className="row wrap">
        <label className="check">
          <input type="checkbox" checked={value.cardioWarmup} onChange={(e) => change({ cardioWarmup: e.target.checked })} />
          Cardio warm-up
        </label>
        {showFatigue && (
          <label className="check">
            <input type="checkbox" checked={value.useFatigue} onChange={(e) => onChange({ ...value, useFatigue: e.target.checked })} />
            Base on muscle fatigue
          </label>
        )}
      </div>
      <fieldset>
        <legend>Target muscles</legend>
        <p className="muted small">Room for about {capacity} exercise{capacity === 1 ? '' : 's'}, shared evenly between the selected regions.</p>
        <div className="chips" role="group" aria-label="Target muscles">
          {chip(full, 'Full body', () => apply(selectFullBody()))}
          <span className="chip-break" aria-hidden="true" />
          {REGIONS.map((r) => chip(regions.includes(r), REGION_LABELS[r], () => apply(toggleRegion(value, r)), { ...value, ...toggleRegion(value, r) }))}
          {REGIONS.map((r) => (
            <div className="chip-tier" key={r} data-region={r}>
              <span className="chip-tier-label">{REGION_LABELS[r]} muscles</span>
              {REGION_MUSCLES[r].map((m) => chip(
                value.targetMuscles.includes(m), MUSCLE_LABELS[m], () => apply(toggleMuscle(value, m)), { ...value, ...toggleMuscle(value, m) },
              ))}
            </div>
          ))}
        </div>
      </fieldset>
    </div>
  );
}

export const defaultCriteria = (): Criteria => ({
  targetMuscles: [], targetRegions: [], useFatigue: true, setTypes: ['regular'], cardioWarmup: false, maxMinutes: 45,
});
