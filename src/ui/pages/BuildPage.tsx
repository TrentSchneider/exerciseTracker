import { Icon } from '../components/Icon';
import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { primaryMuscles } from '../../domain/fatigue';
import { hasEquipment, supportsSetType } from '../../domain/generator';
import { buildBlocks, estimateItemsSeconds, makeItem, newWorkout, refreshRecommendations } from '../../domain/workout';
import { MUSCLES, MUSCLE_LABELS, type Exercise, type PlanItem, type SetType } from '../../types';
import { useApp } from '../AppContext';
import { Modal } from '../components/Modal';
import { SET_TYPE_LABELS } from '../components/Fields';

const LETTERS = ['A', 'B', 'C', 'D', 'E', 'F'];
const TIME_LIMITS = [15, 20, 30, 45, 60, 75, 90];
const MAX_GROUP: Record<SetType, number> = { regular: 1, superset: 2, hiit: 4 };
const letterOf = (i: PlanItem) => i.group?.split(':').pop() ?? 'A';

/** Cluster items of the same superset/hiit group next to each other and give each cluster a stable group id. */
export function normalizeGroups(items: PlanItem[]): PlanItem[] {
  const keyOf = (i: PlanItem) => (i.setType === 'regular' ? null : `${i.setType}:${i.group?.split(':').pop() ?? 'A'}`);
  const clusters = new Map<string, PlanItem[]>();
  const out: (PlanItem | string)[] = [];
  for (const it of items) {
    const k = keyOf(it);
    if (!k) { out.push(it); continue; }
    if (!clusters.has(k)) { clusters.set(k, []); out.push(k); }
    clusters.get(k)!.push({ ...it, group: k });
  }
  return out.flatMap((o) => (typeof o === 'string' ? clusters.get(o)! : [o]));
}

