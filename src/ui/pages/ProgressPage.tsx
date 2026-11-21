import { useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { muscleProgress, progressExerciseSeries, summarize, type ProgressPoint, type ProgressRange } from '../../domain/progress';
import { METRIC_LABELS, isWeightMetric, metricsFor, type Metric } from '../../domain/stats';
import { kgToDisplay } from '../../domain/units';
import { MUSCLES, MUSCLE_LABELS, type MuscleId, type SetType } from '../../types';
import { useApp } from '../AppContext';
import { SET_TYPE_LABELS } from '../components/Fields';
import { LineChart } from '../components/LineChart';

const ranges: { value: ProgressRange; label: string }[] = [
  { value: '4w', label: 'Last 4 weeks' }, { value: '12w', label: 'Last 12 weeks' },
  { value: '1y', label: 'Last year' }, { value: 'all', label: 'All time' },
];

function Summary({ points, format, effort = false }: { points: ProgressPoint[]; format: (n: number) => string; effort?: boolean }) {
  const summary = summarize(points);
  if (!summary) return <p className="muted">No comparable data in this range.</p>;
  return (
    <dl className="stats">
      <dt>Latest</dt><dd>{format(summary.latest)}</dd>
      <dt>{effort ? 'Highest' : 'Best'}</dt><dd>{format(summary.best)}</dd>
      <dt>First to latest</dt>
      <dd>{summary.change === null ? 'Not enough data' : `${summary.change > 0 ? '+' : ''}${format(summary.change)}${summary.percent === null ? ' (percentage unavailable for zero baseline)' : ` (${summary.percent > 0 ? '+' : ''}${summary.percent.toFixed(1)}%)`}`}</dd>
    </dl>
  );
}

function date(time: number): string {
  return new Date(time).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
}

export function ProgressPage() {
  const app = useApp();
  const [params, setParams] = useSearchParams();
  const [range, setRange] = useState<ProgressRange>('12w');
  const [metric, setMetric] = useState<Metric | ''>('');
  const [setType, setSetType] = useState<SetType | ''>('');
  const [muscleMetric, setMuscleMetric] = useState<'sets' | 'volume'>('sets');
  const [search, setSearch] = useState('');
  const view = params.get('view') === 'muscle' ? 'muscle' : 'exercise';
  const muscleParam = params.get('muscle');
  const muscle = MUSCLES.find((m) => m === muscleParam) ?? 'chest';
  const exercises = [...app.exercises].sort((a, b) => a.name.localeCompare(b.name));
  const recentId = app.sessions.flatMap((s) => s.exercises.filter((e) => !e.skipped && e.sets.length > 0).map((e) => e.exerciseId))
    .find((id) => app.exerciseById.has(id));
  const ex = exercises.find((e) => e.id === params.get('exercise')) ?? exercises.find((e) => e.id === recentId) ?? exercises[0];
  const options = exercises.filter((e) => e.id === ex?.id || e.name.toLowerCase().includes(search.trim().toLowerCase()));
  const now = Date.now();
  const units = app.settings.units;
  const setParam = (key: string, value: string) => {
    const next = new URLSearchParams(params);
    next.set(key, value);
    setParams(next);
  };
  const weight = (n: number) => kgToDisplay(n, units);
  const number = (n: number) => String(Math.round(n * 10) / 10);

  const metrics = ex ? metricsFor(ex) : [];
  if (ex?.kind === 'bodyweight') metrics.splice(3, 0, 'volume');
  const selectedMetric = metric && metrics.includes(metric) ? metric : metrics[0];
  const points = ex && selectedMetric ? progressExerciseSeries(ex, app.sessions, selectedMetric, range, now, setType || undefined) : [];
  const weightMetric = selectedMetric ? isWeightMetric(selectedMetric) : false;
  const formatExercise = (n: number) => `${number(weightMetric ? weight(n) : n)}${weightMetric ? ` ${units}` : ''}`;
  const chartPoints = points.map((p) => ({ ...p, y: weightMetric ? weight(p.y) : p.y }));
  const muscleData = muscleProgress(muscle, app.sessions, app.exercises, range, now);
  const musclePoints = muscleData.weeks.flatMap((w) => {
    const value = muscleMetric === 'sets' ? w.sets : w.volumeKg;
    return value === null ? [] : [{ x: w.start, y: value }];
  });
  const completePoints = musclePoints.filter((p) => muscleData.weeks.find((w) => w.start === p.x)?.complete);
  const muscleChartPoints = muscleData.weeks.flatMap((w, i) => {
    const value = muscleMetric === 'sets' ? w.sets : w.volumeKg;
    if (value === null) return [];
    return [{ x: w.start, y: muscleMetric === 'volume' ? weight(value) : value,
      breakBefore: muscleMetric === 'volume' && i > 0 && muscleData.weeks[i - 1].volumeKg === null }];
  });
  const formatMuscle = (n: number) => muscleMetric === 'volume' ? `${number(weight(n))} ${units}` : number(n);

  return (
    <section className="stack progress-page">
      <h1>Progress</h1>
      <p className="muted">Explore recorded performance and training workload; these do not measure muscle growth.</p>
      <div className="seg" role="group" aria-label="Progress view">
        <button type="button" className={`chip ${view === 'exercise' ? 'on' : ''}`} aria-pressed={view === 'exercise'} onClick={() => setParam('view', 'exercise')}>Exercise</button>
        <button type="button" className={`chip ${view === 'muscle' ? 'on' : ''}`} aria-pressed={view === 'muscle'} onClick={() => setParam('view', 'muscle')}>Muscle</button>
      </div>
      <label className="field inline"><span>Time range</span>
        <select value={range} onChange={(e) => setRange(e.target.value as ProgressRange)}>
          {ranges.map((r) => <option key={r.value} value={r.value}>{r.label}</option>)}
        </select>
      </label>
      {view === 'exercise' ? (
        <>
          <div className="progress-filters">
            <label className="field inline"><span>Search exercises</span><input type="search" value={search} onChange={(e) => setSearch(e.target.value)} /></label>
            <label className="field inline"><span>Exercise</span>
              <select value={ex?.id ?? ''} onChange={(e) => setParam('exercise', e.target.value)}>
                {options.map((e) => <option value={e.id} key={e.id}>{e.name}{e.inactive ? ' (inactive)' : ''}</option>)}
              </select>
            </label>
            <label className="field inline"><span>Metric</span>
              <select value={selectedMetric ?? ''} onChange={(e) => setMetric(e.target.value as Metric)}>
                {metrics.map((m) => <option key={m} value={m}>{m === 'volume' ? 'Added-load volume (reps × weight)' : METRIC_LABELS[m]}</option>)}
              </select>
            </label>
            <label className="field inline"><span>Set type</span>
              <select value={setType} onChange={(e) => setSetType(e.target.value as SetType | '')}>
                <option value="">All</option>
                {(Object.keys(SET_TYPE_LABELS) as SetType[]).map((t) => <option key={t} value={t}>{SET_TYPE_LABELS[t]}</option>)}
              </select>
            </label>
          </div>
          {ex && selectedMetric ? (
            <div className="card stack">
              <h2>{ex.name}: {selectedMetric === 'volume' ? 'Added-load volume' : METRIC_LABELS[selectedMetric]}</h2>
              <LineChart points={chartPoints} yLabel={`${METRIC_LABELS[selectedMetric]}${weightMetric ? ` (${units})` : ''}`} emptyMessage="No matching exercise data in this range." />
              <Summary points={points} format={formatExercise} effort={selectedMetric === 'effort'} />
              <h3>Recorded values</h3>
              {points.length ? <ul className="list compact" aria-label="Exercise recorded values">{points.map((p, i) => <li key={`${p.x}-${i}`}>{date(p.x)}: {formatExercise(p.y)}</li>)}</ul> : <p className="muted">No recorded values.</p>}
              <Link to={`/exercises/${ex.id}`}>Exercise details</Link>
            </div>
          ) : <p className="muted">No exercises available.</p>}
          <p className="hint">Volume uses logged added weight only; bodyweight is not included. Rep-based metrics exclude timed exercises and HIIT. Estimated 1-rep max is an approximation, not a measured lift. Effort is descriptive, not a score to maximize.</p>
        </>
      ) : (
        <>
          <div className="progress-filters">
            <label className="field inline"><span>Muscle</span>
              <select value={muscle} onChange={(e) => setParam('muscle', e.target.value as MuscleId)}>
                {MUSCLES.map((m) => <option key={m} value={m}>{MUSCLE_LABELS[m]}</option>)}
              </select>
            </label>
            <label className="field inline"><span>Metric</span>
              <select value={muscleMetric} onChange={(e) => setMuscleMetric(e.target.value as 'sets' | 'volume')}>
                <option value="sets">Sets per week</option><option value="volume">Added-load volume per week</option>
              </select>
            </label>
          </div>
          <div className="card stack">
            <h2>{MUSCLE_LABELS[muscle]} training</h2>
            <p>{muscleData.totalSets} {muscleData.totalSets === 1 ? 'set' : 'sets'} in range · Added-load volume: {muscleData.volumeKg === null ? 'Unavailable' : `${number(weight(muscleData.volumeKg))} ${units}`}</p>
            <LineChart points={muscleChartPoints} yLabel={muscleMetric === 'sets' ? 'Sets per week' : `Added-load volume per week (${units})`} emptyMessage="No matching muscle data in this range." />
            <h3>Complete-week comparison</h3>
            <Summary points={completePoints} format={formatMuscle} />
            <h3>Weekly values</h3>
            {muscleData.weeks.length ? <ul className="list compact" aria-label="Muscle weekly values">{muscleData.weeks.map((w) => {
              const value = muscleMetric === 'sets' ? w.sets : w.volumeKg;
              return <li key={w.start}>Week of {date(w.start)}{w.complete ? '' : ' (partial)'}: {value === null ? 'Unavailable' : formatMuscle(value)}</li>;
            })}</ul> : <p className="muted">No recorded sets in this range.</p>}
            <h3>Contributing exercises</h3>
            {muscleData.exercises.length ? <ul className="list compact">{muscleData.exercises.map((e) => <li key={e.id}><Link to={`/exercises/${e.id}`}>{app.exerciseById.get(e.id)?.name ?? e.id}</Link> — {e.sets} sets</li>)}</ul> : <p className="muted">No contributing exercises.</p>}
          </div>
          <p className="hint">Only primary muscles are counted, using current exercise definitions. A compound exercise may count for multiple muscles, so muscle totals are not unique workout totals. Added-load volume excludes bodyweight, timed exercises and HIIT; weeks containing only timed or HIIT work have unavailable volume and are omitted from the graph.</p>
        </>
      )}
    </section>
  );
}
