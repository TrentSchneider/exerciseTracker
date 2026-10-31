import { Icon } from '../components/Icon';
import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { activeSeconds, currentStep, isLastStep, logSet, pauseSession, progress, resumeSession, skipExercise, undoSkip, type ActiveSession } from '../../domain/session';
import { formatDuration, formatWeight } from '../../domain/units';
import { primaryMuscles } from '../../domain/fatigue';
import { MUSCLE_LABELS, type Exercise, type PlanItem, type SetLog } from '../../types';
import { useApp } from '../AppContext';
import { Timer } from '../components/Timer';
import { ExerciseInfoModal } from '../components/ExerciseInfoModal';
import { NumberField, SET_TYPE_LABELS, WeightField } from '../components/Fields';
import { blockRest, blockTransition, buildBlocks } from '../../domain/workout';
import { WorkoutOverview } from '../components/WorkoutOverview';

// Not a native <button> so it stays usable inside the disabled (paused) fieldset: the guide is read-only.
function InfoLink({ ex, onOpen }: { ex: Exercise; onOpen: (e: Exercise) => void }) {
  return (
    <span
      role="button" tabIndex={0} className="link-btn" aria-label={`About ${ex.name}`}
      onClick={() => onOpen(ex)}
      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onOpen(ex); } }}
    >{ex.name}</span>
  );
}

function SetForm({ item, lastLog, paused, onLog, onSkip }: {
  item: PlanItem; lastLog?: SetLog; paused: boolean; onLog: (l: SetLog) => void; onSkip: () => void;
}) {
  const app = useApp();
  const ex = app.exerciseById.get(item.exerciseId)!;
  const timed = ex.kind === 'timed' || ex.kind === 'cardio' || item.setType === 'hiit';
  // HIIT is time based: no reps are asked for or shown.
  const repBased = (ex.kind === 'weighted' || ex.kind === 'bodyweight') && item.setType !== 'hiit';
  const [reps, setReps] = useState(lastLog?.reps ?? item.reps);
  const [weightKg, setWeightKg] = useState(lastLog?.weightKg ?? item.weightKg);
  const [bodyweight, setBodyweight] = useState(lastLog?.bodyweight ?? item.bodyweight);
  const [duration, setDuration] = useState(item.durationSec);
  const [effort, setEffort] = useState(lastLog?.effort ?? 7);
  const autoAdvance = item.setType === 'hiit' && !!app.settings.hiitAutoAdvance;
  const submit = (durationSec: number) => onLog({
    reps: repBased ? reps : item.setType === 'hiit' ? item.reps : 0,
    weightKg: bodyweight && ex.kind === 'weighted' ? 0 : weightKg, bodyweight,
    durationSec: timed ? durationSec : 0, effort, at: Date.now(),
  });

  return (
    <div className="stack" data-testid="set-form">
      {timed && (
        <Timer
          label={item.setType === 'hiit' ? 'Work interval' : 'Exercise timer'} seconds={item.durationSec} paused={paused}
          onDone={() => (autoAdvance ? submit(item.durationSec) : setDuration(item.durationSec))}
        />
      )}
      <div className="grid-2">
        {repBased && <NumberField label="Reps done" value={reps} min={0} onChange={setReps} />}
        {timed && <NumberField label="Time done (s)" value={duration} min={0} step={5} onChange={setDuration} />}
        {ex.kind !== 'cardio' && (
          <WeightField label={bodyweight ? 'Added weight' : 'Weight'} kg={weightKg} units={app.settings.units} onChange={setWeightKg} />
        )}
      </div>
      {ex.kind !== 'cardio' && (
        <label className="check">
          <input
            type="checkbox" checked={bodyweight}
            onChange={(e) => { setBodyweight(e.target.checked); if (e.target.checked && ex.kind === 'weighted') setWeightKg(0); }}
          />
          Used body weight
        </label>
      )}
      <label className="field">
        <span>Effort (RPE): {effort}/10</span>
        <input type="range" min={1} max={10} value={effort} onChange={(e) => setEffort(Number(e.target.value))} aria-label="Effort from 1 to 10" />
      </label>
      <div className="row wrap">
        <button
          type="button" className="primary"
          onClick={() => submit(duration)}
        >
          Complete set
        </button>
        <button type="button" onClick={onSkip}>Skip exercise</button>
      </div>
    </div>
  );
}