export function BuildPage() {
  const app = useApp();
  const nav = useNavigate();
  const [items, setItems] = useState<PlanItem[]>(app.draft?.items ?? []);
  const [name, setName] = useState(app.draft?.name ?? 'My workout');
  const [picking, setPicking] = useState(false);
  const [q, setQ] = useState('');
  const [onlyOwned, setOnlyOwned] = useState(true);
  const [muscle, setMuscle] = useState('');
  const [maxMinutes, setMaxMinutes] = useState<number | undefined>(app.draft?.criteria ? app.draft.criteria.maxMinutes : 45);
  const [addType, setAddType] = useState<SetType>('regular');
  const [addGroup, setAddGroup] = useState('new');

  const limitSec = maxMinutes ? maxMinutes * 60 : Infinity;
  const secondsOf = (list: PlanItem[]) => estimateItemsSeconds(normalizeGroups(list), app.exerciseById);
  const used = secondsOf(items);
  const over = used > limitSec;
  const fits = (list: PlanItem[]) => secondsOf(list) <= limitSec;
  const lonely = buildBlocks(normalizeGroups(items)).filter((b) => b[0].setType !== 'regular' && b.length < 2);

  const groupsOf = (t: SetType) => [...new Set(items.filter((i) => i.setType === t).map(letterOf))];
  /** Where a new exercise of this type would go: the chosen group, or a fresh one. */
  const targetGroup = (t: SetType, choice: string): string | undefined => {
    if (t === 'regular') return undefined;
    if (choice !== 'new' && groupsOf(t).includes(choice)) return choice;
    return LETTERS.find((l) => !groupsOf(t).includes(l)) ?? 'A';
  };
  const candidate = (ex: Exercise, t: SetType, choice: string): PlanItem =>
    makeItem(ex, t, app.sessions, app.settings.restScale, targetGroup(t, choice), app.equipment);
  const groupFull = (t: SetType, choice: string) =>
    choice !== 'new' && items.filter((i) => i.setType === t && letterOf(i) === choice).length >= MAX_GROUP[t];

  const available = useMemo(
    () => app.exercises
      .filter((e) => e.kind !== 'cardio' && (!onlyOwned || hasEquipment(e, app.owned)) && e.name.toLowerCase().includes(q.toLowerCase())
        && (!muscle || primaryMuscles(e).includes(muscle as any)))
      .sort((a, b) => a.name.localeCompare(b.name)),
    [app.exercises, app.owned, q, onlyOwned, muscle],
  );

  const typeOk = (e: Exercise, t: SetType) => supportsSetType(e, t) && !groupFull(t, addGroup);
  const fitsAdd = (e: Exercise, t: SetType) => fits([...items, candidate(e, t, addGroup)]);
  const typeHasRoom = (t: SetType) => !groupFull(t, addGroup) && available.some((e) => supportsSetType(e, t) && fitsAdd(e, t));

  const add = (exId: string) => {
    const ex = app.exerciseById.get(exId)!;
    setItems((l) => [...l, candidate(ex, addType, addGroup)]);
    setPicking(false);
  };

  const patch = (id: string, p: Partial<PlanItem>) => setItems((l) => l.map((i) => (i.id === id ? { ...i, ...p } : i)));
  const move = (idx: number, d: number) =>
    setItems((l) => {
      const n = [...l];
      const j = idx + d;
      if (j < 0 || j >= n.length) return l;
      [n[idx], n[j]] = [n[j], n[idx]];
      return n;
    });

  const changeType = (it: PlanItem, setType: SetType) => {
    const ex = app.exerciseById.get(it.exerciseId)!;
    const fresh = makeItem(ex, setType, app.sessions, app.settings.restScale, setType === 'regular' ? undefined : it.group ?? 'A', app.equipment);
    patch(it.id, { ...fresh, id: it.id, sets: it.sets, manual: false });
  };
  const typeChangeFits = (it: PlanItem, t: SetType) => {
    const ex = app.exerciseById.get(it.exerciseId)!;
    const fresh = makeItem(ex, t, app.sessions, app.settings.restScale, t === 'regular' ? undefined : it.group ?? 'A', app.equipment);
    return fits(items.map((i) => (i.id === it.id ? { ...fresh, id: it.id, sets: it.sets } : i)));
  };

  const review = () => {
    const criteria = { targetMuscles: [], useFatigue: false, setTypes: [], cardioWarmup: false, ...app.draft?.criteria, maxMinutes };
    const w = { ...newWorkout(name, normalizeGroups(items), criteria), ...(app.draft ? { id: app.draft.id } : {}) };
    app.setDraft(refreshRecommendations(w, app.exerciseById, app.sessions, app.settings.restScale, app.equipment));
    nav('/preview');
  };

  return (
    <section className="stack">
      <h1>Build a workout</h1>
      <label className="field"><span>Workout name</span><input value={name} onChange={(e) => setName(e.target.value)} /></label>
      <label className="field">
        <span>Maximum time</span>
        <select value={maxMinutes ?? ''} onChange={(e) => setMaxMinutes(e.target.value ? Number(e.target.value) : undefined)}>
          <option value="">No maximum</option>
          {TIME_LIMITS.map((m) => <option key={m} value={m}>{m} minutes</option>)}
        </select>
      </label>
      <p className={over ? 'warn' : 'muted'} role="status" data-testid="build-time">
        Estimated time: {Math.round(used / 60)} min{maxMinutes ? ` of ${maxMinutes} min` : ' (no maximum)'}
        {over && ' — over the limit. Remove exercises, change set types or raise the maximum.'}
      </p>
      {lonely.length > 0 && (
        <p className="warn" role="status">Superset and HIIT groups need at least two exercises: {lonely.map((b) => `${SET_TYPE_LABELS[b[0].setType]} ${letterOf(b[0])}`).join(', ')}.</p>
      )}
      {items.length === 0 && <p className="muted">No exercises yet. Add some from your available exercises.</p>}
      <ul className="list">
        {items.map((it, idx) => {
          const ex = app.exerciseById.get(it.exerciseId);
          return (
            <li key={it.id} className="card build-row">
              <strong>{ex?.name}</strong>
              <div className="row wrap">
                <select aria-label={`Set type for ${ex?.name}`} value={it.setType} onChange={(e) => changeType(it, e.target.value as SetType)}>
                  {(Object.keys(SET_TYPE_LABELS) as SetType[])
                    .filter((t) => ex && supportsSetType(ex, t))
                    .map((t) => <option key={t} value={t} disabled={t !== it.setType && !typeChangeFits(it, t)}>{SET_TYPE_LABELS[t]}</option>)}
                </select>
                {it.setType !== 'regular' && (
                  <select aria-label={`Group for ${ex?.name}`} value={it.group?.split(':').pop() ?? 'A'} onChange={(e) => patch(it.id, { group: e.target.value })}>
                    {LETTERS.map((l) => <option key={l} value={l}>Group {l}</option>)}
                  </select>
                )}
                <button type="button" onClick={() => move(idx, -1)} aria-label="Move up"><Icon name="up" size={16} /></button>
                <button type="button" onClick={() => move(idx, 1)} aria-label="Move down"><Icon name="down" size={16} /></button>
                <button type="button" onClick={() => setItems((l) => l.filter((i) => i.id !== it.id))} aria-label={`Remove ${ex?.name}`}>Remove</button>
              </div>
            </li>
          );
        })}
      </ul>
      <div className="row wrap">
        <button type="button" onClick={() => { setAddGroup('new'); setPicking(true); }}>Add exercise</button>
        <button type="button" className="primary" onClick={review} disabled={items.length === 0}>Review workout</button>
      </div>
      {picking && (
        <Modal title="Add exercise" onClose={() => setPicking(false)}>
          <div className="stack">
            <fieldset>
              <legend>Set type</legend>
              <div className="chips" role="group" aria-label="Add as">
                {(Object.keys(SET_TYPE_LABELS) as SetType[]).map((t) => {
                  const room = typeHasRoom(t);
                  return (
                    <button
                      key={t} type="button" className={`chip ${addType === t ? 'on' : ''}`} aria-pressed={addType === t}
                      disabled={addType !== t && !room} title={!room ? 'Would exceed the time limit' : undefined}
                      onClick={() => { setAddType(t); setAddGroup('new'); }}
                    >{SET_TYPE_LABELS[t]}</button>
                  );
                })}
              </div>
            </fieldset>
            {addType !== 'regular' && (
              <label className="field">
                <span>Add to group</span>
                <select value={addGroup} onChange={(e) => setAddGroup(e.target.value)}>
                  <option value="new">New group</option>
                  {groupsOf(addType).map((l) => <option key={l} value={l}>Group {l}</option>)}
                </select>
              </label>
            )}
            {!typeHasRoom(addType) && <p className="warn" role="status">Nothing more fits the time limit as {SET_TYPE_LABELS[addType]}.</p>}
            <input placeholder="Search exercises" aria-label="Search exercises" value={q} onChange={(e) => setQ(e.target.value)} />
            <select aria-label="Filter by muscle" value={muscle} onChange={(e) => setMuscle(e.target.value)}>
              <option value="">All muscles</option>
              {MUSCLES.map((m) => <option key={m} value={m}>{MUSCLE_LABELS[m]}</option>)}
            </select>
            <label className="check"><input type="checkbox" checked={onlyOwned} onChange={(e) => setOnlyOwned(e.target.checked)} /> Only exercises I have equipment for</label>
            <ul className="list scroll">
              {available.filter((e) => typeOk(e, addType)).map((e) => (
                <li key={e.id}>
                  <button type="button" className="list-btn" disabled={!fitsAdd(e, addType)} title={!fitsAdd(e, addType) ? 'Would exceed the time limit' : undefined} onClick={() => add(e.id)}>
                    <strong>{e.name}</strong>
                    <small>{primaryMuscles(e).map((m) => MUSCLE_LABELS[m]).join(', ')}</small>
                  </button>
                </li>
              ))}
              {available.filter((e) => typeOk(e, addType)).length === 0 && <li className="muted">No matching exercises.</li>}
            </ul>
          </div>
        </Modal>
      )}
    </section>
  );
}
