import { useState } from 'react';
import { formatDuration, formatWeight, type Units } from '../../domain/units';
import type { Exercise, SetLog } from '../../types';
import { NumberField, WeightField } from './Fields';

/** Whether this exercise's sets are counted in reps (as opposed to time only). */
export const isRepBased = (ex?: Exercise) => ex?.kind !== 'timed' && ex?.kind !== 'cardio';

export function formatSetValues(s: SetLog, ex: Exercise | undefined, units: Units): string {
  const parts: string[] = [];
  if (isRepBased(ex) && s.reps) parts.push(`${s.reps} reps`);
  if (ex?.kind !== 'cardio') parts.push(s.bodyweight ? (s.weightKg ? `BW + ${formatWeight(s.weightKg, units)}` : 'Bodyweight') : formatWeight(s.weightKg, units));
  if (s.durationSec) parts.push(formatDuration(s.durationSec));
  return parts.join(' · ');
}

/** Completed sets as a table with an Edit/Save toggle; Save reports the edited sets. */
export function SetsTable({ ex, sets, units, onSave }: {
  ex: Exercise | undefined; sets: SetLog[]; units: Units; onSave: (sets: SetLog[]) => void;
}) {
  const [draft, setDraft] = useState<SetLog[] | null>(null);
  const editing = draft !== null;
  const rows = draft ?? sets;
  const patch = (i: number, p: Partial<SetLog>) => setDraft((d) => (d ?? sets).map((s, idx) => (idx === i ? { ...s, ...p } : s)));
  const reps = isRepBased(ex);

  return (
    <div className="stack">
      <div className="row-between">
        <h3>Completed sets</h3>
        {editing ? (
          <button type="button" className="primary" onClick={() => { onSave(draft); setDraft(null); }}>Save</button>
        ) : (
          <button type="button" onClick={() => setDraft(sets.map((s) => ({ ...s })))}>Edit</button>
        )}
      </div>
      {rows.length === 0 ? <p className="muted">No sets completed yet.</p> : (
        <table className="sets">
          <thead><tr><th>Set</th><th>Reps</th><th>Weight</th><th>Time</th><th>Effort</th></tr></thead>
          <tbody>
            {rows.map((s, i) => (
              <tr key={i}>
                <td>{i + 1}</td>
                <td>
                  {!reps ? '—' : editing ? <NumberField hideLabel label={`Set ${i + 1} reps`} value={s.reps} onChange={(n) => patch(i, { reps: n })} /> : s.reps}
                </td>
                <td>
                  {editing && ex?.kind !== 'cardio' ? (
                    <WeightField hideLabel label={`Set ${i + 1} weight`} kg={s.weightKg} units={units} onChange={(kg) => patch(i, { weightKg: kg })} />
                  ) : s.bodyweight ? (s.weightKg ? `BW + ${formatWeight(s.weightKg, units)}` : 'Bodyweight') : formatWeight(s.weightKg, units)}
                </td>
                <td>
                  {editing && !reps ? (
                    <NumberField hideLabel label={`Set ${i + 1} time (s)`} value={s.durationSec} step={5} onChange={(n) => patch(i, { durationSec: n })} />
                  ) : s.durationSec ? formatDuration(s.durationSec) : '—'}
                </td>
                <td>
                  {editing ? <NumberField hideLabel label={`Set ${i + 1} effort`} value={s.effort} min={1} max={10} onChange={(n) => patch(i, { effort: Math.min(10, Math.max(1, n)) })} /> : `${s.effort}/10`}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
