import { Icon } from '../components/Icon';
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { generateWorkout } from '../../domain/generator';
import { WEEKDAYS, agenda, agendaForDate, dayWeekdays, generateForRoutineDay, monthGrid } from '../../domain/planner';
import { refreshRecommendations } from '../../domain/workout';
import { dateKey, uid } from '../../domain/units';
import type { Criteria, PlanEntry, Routine, RoutineDay } from '../../types';
import { useApp } from '../AppContext';
import { Chips, CriteriaForm, defaultCriteria } from '../components/Fields';
import { Modal } from '../components/Modal';

const prettyDate = (k: string) => new Date(`${k}T00:00:00`).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });

function recurrenceSummary(r: Routine): string {
  const range = `${r.startDate ? `from ${prettyDate(r.startDate)}` : ''}${r.endDate ? ` until ${prettyDate(r.endDate)}` : r.startDate ? ', no end date' : ''}`;
  const rot = r.rotate && r.frequency !== 'daily' ? 'Rotating — ' : '';
  const days = rot + (r.frequency === 'daily'
    ? `Daily: ${r.days.map((d) => d.label).join(' · ')}`
    : r.days.map((d) => `${dayWeekdays(d).map((w) => WEEKDAYS[w]).join('/')} ${d.label}`).join(' · '));
  return `${days}${range ? ` (${range})` : ''}`;
}

function RoutineEditor({ routine, onClose }: { routine: Routine; onClose: () => void }) {
  const app = useApp();
  const [r, setR] = useState<Routine>({ frequency: 'weekly', startDate: dateKey(new Date()), ...routine });
  const daily = r.frequency === 'daily';
  const badRange = !!r.endDate && !!r.startDate && r.endDate < r.startDate;
  const patchDay = (id: string, p: Partial<RoutineDay>) => setR({ ...r, days: r.days.map((d) => (d.id === id ? { ...d, ...p } : d)) });
  const addDay = () => setR({
    ...r,
    days: [...r.days, { id: uid('rd'), weekday: 1, label: `Day ${r.days.length + 1}`, targetMuscles: [], cardioWarmup: true, setTypes: ['regular'], maxMinutes: 45 }],
  });
  const asCriteria = (d: RoutineDay): Criteria => ({ targetMuscles: d.targetMuscles, targetRegions: d.targetRegions, useFatigue: false, setTypes: d.setTypes, cardioWarmup: d.cardioWarmup, maxMinutes: d.maxMinutes });

  return (
    <Modal title={routine.name ? 'Edit routine' : 'New routine'} onClose={onClose}>
      <div className="stack">
        <label className="field"><span>Routine name</span><input value={r.name} onChange={(e) => setR({ ...r, name: e.target.value })} /></label>
        <fieldset className="stack" data-testid="recurrence">
          <legend>Recurrence</legend>
          <div className="row wrap">
            <label className="field inline"><span>Repeats</span>
              <select value={r.frequency ?? 'weekly'} onChange={(e) => setR({ ...r, frequency: e.target.value as 'daily' | 'weekly' })}>
                <option value="daily">Daily</option>
                <option value="weekly">Weekly</option>
              </select>
            </label>
            <label className="field inline"><span>Start date</span>
              <input type="date" value={r.startDate ?? ''} onChange={(e) => setR({ ...r, startDate: e.target.value || undefined })} />
            </label>
            <label className="field inline"><span>End date</span>
              <input type="date" value={r.endDate ?? ''} disabled={!r.endDate} onChange={(e) => setR({ ...r, endDate: e.target.value || undefined })} />
            </label>
            <label className="check">
              <input
                type="checkbox" checked={!r.endDate}
                onChange={(e) => setR({ ...r, endDate: e.target.checked ? undefined : r.startDate ?? dateKey(new Date()) })}
              />
              No end date
            </label>
          </div>
          {badRange && <p className="warn" role="alert">The end date must be on or after the start date.</p>}
          {!daily && (
            <label className="check">
              <input type="checkbox" checked={!!r.rotate} onChange={(e) => setR({ ...r, rotate: e.target.checked })} />
              Rotate target groups
            </label>
          )}
          {!daily && r.rotate && (
            <p className="muted small">
              Days set to Full body rotate upper body, core, then lower body; days with two or three region groups rotate through those groups. Each occurrence of the day moves to the next group, continuing across weeks.
            </p>
          )}
          <p className="muted small">{daily ? 'Every training day below happens every day in this range.' : 'Choose the weekdays for each training day below.'}</p>
        </fieldset>
        {r.days.map((d) => (
          <div className="card stack" key={d.id} data-testid="routine-day">
            <div className="row wrap">
              {!daily && (
                <Chips<string>
                  label={`Days of the week for ${d.label}`}
                  options={WEEKDAYS.map((w, i) => ({ value: String(i), label: w }))}
                  selected={dayWeekdays(d).map(String)}
                  onToggle={(v) => {
                    const cur = dayWeekdays(d);
                    const n = Number(v);
                    const next = cur.includes(n) ? cur.filter((x) => x !== n) : [...cur, n].sort();
                    if (next.length) patchDay(d.id, { weekdays: next, weekday: next[0] });
                  }}
                />
              )}
              <label className="field inline"><span>Label</span><input value={d.label} onChange={(e) => patchDay(d.id, { label: e.target.value })} /></label>
              <button type="button" onClick={() => setR({ ...r, days: r.days.filter((x) => x.id !== d.id) })}>Remove day</button>
            </div>
            <CriteriaForm
              value={asCriteria(d)} showFatigue={false}
              onChange={(c) => patchDay(d.id, { targetMuscles: c.targetMuscles, targetRegions: c.targetRegions, setTypes: c.setTypes, cardioWarmup: c.cardioWarmup, maxMinutes: c.maxMinutes })}
            />
          </div>
        ))}
        <button type="button" onClick={addDay}>Add training day</button>
        <button
          type="button" className="primary" disabled={!r.name.trim() || r.days.length === 0 || badRange}
          onClick={async () => { await app.saveRoutine(r); onClose(); }}
        >
          Save routine
        </button>
      </div>
    </Modal>
  );
}

