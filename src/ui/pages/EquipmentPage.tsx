import { useEffect, useState } from 'react';
import { displayToKg, kgToDisplay } from '../../domain/units';
import type { Equipment } from '../../types';
import { useApp } from '../AppContext';

const WEIGHT_EQUIPMENT_IDS = new Set(['dumbbell', 'barbell', 'cable', 'bands', 'kettlebell', 'leg_press']);

function WeightOptionsEditor({ equipment }: { equipment: Equipment }) {
  const app = useApp();
  const [text, setText] = useState('');
  const [error, setError] = useState('');
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    setText((equipment.weightOptionsKg ?? []).map((kg) => String(kgToDisplay(kg, app.settings.units))).join(', '));
  }, [equipment.weightOptionsKg, app.settings.units]);

  const save = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const values = text.trim() ? text.split(',').map((part) => Number(part.trim())) : [];
    if (values.some((value) => !Number.isFinite(value) || value <= 0)) {
      setError('Enter positive weights separated by commas, or leave the field blank to clear them.');
      setSaved(false);
      return;
    }
    await app.setEquipmentWeightOptions(
      equipment.id,
      [...new Set(values.map((value) => displayToKg(value, app.settings.units)))].sort((a, b) => a - b),
    );
    setError('');
    setSaved(true);
  };

  return (
    <details className="equipment-weights">
      <summary>Available weights (optional)</summary>
      <form className="stack" onSubmit={save}>
        <label className="field">
          <span>Weights in {app.settings.units}, separated by commas</span>
          <input
            type="text"
            inputMode="decimal"
            aria-label={`${equipment.name} available weights`}
            placeholder={app.settings.units === 'lb' ? 'e.g. 5, 10, 15' : 'e.g. 2.5, 5, 7.5'}
            value={text}
            onChange={(event) => { setText(event.target.value); setError(''); setSaved(false); }}
          />
        </label>
        <p className="hint">
          Suggestions for exercises using this equipment will use only these weights.
          For dumbbells, enter the weight of one dumbbell; for barbells, enter the total loaded bar weight.
        </p>
        <div className="row">
          <button type="submit">Save weights</button>
          {saved && <span role="status" className="ok small">Weights saved.</span>}
        </div>
        {error && <p role="alert" className="error">{error}</p>}
      </form>
    </details>
  );
}

export function EquipmentPage() {
  const app = useApp();
  const [name, setName] = useState('');
  return (
    <section className="stack">
      <h1>My equipment</h1>
      <p className="muted">Workouts are suggested and swapped using only the equipment you check here. Bodyweight exercises are always available.</p>
      <ul className="list">
        {app.equipment.map((e) => (
          <li key={e.id}>
            <label className="check card">
              <input type="checkbox" checked={e.owned} onChange={(ev) => app.setEquipmentOwned(e.id, ev.target.checked)} />
              {e.name}{e.custom ? ' (custom)' : ''}
            </label>
            {e.owned && (e.custom || WEIGHT_EQUIPMENT_IDS.has(e.id)) && <WeightOptionsEditor equipment={e} />}
          </li>
        ))}
      </ul>
      <form
        className="row"
        onSubmit={(ev) => {
          ev.preventDefault();
          if (!name.trim()) return;
          void app.addEquipment(name);
          setName('');
        }}
      >
        <input placeholder="Add other equipment" aria-label="New equipment name" value={name} onChange={(e) => setName(e.target.value)} />
        <button type="submit">Add</button>
      </form>
    </section>
  );
}
