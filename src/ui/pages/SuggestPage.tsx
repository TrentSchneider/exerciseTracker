import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { generateWorkout } from '../../domain/generator';
import { useApp } from '../AppContext';
import { CriteriaForm, defaultCriteria } from '../components/Fields';

export function SuggestPage() {
  const app = useApp();
  const nav = useNavigate();
  const [criteria, setCriteria] = useState(defaultCriteria());
  const [notes, setNotes] = useState<string[]>([]);

  const go = () => {
    const { workout, notes } = generateWorkout({
      exercises: app.exercises, equipment: app.equipment, ownedEquipment: app.owned, criteria, sessions: app.sessions,
      status: app.status, restScale: app.settings.restScale,
    });
    setNotes(notes);
    if (workout.items.length) {
      app.setDraft(workout);
      nav('/preview');
    }
  };

  return (
    <section className="stack">
      <h1>Suggest a workout</h1>
      <p className="muted">
        Built from your equipment{criteria.useFatigue ? ' and current muscle recovery' : ''}. Combine any options below.
      </p>
      {app.owned.size === 0 && <p className="hint">You haven't registered any equipment, so only bodyweight exercises will be suggested.</p>}
      <CriteriaForm value={criteria} onChange={setCriteria} />
      <button type="button" className="primary" onClick={go}>Suggest workout</button>
      {notes.length > 0 && <ul role="status" className="warn">{notes.map((n) => <li key={n}>{n}</li>)}</ul>}
    </section>
  );
}
