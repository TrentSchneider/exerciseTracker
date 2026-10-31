import { Link } from 'react-router-dom';
import { Icon } from './Icon';
import { MUSCLE_LABELS } from '../../types';
import { fatigueColor, type MuscleStatus } from '../../domain/fatigue';
import { formatWeight } from '../../domain/units';
import { useApp } from '../AppContext';

export function MuscleStatsPanel({ status, onClose }: { status: MuscleStatus; onClose: () => void }) {
  const app = useApp();
  const hours = Math.ceil(status.hoursToRecovered);
  return (
    <div className="card" aria-label={`${MUSCLE_LABELS[status.muscle]} stats`}>
      <div className="row-between">
        <h2>{MUSCLE_LABELS[status.muscle]}</h2>
        <button type="button" onClick={onClose} aria-label="Close muscle stats"><Icon name="close" /></button>
      </div>
      <div className="meter" role="img" aria-label={`${Math.round(status.recovery)}% recovered`}>
        <div style={{ width: `${status.recovery}%`, background: fatigueColor(status.fatigue) }} />
      </div>
      <dl className="stats">
        <dt>Recovery</dt><dd>{Math.round(status.recovery)}%</dd>
        <dt>Fatigue</dt><dd>{Math.round(status.fatigue)}%</dd>
        <dt>Last trained</dt><dd>{status.lastTrained ? new Date(status.lastTrained).toLocaleString() : 'Never'}</dd>
        <dt>Fully recovered in</dt><dd>{hours <= 0 ? 'Now' : hours >= 48 ? `${Math.round(hours / 24)} days` : `${hours} h`}</dd>
        <dt>Sets (7 days)</dt>
        <dd>{status.sets7d.regular} regular · {status.sets7d.superset} superset · {status.sets7d.hiit} HIIT</dd>
        <dt>Volume (7 days)</dt><dd>{formatWeight(status.volume7dKg, app.settings.units)}</dd>
      </dl>
      {status.topExercises.length > 0 && (
        <>
          <h3>Most used exercises (7 days)</h3>
          <ul className="list compact">
            {status.topExercises.map((t) => (
              <li key={t.exerciseId}>
                <Link to={`/exercises/${t.exerciseId}`}>{app.exerciseById.get(t.exerciseId)?.name ?? t.exerciseId}</Link> — {t.sets} sets
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  );
}
