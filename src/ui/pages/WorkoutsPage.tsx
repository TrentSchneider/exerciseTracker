import { Link, useNavigate } from 'react-router-dom';
import { estimateWorkoutMinutes } from '../../domain/workout';
import { refreshRecommendations } from '../../domain/workout';
import type { Workout } from '../../types';
import { useApp } from '../AppContext';

export function WorkoutsPage() {
  const app = useApp();
  const nav = useNavigate();

  const open = (w: Workout, to: string) => {
    app.setDraft(refreshRecommendations(w, app.exerciseById, app.sessions, app.settings.restScale, app.equipment));
    nav(to);
  };

  return (
    <section className="stack">
      <h1>Workouts</h1>
      <div className="row wrap">
        <Link className="button primary" to="/suggest">Suggest a workout</Link>
        <button type="button" onClick={() => { app.setDraft(null); nav('/build'); }}>Build custom workout</button>
      </div>
      <h2>Saved workouts</h2>
      {app.workouts.length === 0 && <p className="muted">Nothing saved yet.</p>}
      <ul className="list">
        {app.workouts.map((w) => (
          <li key={w.id} className="card">
            <strong>{w.name}</strong>
            <small>{w.items.length} exercises · about {estimateWorkoutMinutes(w.items, app.exerciseById)} min</small>
            <div className="row wrap">
              <button type="button" className="primary" onClick={() => open(w, '/preview')}>Preview & start</button>
              <button type="button" onClick={() => open(w, '/build')}>Edit</button>
              <button type="button" onClick={() => window.confirm(`Delete "${w.name}"?`) && app.deleteWorkout(w.id)}>Delete</button>
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}
