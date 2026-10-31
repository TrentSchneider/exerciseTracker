import { useState } from 'react';
import { Link } from 'react-router-dom';
import { BodyDiagram, FatigueLegend } from '../components/BodyDiagram';
import { MuscleStatsPanel } from '../components/MuscleStatsPanel';
import { MUSCLES, MUSCLE_LABELS, type MuscleId } from '../../types';
import { useApp } from '../AppContext';

export function HomePage() {
  const app = useApp();
  const [selected, setSelected] = useState<MuscleId | null>(null);
  const fatigue = Object.fromEntries(MUSCLES.map((m) => [m, app.status[m].fatigue])) as Record<MuscleId, number>;

  return (
    <section className="stack">
      <h1>Muscle recovery</h1>
      {app.active && (
        <div className="card banner">
          <strong>Workout in progress: {app.active.name}</strong>
          <Link className="button primary" to="/workout">Resume</Link>
        </div>
      )}
      <div className="home-grid">
        <div className="card">
          <BodyDiagram fatigue={fatigue} selected={selected} onSelect={setSelected} />
          <FatigueLegend />
          <p className="muted small">Tap a muscle for details.</p>
        </div>
        <div className="stack">
          {selected ? (
            <MuscleStatsPanel status={app.status[selected]} onClose={() => setSelected(null)} />
          ) : (
            <div className="card">
              <h2>All muscles</h2>
              <ul className="list compact">
                {MUSCLES.map((m) => (
                  <li key={m}>
                    <button type="button" className="list-btn row-between" onClick={() => setSelected(m)}>
                      <span>{MUSCLE_LABELS[m]}</span>
                      <span>{Math.round(app.status[m].recovery)}% recovered</span>
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          )}
          <div className="row wrap">
            <Link className="button primary" to="/suggest">Suggest a workout</Link>
            <Link className="button" to="/build">Build workout</Link>
          </div>
        </div>
      </div>
    </section>
  );
}
