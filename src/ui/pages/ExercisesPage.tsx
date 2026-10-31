import { Icon } from '../components/Icon';
import { useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { primaryMuscles } from '../../domain/fatigue';
import { hasEquipment } from '../../domain/generator';
import { recommend } from '../../domain/recommend';
import { METRIC_LABELS, exerciseSeries, isWeightMetric, metricsFor, type Metric } from '../../domain/stats';
import { formatWeight, kgToDisplay, uid } from '../../domain/units';
import { MUSCLES, MUSCLE_LABELS, type Exercise, type ExerciseKind, type MuscleId, type SetType } from '../../types';
import { useApp } from '../AppContext';
import { LineChart } from '../components/LineChart';
import { ExerciseGuide } from '../components/ExerciseGuide';
import { Modal } from '../components/Modal';
import { Chips, SET_TYPE_LABELS } from '../components/Fields';

function AddExercise({ onClose }: { onClose: () => void }) {
  const app = useApp();
  const [name, setName] = useState('');
  const [kind, setKind] = useState<ExerciseKind>('weighted');
  const [equip, setEquip] = useState<string[]>([]);
  const [primary, setPrimary] = useState<MuscleId[]>([]);
  const [secondary, setSecondary] = useState<MuscleId[]>([]);
  const toggle = <T,>(l: T[], v: T) => (l.includes(v) ? l.filter((x) => x !== v) : [...l, v]);
  const valid = name.trim() && primary.length > 0;

  const save = async () => {
    const muscles: Exercise['muscles'] = {};
    secondary.forEach((m) => (muscles[m] = 0.4));
    primary.forEach((m) => (muscles[m] = 1));
    await app.saveExercise({
      id: uid('ex'), name: name.trim(), kind, equipment: equip, muscles, custom: true,
      supersetOk: kind !== 'cardio', hiitOk: kind === 'bodyweight' || kind === 'cardio',
      repMin: kind === 'weighted' ? 8 : 10, repMax: kind === 'weighted' ? 12 : 20,
      defaultSeconds: kind === 'timed' ? 30 : kind === 'cardio' ? 60 : undefined,
      startKg: kind === 'weighted' ? 10 : undefined, restSec: kind === 'weighted' ? 75 : 45,
    });
    onClose();
  };

  return (
    <Modal title="Add custom exercise" onClose={onClose}>
      <div className="stack">
        <label className="field"><span>Name</span><input value={name} onChange={(e) => setName(e.target.value)} /></label>
        <label className="field"><span>Type</span>
          <select value={kind} onChange={(e) => setKind(e.target.value as ExerciseKind)}>
            <option value="weighted">Weighted (reps × weight)</option>
            <option value="bodyweight">Bodyweight (reps)</option>
            <option value="timed">Timed hold (e.g. plank)</option>
            <option value="cardio">Cardio (time)</option>
          </select>
        </label>
        <fieldset><legend>Equipment needed</legend>
          <Chips<string> label="Equipment needed" options={app.equipment.map((e) => ({ value: e.id, label: e.name }))} selected={equip} onToggle={(v) => setEquip(toggle(equip, v))} />
        </fieldset>
        <fieldset><legend>Primary muscles</legend>
          <Chips<MuscleId> label="Primary muscles" options={MUSCLES.map((m) => ({ value: m, label: MUSCLE_LABELS[m] }))} selected={primary} onToggle={(v) => setPrimary(toggle(primary, v))} />
        </fieldset>
        <fieldset><legend>Secondary muscles</legend>
          <Chips<MuscleId> label="Secondary muscles" options={MUSCLES.filter((m) => !primary.includes(m)).map((m) => ({ value: m, label: MUSCLE_LABELS[m] }))} selected={secondary} onToggle={(v) => setSecondary(toggle(secondary, v))} />
        </fieldset>
        <button type="button" className="primary" disabled={!valid} onClick={save}>Save exercise</button>
      </div>
    </Modal>
  );
}

export function ExercisesPage() {
  const app = useApp();
  const [q, setQ] = useState('');
  const [muscle, setMuscle] = useState('');
  const [onlyOwned, setOnlyOwned] = useState(false);
  const [adding, setAdding] = useState(false);
  const [status, setStatus] = useState<'all' | 'active' | 'inactive'>('all');
  const list = useMemo(
    () => app.exercises
      .filter((e) => e.name.toLowerCase().includes(q.toLowerCase())
        && (!muscle || primaryMuscles(e).includes(muscle as MuscleId))
        && (status === 'all' || (status === 'inactive') === !!e.inactive)
        && (!onlyOwned || hasEquipment(e, app.owned)))
      .sort((a, b) => a.name.localeCompare(b.name)),
    [app.exercises, app.owned, q, muscle, onlyOwned, status],
  );
  return (
    <section className="stack">
      <h1>Exercises</h1>
      <div className="row wrap">
        <input type="search" placeholder="Search exercises" aria-label="Search exercises" value={q} onChange={(e) => setQ(e.target.value)} />
        <select aria-label="Filter by muscle" value={muscle} onChange={(e) => setMuscle(e.target.value)}>
          <option value="">All muscles</option>
          {MUSCLES.map((m) => <option key={m} value={m}>{MUSCLE_LABELS[m]}</option>)}
        </select>
        <select aria-label="Filter by status" value={status} onChange={(e) => setStatus(e.target.value as 'all' | 'active' | 'inactive')}>
          <option value="all">Active and inactive</option>
          <option value="active">Active only</option>
          <option value="inactive">Inactive only</option>
        </select>
        <label className="check"><input type="checkbox" checked={onlyOwned} onChange={(e) => setOnlyOwned(e.target.checked)} /> My equipment only</label>
        <button type="button" onClick={() => setAdding(true)}>Add custom exercise</button>
      </div>
      <ul className="list">
        {list.map((e) => (
          <li key={e.id} className="row ex-row">
            <label className="check" title="Active exercises are used when workouts are generated">
              <input
                type="checkbox" aria-label={`Active: ${e.name}`} checked={!e.inactive}
                onChange={(ev) => app.saveExercise({ ...e, inactive: !ev.target.checked })}
              />
            </label>
            <Link className={`card list-link ${e.inactive ? 'inactive' : ''}`} to={`/exercises/${e.id}`}>
              <strong>{e.name}</strong>
              <small>{primaryMuscles(e).map((m) => MUSCLE_LABELS[m]).join(', ')} · {e.equipment.length ? e.equipment.map((id) => app.equipment.find((x) => x.id === id)?.name ?? id).join(', ') : 'No equipment'}</small>
            </Link>
          </li>
        ))}
      </ul>
      {adding && <AddExercise onClose={() => setAdding(false)} />}
    </section>
  );
}

export function ExerciseDetailPage() {
  const { id } = useParams();
  const app = useApp();
  const ex = id ? app.exerciseById.get(id) : undefined;
  const [setType, setSetType] = useState<SetType | ''>('');
  const [metric, setMetric] = useState<Metric | ''>('');
  if (!ex) return <section><h1>Exercise not found</h1><Link to="/exercises">Back</Link></section>;
  const metrics = metricsFor(ex);
  const m = metric && metrics.includes(metric) ? metric : metrics[0];
  const units = app.settings.units;
  const points = exerciseSeries(ex.id, app.sessions, m, setType || undefined);
  const display = points.map((p) => ({ x: p.x, y: isWeightMetric(m) ? kgToDisplay(p.y, units) : p.y }));
  const yLabel = isWeightMetric(m) ? `${METRIC_LABELS[m]} (${units})` : METRIC_LABELS[m];

  return (
    <section className="stack">
      <Link to="/exercises"><Icon name="left" size={16} /> All exercises</Link>
      <h1>{ex.name}</h1>
      <p className="muted">{primaryMuscles(ex).map((x) => MUSCLE_LABELS[x]).join(', ')}</p>
      <label className="check">
        <input type="checkbox" checked={!ex.inactive} onChange={(e) => app.saveExercise({ ...ex, inactive: !e.target.checked })} />
        Active (include in generated workouts)
      </label>
      <div className="row wrap">
        <label className="field inline"><span>Metric</span>
          <select value={m} onChange={(e) => setMetric(e.target.value as Metric)}>
            {metrics.map((x) => <option key={x} value={x}>{METRIC_LABELS[x]}</option>)}
          </select>
        </label>
        <label className="field inline"><span>Set type</span>
          <select value={setType} onChange={(e) => setSetType(e.target.value as SetType | '')}>
            <option value="">All</option>
            {(Object.keys(SET_TYPE_LABELS) as SetType[]).map((t) => <option key={t} value={t}>{SET_TYPE_LABELS[t]}</option>)}
          </select>
        </label>
      </div>
      <div className="card"><LineChart points={display} yLabel={yLabel} /></div>
      <h2>Next-session suggestions</h2>
      <div className="grid-3">
        {(Object.keys(SET_TYPE_LABELS) as SetType[]).filter((t) => (t === 'superset' ? ex.supersetOk : t === 'hiit' ? ex.hiitOk : true)).map((t) => {
          const r = recommend(ex, t, app.sessions, app.settings.restScale, Date.now(), app.equipment);
          return (
            <div className="card" key={t} data-testid={`rec-${t}`}>
              <strong>{SET_TYPE_LABELS[t]}</strong>
              <div>
                {ex.kind === 'timed' || ex.kind === 'cardio' || t === 'hiit' ? `${r.durationSec}s` : `${r.reps} reps`}
                {ex.kind !== 'cardio' && ` · ${r.bodyweight ? (r.weightKg ? `BW + ${formatWeight(r.weightKg, units)}` : 'Bodyweight') : formatWeight(r.weightKg, units)}`}
              </div>
              <small className="muted">{r.reason}</small>
            </div>
          );
        })}
      </div>
      <ExerciseGuide ex={ex} />
    </section>
  );
}