export function PlanPage() {
  const app = useApp();
  const nav = useNavigate();
  const [date, setDate] = useState(dateKey(new Date()));
  const [pick, setPick] = useState('');
  const [criteria, setCriteria] = useState(defaultCriteria());
  const [editing, setEditing] = useState<Routine | null>(null);
  const [notes, setNotes] = useState<string[]>([]);
  const days = agenda(new Date(), 14, app.plans, app.routines);
  const view = app.settings.plannerView ?? 'list';
  const [month, setMonth] = useState(() => { const n = new Date(); return new Date(n.getFullYear(), n.getMonth(), 1); });
  const selected = agendaForDate(new Date(`${date}T00:00:00`), app.plans, app.routines);

  const genInput = () => ({
    exercises: app.exercises, equipment: app.equipment, ownedEquipment: app.owned, sessions: app.sessions, status: app.status, restScale: app.settings.restScale,
  });

  const openEntry = (e: PlanEntry) => {
    const w = app.workouts.find((x) => x.id === e.workoutId);
    if (!w) return;
    app.setDraft(refreshRecommendations(w, app.exerciseById, app.sessions, app.settings.restScale, app.equipment));
    nav('/preview');
  };

  const addSaved = async () => {
    if (!pick) return;
    await app.savePlan({ id: uid('pl'), date, workoutId: pick });
  };

  const addSuggested = async () => {
    const { workout, notes } = generateWorkout({ ...genInput(), criteria });
    setNotes(notes);
    if (!workout.items.length) return;
    await app.saveWorkout(workout);
    await app.savePlan({ id: uid('pl'), date, workoutId: workout.id });
  };

  const openRoutineDay = (routine: Routine, day: RoutineDay) => {
    const { workout, notes } = generateForRoutineDay(day, routine.name, genInput());
    setNotes(notes);
    if (!workout.items.length) return;
    app.setDraft(workout);
    nav('/preview');
  };

  const dayItems = (d: ReturnType<typeof agendaForDate>) => (
    <>
      {d.entries.map((e) => (
        <div key={e.id} className="row wrap">
          <span>{app.workouts.find((w) => w.id === e.workoutId)?.name ?? 'Missing workout'}</span>
          <button type="button" onClick={() => openEntry(e)}>Open</button>
          <button type="button" aria-label="Remove from plan" onClick={() => app.deletePlan(e.id)}>Remove</button>
        </div>
      ))}
      {d.routineDays.map(({ routine, day }) => (
        <div key={`${routine.id}-${day.id}`} className="row wrap">
          <span>{routine.name}: {day.label} <small className="muted">(routine)</small></span>
          <button type="button" onClick={() => openRoutineDay(routine, day)}>Generate</button>
        </div>
      ))}
    </>
  );

  const todayKey = dateKey(new Date());
  const monthLabel = month.toLocaleDateString(undefined, { month: 'long', year: 'numeric' });
  const shiftMonth = (n: number) => setMonth(new Date(month.getFullYear(), month.getMonth() + n, 1));
  const selectedEmpty = !selected.entries.length && !selected.routineDays.length;

  return (
    <section className="stack">
      <div className="row-between">
        <h1>Planner</h1>
        <div className="seg" role="group" aria-label="Planner view">
          {(['list', 'calendar'] as const).map((v) => (
            <button
              key={v} type="button" className={`chip ${view === v ? 'on' : ''}`} aria-pressed={view === v}
              onClick={() => app.updateSettings({ plannerView: v })}
            >{v === 'list' ? 'Next 14 days' : 'Calendar'}</button>
          ))}
        </div>
      </div>
      {view === 'calendar' && (
        <div className="card stack" data-testid="calendar">
          <div className="row-between">
            <button type="button" aria-label="Previous month" onClick={() => shiftMonth(-1)}><Icon name="chevronLeft" /></button>
            <h2>{monthLabel}</h2>
            <button type="button" aria-label="Next month" onClick={() => shiftMonth(1)}><Icon name="chevronRight" /></button>
          </div>
          <div className="cal-grid" role="grid" aria-label={monthLabel}>
            {WEEKDAYS.map((w) => <div key={w} className="cal-head" role="columnheader">{w}</div>)}
            {monthGrid(month.getFullYear(), month.getMonth()).flat().map((d, i) => {
              if (!d) return <div key={`e${i}`} className="cal-cell blank" role="gridcell" />;
              const key = dateKey(d);
              const info = agendaForDate(d, app.plans, app.routines);
              const count = info.entries.length + info.routineDays.length;
              return (
                <button
                  key={key} type="button" role="gridcell" aria-selected={key === date}
                  aria-label={`${d.toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' })}${count ? `, ${count} workout${count === 1 ? '' : 's'}` : ''}`}
                  className={`cal-cell ${key === date ? 'selected' : ''} ${key === todayKey ? 'today' : ''} ${count ? 'has' : ''}`}
                  data-has-workouts={count > 0} onClick={() => setDate(key)}
                >
                  <span>{d.getDate()}</span>
                  {count > 0 && <span className="cal-dot" aria-hidden="true" />}
                </button>
              );
            })}
          </div>
          <div className="stack" data-testid="calendar-day">
            <h3>{prettyDate(date)}</h3>
            {selectedEmpty ? <p className="muted">No workouts planned. Add your first workout below.</p> : dayItems(selected)}
          </div>
        </div>
      )}
      <div className="card stack">
        <h2>{view === 'calendar' ? (selectedEmpty ? `Add a workout on ${prettyDate(date)}` : `Add another workout on ${prettyDate(date)}`) : 'Plan a workout'}</h2>
        <div className="row wrap">
          {view === 'list' && <label className="field inline"><span>Date</span><input type="date" value={date} onChange={(e) => setDate(e.target.value)} /></label>}
          <label className="field inline"><span>Saved workout</span>
            <select value={pick} onChange={(e) => setPick(e.target.value)}>
              <option value="">Choose…</option>
              {app.workouts.map((w) => <option key={w.id} value={w.id}>{w.name}</option>)}
            </select>
          </label>
          <button type="button" onClick={addSaved} disabled={!pick}>Add saved workout</button>
        </div>
        <details>
          <summary>Or plan a suggested workout</summary>
          <CriteriaForm value={criteria} onChange={setCriteria} />
          <button type="button" onClick={addSuggested}>Add suggested workout</button>
        </details>
        {notes.length > 0 && <ul className="warn" role="status">{notes.map((n) => <li key={n}>{n}</li>)}</ul>}
      </div>

      {view === 'list' && (
        <div className="card">
          <h2>Next 14 days</h2>
          <ul className="list" aria-label="Agenda">
            {days.map((d) => {
              const dt = new Date(`${d.date}T00:00:00`);
              const empty = !d.entries.length && !d.routineDays.length;
              return (
                <li key={d.date} className={`agenda-day ${empty ? 'empty' : ''}`}>
                  <strong>{WEEKDAYS[dt.getDay()]} {d.date.slice(5)}</strong>
                  {empty && <span className="muted">Rest day</span>}
                  {dayItems(d)}
                </li>
              );
            })}
          </ul>
        </div>
      )}

      <div className="card stack">
        <div className="row-between">
          <h2>Routines</h2>
          <button type="button" onClick={() => setEditing({ id: uid('ro'), name: '', active: true, days: [] })}>New routine</button>
        </div>
        {app.routines.length === 0 && <p className="muted">No routines yet.</p>}
        {app.routines.map((r) => (
          <div key={r.id} className="row wrap">
            <strong>{r.name}</strong>
            <small className="muted">{recurrenceSummary(r)}</small>
            <label className="check"><input type="checkbox" checked={r.active} onChange={(e) => app.saveRoutine({ ...r, active: e.target.checked })} /> Active</label>
            <button type="button" onClick={() => setEditing(r)}>Edit</button>
            <button type="button" onClick={() => window.confirm(`Delete routine "${r.name}"?`) && app.deleteRoutine(r.id)}>Delete</button>
          </div>
        ))}
      </div>
      {editing && <RoutineEditor routine={editing} onClose={() => setEditing(null)} />}
    </section>
  );
}
