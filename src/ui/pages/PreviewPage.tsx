import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { applyRecommendation, recommend } from '../../domain/recommend';
import { swapCandidates } from '../../domain/generator';
import { estimateWorkoutMinutes, itemSummary, syncBlockRest } from '../../domain/workout';
import { startSession } from '../../domain/session';
import { dateKey, formatWeight, uid } from '../../domain/units';
import { primaryMuscles } from '../../domain/fatigue';
import { MUSCLE_LABELS, type Exercise, type PlanItem, type Workout } from '../../types';
import { useApp } from '../AppContext';
import { Modal } from '../components/Modal';
import { ExerciseGuide } from '../components/ExerciseGuide';
import { WorkoutOverview } from '../components/WorkoutOverview';
import { NumberField, SET_TYPE_LABELS, WeightField } from '../components/Fields';

export function itemLoad(item: PlanItem, ex: Exercise | undefined, units: 'lb' | 'kg'): string {
  if (ex && (ex.kind === 'timed' || ex.kind === 'cardio')) return item.weightKg > 0 ? `+${formatWeight(item.weightKg, units)}` : '';
  if (item.bodyweight) return item.weightKg > 0 ? `Bodyweight + ${formatWeight(item.weightKg, units)}` : 'Bodyweight';
  return formatWeight(item.weightKg, units);
}

function ItemEditor({ workout, item, onChange, onClose }: {
  workout: Workout; item: PlanItem; onChange: (i: PlanItem) => void; onClose: () => void;
}) {
  const app = useApp();
  const ex = app.exerciseById.get(item.exerciseId)!;
  const [draft, setDraft] = useState(item);
  const timed = ex.kind === 'timed' || ex.kind === 'cardio' || draft.setType === 'hiit';
  const candidates = swapCandidates(workout, item, app.exercises, app.owned, app.status);
  const rec = recommend(ex, item.setType, app.sessions, app.settings.restScale, Date.now(), app.equipment);

  const swap = (next: Exercise) => {
    const base: PlanItem = { ...item, exerciseId: next.id, manual: false };
    onChange(applyRecommendation(base, next, app.sessions, app.settings.restScale, Date.now(), app.equipment));
    onClose();
  };

  return (
    <Modal title={ex.name} onClose={onClose}>
      <p className="muted">{SET_TYPE_LABELS[item.setType]} · {primaryMuscles(ex).map((m) => MUSCLE_LABELS[m]).join(', ')}</p>
      <p className="hint">Suggestion: {rec.reason}</p>
      <div className="grid-2">
        <NumberField label={item.setType === 'regular' ? 'Sets' : 'Rounds'} value={draft.sets} min={1} onChange={(sets) => setDraft({ ...draft, sets })} />
        {!timed && <NumberField label="Reps" value={draft.reps} min={1} onChange={(reps) => setDraft({ ...draft, reps })} />}
        {timed && draft.setType !== 'hiit' && <NumberField label="Time (seconds)" value={draft.durationSec} min={5} step={5} onChange={(durationSec) => setDraft({ ...draft, durationSec })} />}
        {ex.kind !== 'cardio' && (
          <WeightField label={draft.bodyweight ? 'Added weight' : 'Weight'} kg={draft.weightKg} units={app.settings.units} onChange={(weightKg) => setDraft({ ...draft, weightKg })} />
        )}
      </div>
      {ex.kind === 'weighted' && (
        <label className="check">
          <input type="checkbox" checked={draft.bodyweight} onChange={(e) => setDraft({ ...draft, bodyweight: e.target.checked, weightKg: e.target.checked ? 0 : draft.weightKg })} />
          Use body weight instead of external weight
        </label>
      )}
      <div className="row">
        <button type="button" className="primary" onClick={() => { onChange({ ...draft, manual: true }); onClose(); }}>Apply</button>
        <button type="button" onClick={() => { onChange(applyRecommendation({ ...item, manual: false }, ex, app.sessions, app.settings.restScale, Date.now(), app.equipment)); onClose(); }}>Reset to suggestion</button>
      </div>
      <p className="hint">Rest timers{item.setType === 'hiit' ? ' and the HIIT work time (the same for every exercise in the set)' : ''} are edited on the workout overview.</p>
      <ExerciseGuide ex={ex} />
      <h3>Swap exercise</h3>
      {candidates.length === 0 ? (
        <p className="muted">No other exercises match this workout's criteria and your equipment.</p>
      ) : (
        <ul className="list" aria-label="Swap candidates">
          {candidates.map((c) => (
            <li key={c.id}>
              <button type="button" className="list-btn" onClick={() => swap(c)}>
                <strong>{c.name}</strong>
                <small>{primaryMuscles(c).map((m) => MUSCLE_LABELS[m]).join(', ')}</small>
              </button>
            </li>
          ))}
        </ul>
      )}
    </Modal>
  );
}

export function PreviewPage() {
  const app = useApp();
  const nav = useNavigate();
  const { draft, setDraft } = app;
  const [editing, setEditing] = useState<string | null>(null);
  const [date, setDate] = useState(dateKey(new Date()));
  const [msg, setMsg] = useState('');

  useEffect(() => {
    if (!draft) nav('/workouts', { replace: true });
  }, [draft, nav]);
  if (!draft) return null;

  const update = (items: PlanItem[]) => setDraft({ ...draft, items: syncBlockRest(items) });
  const editingItem = draft.items.find((i) => i.id === editing);
  const minutes = estimateWorkoutMinutes(draft.items, app.exerciseById);

  const start = async () => {
    await app.setActive(startSession(draft));
    nav('/workout');
  };
  const save = async () => {
    await app.saveWorkout(draft);
    setMsg('Workout saved.');
  };
  const schedule = async () => {
    await app.saveWorkout(draft);
    await app.savePlan({ id: uid('pl'), date, workoutId: draft.id });
    setMsg(`Scheduled for ${date}.`);
  };

  return (
    <section className="stack">
      <h1>Workout overview</h1>
      <label className="field">
        <span>Name</span>
        <input value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} />
      </label>
      <p className="muted">{draft.items.length} exercises · about {minutes} min{draft.criteria?.maxMinutes ? ` (target ${draft.criteria.maxMinutes})` : ''}</p>
      <WorkoutOverview
        items={draft.items} byId={app.exerciseById} onChangeItems={update}
        renderItem={(it, ex) => (
          <button type="button" className="list-btn" onClick={() => setEditing(it.id)} aria-label={`Edit ${ex?.name}`}>
            <strong>{ex?.name ?? it.exerciseId}</strong>
            <span className={`badge ${it.setType}`}>{SET_TYPE_LABELS[it.setType]}</span>
            <span>{itemSummary(it, ex)}</span>
            <span className="load">{itemLoad(it, ex, app.settings.units)}</span>
          </button>
        )}
      />
      {draft.items.length === 0 && <p className="muted">This workout is empty.</p>}
      <div className="row wrap">
        <button type="button" className="primary" onClick={start} disabled={draft.items.length === 0}>Start workout</button>
        <button type="button" onClick={save}>Save workout</button>
        <button type="button" onClick={() => nav('/build')}>Edit exercises</button>
      </div>
      <div className="row wrap">
        <label className="field inline"><span>Schedule on</span>
          <input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
        </label>
        <button type="button" onClick={schedule}>Add to planner</button>
      </div>
      {msg && <p role="status" className="ok">{msg}</p>}
      {editingItem && (
        <ItemEditor
          workout={draft} item={editingItem} onClose={() => setEditing(null)}
          onChange={(next) => update(draft.items.map((i) => (i.id === next.id ? next : i)))}
        />
      )}
    </section>
  );
}
