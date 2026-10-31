import { Icon } from '../components/Icon';
import { useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { formatDuration, formatWeight } from '../../domain/units';
import type { Session, SessionExercise } from '../../types';
import { useApp } from '../AppContext';
import { SET_TYPE_LABELS } from '../components/Fields';

const dateStr = (t: number) => new Date(t).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' });

export function sessionMatches(s: Session, q: string, nameOf: (id: string) => string): boolean {
  const needle = q.trim().toLowerCase();
  if (!needle) return true;
  const hay = [
    s.name, dateStr(s.completedAt), new Date(s.completedAt).toISOString().slice(0, 10),
    ...s.exercises.filter((e) => !e.skipped).map((e) => nameOf(e.exerciseId)),
  ].join(' ').toLowerCase();
  return needle.split(/\s+/).every((w) => hay.includes(w));
}

export function HistoryPage() {
  const app = useApp();
  const [q, setQ] = useState('');
  const nameOf = (id: string) => app.exerciseById.get(id)?.name ?? id;
  const list = useMemo(() => app.sessions.filter((s) => sessionMatches(s, q, nameOf)), [app.sessions, q, app.exerciseById]);

  return (
    <section className="stack">
      <h1>History</h1>
      <input type="search" placeholder="Search workouts, exercises, dates" aria-label="Search history" value={q} onChange={(e) => setQ(e.target.value)} />
      {list.length === 0 && <p className="muted">{app.sessions.length ? 'No workouts match your search.' : 'No completed workouts yet.'}</p>}
      <ul className="list">
        {list.map((s) => {
          const done = s.exercises.filter((e) => !e.skipped);
          return (
            <li key={s.id}>
              <Link className="card list-link" to={`/history/${s.id}`}>
                <strong>{s.name}</strong>
                <small>{dateStr(s.completedAt)} · {formatDuration(s.durationSec)} · {done.length} exercises{s.exercises.length > done.length ? ` (${s.exercises.length - done.length} skipped)` : ''}</small>
              </Link>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

function ExerciseSummary({ se }: { se: SessionExercise }) {
  const app = useApp();
  const ex = app.exerciseById.get(se.exerciseId);
  const units = app.settings.units;
  if (se.skipped) {
    return <li className="card"><strong>{ex?.name}</strong> <span className="badge">Skipped</span></li>;
  }
  const best = Math.max(...se.sets.map((s) => s.weightKg));
  const volume = se.sets.reduce((n, s) => n + s.reps * s.weightKg, 0);
  const avgEffort = se.sets.reduce((n, s) => n + s.effort, 0) / se.sets.length;
  return (
    <li className="card">
      <div className="row-between">
        <Link to={`/exercises/${se.exerciseId}`}><strong>{ex?.name ?? se.exerciseId}</strong></Link>
        <span className={`badge ${se.setType}`}>{SET_TYPE_LABELS[se.setType]}</span>
      </div>
      <table className="sets">
        <thead><tr><th>Set</th><th>Reps</th><th>Weight</th><th>Time</th><th>Effort</th></tr></thead>
        <tbody>
          {se.sets.map((s, i) => (
            <tr key={i}>
              <td>{i + 1}</td>
              <td>{ex?.kind === 'timed' || ex?.kind === 'cardio' ? '—' : s.reps}</td>
              <td>{s.bodyweight ? (s.weightKg ? `BW + ${formatWeight(s.weightKg, units)}` : 'Bodyweight') : formatWeight(s.weightKg, units)}</td>
              <td>{s.durationSec ? formatDuration(s.durationSec) : '—'}</td>
              <td>{s.effort}/10</td>
            </tr>
          ))}
        </tbody>
      </table>
      <small className="muted">
        {best > 0 ? `Top weight ${formatWeight(best, units)} · ` : ''}{volume > 0 ? `Volume ${formatWeight(volume, units)} · ` : ''}Avg effort {avgEffort.toFixed(1)}
      </small>
    </li>
  );
}

export function SessionDetailPage() {
  const { id } = useParams();
  const app = useApp();
  const nav = useNavigate();
  const s = app.sessions.find((x) => x.id === id);
  if (!s) return <section><h1>Workout not found</h1><Link to="/history">Back to history</Link></section>;
  return (
    <section className="stack">
      <Link to="/history"><Icon name="left" size={16} /> History</Link>
      <h1>{s.name}</h1>
      <p className="muted">{dateStr(s.completedAt)} · {formatDuration(s.durationSec)}</p>
      <ul className="list">{s.exercises.map((se) => <ExerciseSummary key={se.itemId} se={se} />)}</ul>
      <button type="button" onClick={async () => { if (window.confirm('Delete this workout from history? Muscle recovery and exercise progress will be recalculated.')) { await app.deleteSession(s.id); nav('/history'); } }}>
        Delete workout
      </button>
    </section>
  );
}
