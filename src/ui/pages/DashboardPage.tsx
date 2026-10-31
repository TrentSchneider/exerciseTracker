import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { generateWorkout } from '../../domain/generator';
import { agenda, generateForRoutineDay } from '../../domain/planner';
import { dateKey, formatDuration } from '../../domain/units';
import { refreshRecommendations } from '../../domain/workout';
import { MUSCLES, MUSCLE_LABELS, type PlanEntry, type Routine, type RoutineDay } from '../../types';
import { useApp } from '../AppContext';
import { defaultCriteria } from '../components/Fields';
import { GettingStarted } from '../components/GettingStarted';
import { Icon } from '../components/Icon';
import { Modal } from '../components/Modal';

const dayLabel = (key: string, today: string) =>
  key === today ? 'Today' : new Date(`${key}T00:00:00`).toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' });

export function DashboardPage() {
  const app = useApp();
  const nav = useNavigate();
  const [guide, setGuide] = useState(false);
  const [note, setNote] = useState('');
  const today = dateKey(new Date());
  const days = agenda(new Date(), 8, app.plans, app.routines);
  const [todayAgenda, ...rest] = days;
  const upcoming = rest.filter((d) => d.entries.length || d.routineDays.length).slice(0, 3);
  const todayCount = todayAgenda.entries.length + todayAgenda.routineDays.length;

  const genInput = () => ({
    exercises: app.exercises, equipment: app.equipment, ownedEquipment: app.owned, sessions: app.sessions, status: app.status, restScale: app.settings.restScale,
  });
  const openEntry = (e: PlanEntry) => {
    const w = app.workouts.find((x) => x.id === e.workoutId);
    if (!w) return;
    app.setDraft(refreshRecommendations(w, app.exerciseById, app.sessions, app.settings.restScale, app.equipment));
    nav('/preview');
  };
  const openRoutineDay = (routine: Routine, day: RoutineDay) => {
    const { workout, notes } = generateForRoutineDay(day, routine.name, genInput());
    if (!workout.items.length) return setNote(notes[0] ?? 'Could not build that workout with your current equipment.');
    app.setDraft(workout);
    nav('/preview');
  };
  const quickWorkout = () => {
    const { workout, notes } = generateWorkout({ ...genInput(), criteria: defaultCriteria() });
    if (!workout.items.length) return setNote(notes[0] ?? 'Could not build a workout with your current equipment.');
    app.setDraft(workout);
    nav('/preview');
  };

  const sorted = MUSCLES.map((m) => app.status[m]);
  const fatigued = [...sorted].sort((a, b) => b.fatigue - a.fatigue).filter((s) => s.fatigue >= 5).slice(0, 4);
  const ready = [...sorted].sort((a, b) => b.recovery - a.recovery).slice(0, 4);
  const avgRecovery = Math.round(sorted.reduce((t, s) => t + s.recovery, 0) / sorted.length);
  const weekAgo = Date.now() - 7 * 86400000;
  const weekSessions = app.sessions.filter((s) => s.completedAt >= weekAgo);
  const last = [...app.sessions].sort((a, b) => b.completedAt - a.completedAt)[0];
  const weekSets = weekSessions.reduce((t, s) => t + s.exercises.filter((e) => !e.skipped).reduce((n, e) => n + e.sets.length, 0), 0);

  return (
    <section className="stack dashboard">
      <h1>Dashboard</h1>

      {!app.settings.welcomeDismissed && (
        <header className="landing-hero welcome-card">
          <button type="button" className="welcome-close" aria-label="Close welcome card" onClick={() => app.updateSettings({ welcomeDismissed: true })}>
            <Icon name="close" />
          </button>
          <p className="landing-eyebrow">A workout tracker that adapts to you</p>
          <h2>Your training, your equipment, your progress.</h2>
          <p className="landing-lede">
            Build workouts that fit your goals and gear. Track every set, see how your muscles recover,
            and get recommendations that adapt as you train.
          </p>
          <div className="row wrap">
            <button type="button" className="primary" onClick={() => setGuide(true)}>Getting Started</button>
          </div>
        </header>
      )}

      {app.active && (
        <div className="card banner">
          <strong>Workout in progress: {app.active.name}</strong>
          <Link className="button primary" to="/workout">Resume</Link>
        </div>
      )}

      <div className="dash-grid">
        <div className="card stack dash-wide" aria-labelledby="dash-today">
          <h2 id="dash-today">Today's workouts</h2>
          {todayCount === 0 ? (
            <p className="muted">Nothing is scheduled for today. <Link to="/plan">Open the planner</Link> or start something below.</p>
          ) : (
            <ul className="dash-list">
              {todayAgenda.entries.map((e) => (
                <li key={e.id} className="dash-item planned">
                  <div className="dash-item-main">
                    <span className="dash-tag">Planned</span>
                    <strong>{app.workouts.find((w) => w.id === e.workoutId)?.name ?? 'Missing workout'}</strong>
                  </div>
                  <button type="button" className="primary" onClick={() => openEntry(e)}>Open</button>
                </li>
              ))}
              {todayAgenda.routineDays.map(({ routine, day }) => (
                <li key={`${routine.id}-${day.id}`} className="dash-item routine">
                  <div className="dash-item-main">
                    <span className="dash-tag">Routine</span>
                    <strong>{day.label}</strong>
                    <span className="muted small">{routine.name}</span>
                  </div>
                  <button type="button" className="primary" onClick={() => openRoutineDay(routine, day)}>Generate</button>
                </li>
              ))}
            </ul>
          )}
          {upcoming.length > 0 && (
            <div className="dash-upcoming">
              <h3>Coming up</h3>
              <ul className="dash-list">
                {upcoming.map((d) => (
                  <li key={d.date} className="dash-item upcoming">
                    <span className="dash-date">{dayLabel(d.date, today)}</span>
                    <span className="small">
                      {[...d.entries.map((e) => app.workouts.find((w) => w.id === e.workoutId)?.name ?? 'Workout'), ...d.routineDays.map((r) => r.day.label)].join(', ')}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )}
          <Link to="/plan">View planner</Link>
        </div>

        <div className="card stack dash-wide" aria-labelledby="dash-quick">
          <h2 id="dash-quick">Start a workout</h2>
          <div className="row wrap">
            <button type="button" className="primary" onClick={quickWorkout}>Quick suggested workout</button>
            <Link className="button" to="/suggest">Suggest a workout…</Link>
            <Link className="button" to="/build">Build a custom workout</Link>
            <Link className="button" to="/workouts">My saved workouts</Link>
          </div>
          {note && <p className="warn" role="alert">{note}</p>}
        </div>

        <div className="card stack" aria-labelledby="dash-recovery">
          <h2 id="dash-recovery">Recovery</h2>
          <p><strong>{avgRecovery}%</strong> average recovery</p>
          {fatigued.length > 0 && (
            <div>
              <h3>Most fatigued</h3>
              <ul className="list compact">
                {fatigued.map((s) => (
                  <li key={s.muscle} className="row-between"><span>{MUSCLE_LABELS[s.muscle]}</span><span>{Math.round(s.recovery)}% recovered</span></li>
                ))}
              </ul>
            </div>
          )}
          <div>
            <h3>Ready to train</h3>
            <p className="muted">{ready.map((s) => MUSCLE_LABELS[s.muscle]).join(', ')}</p>
          </div>
          <Link to="/recovery">Open recovery map</Link>
        </div>

        <div className="card stack" aria-labelledby="dash-activity">
          <h2 id="dash-activity">Activity</h2>
          <div className="stat-row">
            <div><strong>{weekSessions.length}</strong><span className="muted small">workouts, last 7 days</span></div>
            <div><strong>{weekSets}</strong><span className="muted small">sets logged</span></div>
          </div>
          {last ? (
            <p>
              Last workout: <Link to={`/history/${last.id}`}>{last.name}</Link>{' '}
              <span className="muted small">{new Date(last.completedAt).toLocaleDateString()} · {formatDuration(last.durationSec)}</span>
            </p>
          ) : (
            <p className="muted">No workouts logged yet.</p>
          )}
          <Link to="/history">View history</Link>
        </div>
      </div>

      {guide && (
        <Modal title="Getting Started" onClose={() => setGuide(false)}>
          <GettingStarted onNavigate={() => setGuide(false)} />
        </Modal>
      )}
    </section>
  );
}
