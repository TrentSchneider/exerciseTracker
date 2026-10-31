import { useEffect, useState } from 'react';
import { displayToKg, kgToDisplay } from '../../domain/units';
import type { Equipment } from '../../types';
import { useApp } from '../AppContext';

const WEIGHT_EQUIPMENT_IDS = new Set(['dumbbell', 'barbell', 'cable', 'bands', 'kettlebell', 'leg_press']);

const parseWeights = (text: string) => text.split(/[\s,;]+/).filter(Boolean).map(Number);
const mergeWeights = (list: number[]) => [...new Set(list)].sort((x, y) => x - y);

function WeightOptionsEditor({ equipment }: { equipment: Equipment }) {
  const app = useApp();
  const units = app.settings.units;
  const [values, setValues] = useState<number[]>([]);
  const [draft, setDraft] = useState('');
  const [error, setError] = useState('');
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    setValues(mergeWeights((equipment.weightOptionsKg ?? []).map((kg) => kgToDisplay(kg, units))));
  }, [equipment.weightOptionsKg, units]);

  // Adds whatever is typed (one weight, or a pasted list split by spaces/commas); returns the new list or null if invalid.
  const commitDraft = (): number[] | null => {
    const entered = parseWeights(draft);
    if (entered.some((value) => !Number.isFinite(value) || value <= 0)) {
      setError('Enter positive weights, one at a time or separated by spaces.');
      setSaved(false);
      return null;
    }
    const next = mergeWeights([...values, ...entered]);
    setValues(next);
    setDraft('');
    setError('');
    return next;
  };

  const save = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const next = commitDraft();
    if (!next) return;
    await app.setEquipmentWeightOptions(equipment.id, next.map((value) => displayToKg(value, units)));
    setSaved(true);
  };

  return (
    <details className="equipment-weights">
      <summary>Available weights (optional)</summary>
      <form className="stack" onSubmit={save}>
        <label className="field">
          <span>Add a weight in {units}</span>
          <div className="row">
            <input
              type="text"
              inputMode="decimal"
              aria-label={`${equipment.name} available weights`}
              placeholder={units === 'lb' ? 'e.g. 15' : 'e.g. 7.5'}
              value={draft}
              onChange={(event) => { setDraft(event.target.value); setError(''); setSaved(false); }}
              onKeyDown={(event) => { if (event.key === 'Enter') { event.preventDefault(); commitDraft(); setSaved(false); } }}
            />
            <button type="button" aria-label="Add weight" onClick={() => { commitDraft(); setSaved(false); }}>Add</button>
          </div>
        </label>
        {values.length > 0 && (
          <ul className="weight-chips" aria-label={`${equipment.name} weights`}>
            {values.map((value) => (
              <li key={value} className="weight-chip">
                {value} {units}
                <button
                  type="button" aria-label={`Remove ${value} ${units}`}
                  onClick={() => { setValues(values.filter((v) => v !== value)); setSaved(false); }}
                >×</button>
              </li>
            ))}
          </ul>
        )}
        <p className="hint">
          Suggestions for exercises using this equipment will use only these weights. Leave the list empty to allow any weight.
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