export function ActiveWorkoutPage() {
  const app = useApp();
  const nav = useNavigate();
  const a = app.active;
  const [rest, setRest] = useState<{ seconds: number; key: number; kind: 'set' | 'exercise' } | null>(null);
  const [elapsed, setElapsed] = useState(0);
  const [info, setInfo] = useState<Exercise | null>(null);
  const paused = !!a?.pausedAt;

  useEffect(() => {
    if (!a) return;
    const tick = () => setElapsed(activeSeconds(a));
    tick();
    const t = setInterval(tick, 1000);
    return () => clearInterval(t);
  }, [a]);

  if (!a) {
    return (
      <section className="stack">
        <h1>No workout in progress</h1>
        <Link className="button primary" to="/workouts">Pick a workout</Link>
      </section>
    );
  }

  const step = currentStep(a);
  const item = step ? a.items.find((i) => i.id === step.itemId) : undefined;
  const ex = item ? app.exerciseById.get(item.exerciseId) : undefined;
  const { done, total } = progress(a);
  const logged = Object.values(a.logs).reduce((n, l) => n + l.length, 0);

  const commit = (next: ActiveSession) => void app.setActive(next);

  const onLog = (log: SetLog) => {
    const last = isLastStep(a);
    // Read rests from the live items so edits made during the workout apply immediately.
    const block = buildBlocks(a.items).find((b) => b.some((i) => i.id === step!.itemId))!;
    const restAfter = step!.restAfter === 0 ? 0 : step!.restKind === 'set' ? blockRest(block) : blockTransition(block);
    commit(logSet(a, log));
    if (!last && restAfter > 0) setRest({ seconds: restAfter, key: Date.now(), kind: step!.restKind });
  };

  const finish = async () => {
    if (logged === 0) {
      if (!window.confirm('No sets were logged, so this workout will be discarded. Continue?')) return;
      await app.setActive(null);
      nav('/workouts');
      return;
    }
    const s = await app.finishActive(a);
    nav(`/history/${s.id}`);
  };

  const discard = async () => {
    if (!window.confirm('Discard this workout? Nothing will be saved.')) return;
    await app.setActive(null);
    nav('/');
  };

  const nextItem = () => {
    const i = a.steps.findIndex((s, idx) => idx >= a.cursor && !a.skipped.includes(s.itemId));
    return i >= 0 ? a.items.find((it) => it.id === a.steps[i].itemId) : undefined;
  };

  return (
    <section className="stack">
      <div className="row-between">
        <h1>{a.name}</h1>
        <div className="row">
          <span className="muted" aria-label="Elapsed time">{formatDuration(elapsed)}</span>
          <button type="button" onClick={() => commit(paused ? resumeSession(a) : pauseSession(a))}>
            {paused ? 'Resume workout' : 'Pause workout'}
          </button>
        </div>
      </div>
      {paused && (
        <div className="card paused-banner" role="status">
          <strong>Workout paused</strong>
          <p className="muted">The clock and any running timer are stopped. Resume when you're ready.</p>
        </div>
      )}
      <progress value={done} max={Math.max(1, total)} aria-label="Workout progress" />
      <p className="muted">{done} of {total} sets complete</p>

      <fieldset className="plain" disabled={paused}>
      {rest && step ? (
        <div className="card">
          <Timer key={rest.key} label="Rest" seconds={rest.seconds} autoStart paused={paused} onDone={() => setRest(null)} onSkip={() => setRest(null)} skipLabel="Skip rest" />
          <p className="hint">{rest.kind === 'set' ? 'Rest between sets/rounds' : 'Rest before the next exercise'}</p>
          {nextItem() && <p>Up next: <strong>{app.exerciseById.get(nextItem()!.exerciseId)?.name}</strong></p>}
        </div>
      ) : step && item && ex ? (
        <div className="card current" key={`${item.id}-${step.round}`}>
          <div className="row-between">
            <h2><InfoLink ex={ex} onOpen={setInfo} /></h2>
            <span className={`badge ${item.setType}`}>{SET_TYPE_LABELS[item.setType]}</span>
          </div>
          <p className="muted">{primaryMuscles(ex).map((m) => MUSCLE_LABELS[m]).join(', ')}</p>
          <p>
            {item.setType === 'regular' ? 'Set' : 'Round'} {step.round + 1} of {item.sets} — target{' '}
            {ex.kind === 'timed' || ex.kind === 'cardio' || item.setType === 'hiit' ? `${item.durationSec}s` : `${item.reps} reps`}
            {ex.kind !== 'cardio' && (item.bodyweight ? (item.weightKg ? ` @ BW + ${formatWeight(item.weightKg, app.settings.units)}` : ' @ bodyweight') : ` @ ${formatWeight(item.weightKg, app.settings.units)}`)}
          </p>
          <SetForm
            item={item} lastLog={a.logs[item.id]?.slice(-1)[0]} paused={paused} onLog={onLog}
            onSkip={() => { commit(skipExercise(a, item.id)); setRest(null); }}
          />
        </div>
      ) : (
        <div className="card">
          <h2>All done!</h2>
          <p>Finish to save this workout and update your muscle recovery.</p>
        </div>
      )}

      <div className="card">
        <h3>Exercises</h3>
        <WorkoutOverview
          items={a.items} byId={app.exerciseById} onChangeItems={(items) => commit({ ...a, items })}
          renderItem={(it, e) => {
            const n = a.logs[it.id]?.length ?? 0;
            const skipped = a.skipped.includes(it.id);
            return (
              <div className={`row-between active-item ${item?.id === it.id ? 'is-current' : ''}`}>
                <span className={skipped ? 'struck' : ''}>
                  {e ? <InfoLink ex={e} onOpen={setInfo} /> : it.exerciseId} <small>({n}/{it.sets})</small>
                </span>
                {skipped ? (
                  <button type="button" onClick={() => commit(undoSkip(a, it.id))}>Undo skip</button>
                ) : n < it.sets ? (
                  <button type="button" aria-label={`Skip ${e?.name}`} onClick={() => commit(skipExercise(a, it.id))}>Skip</button>
                ) : (
                  <span role="img" aria-label="done"><Icon name="check" size={16} /></span>
                )}
              </div>
            );
          }}
        />
      </div>

      </fieldset>

      <div className="row wrap">
        <button type="button" className="primary" onClick={finish}>Finish workout</button>
        <button type="button" onClick={discard}>Discard</button>
      </div>
      {info && <ExerciseInfoModal ex={info} onClose={() => setInfo(null)} />}
    </section>
  );
}
