import type { Criteria, Equipment, Exercise, MuscleId, PlanItem, Session, SetType, Workout } from '../types';
import { primaryMuscles, type MuscleStatus } from './fatigue';
import { HIIT_REST_SEC, HIIT_WORK_SEC } from './recommend';
import { uid } from './units';
import { allocate, exerciseCapacity, targetMuscleSet, DEFAULT_MINUTES, isFullBody } from './targets';
import { buildBlocks, estimateBlockSeconds, estimateWorkoutSeconds, makeItem, newWorkout } from './workout';

const MIN_RECOVERY = 40;

const ANTAGONISTS: [MuscleId, MuscleId][] = [
  ['chest', 'upper_back'], ['chest', 'lats'], ['biceps', 'triceps'], ['quads', 'hamstrings'],
  ['shoulders_front', 'shoulders_rear'], ['abs', 'lower_back'], ['shoulders_side', 'lats'],
];

const isAntagonist = (a: Exercise, b: Exercise) => {
  const pa = primaryMuscles(a);
  const pb = primaryMuscles(b);
  return ANTAGONISTS.some(([x, y]) => (pa.includes(x) && pb.includes(y)) || (pa.includes(y) && pb.includes(x)));
};

export interface GenerateInput {
  exercises: Exercise[];
  equipment?: Equipment[];
  ownedEquipment: Iterable<string>;
  criteria: Criteria;
  sessions: Session[];
  status?: Record<MuscleId, MuscleStatus>;
  restScale?: number;
  rng?: () => number;
  name?: string;
}

export interface GenerateResult {
  workout: Workout;
  notes: string[];
}

export const hasEquipment = (ex: Exercise, owned: Set<string>) => ex.equipment.every((e) => owned.has(e));

export const supportsSetType = (ex: Exercise, t: SetType) =>
  t === 'regular' ? true : t === 'superset' ? ex.supersetOk : ex.hiitOk;

export function recoveryOf(status: Record<MuscleId, MuscleStatus> | undefined, m: MuscleId): number {
  return status ? status[m].recovery : 100;
}

export function exerciseRecovery(ex: Exercise, status: Record<MuscleId, MuscleStatus> | undefined): number {
  const pm = primaryMuscles(ex);
  if (!pm.length) return 100;
  return Math.min(...pm.map((m) => recoveryOf(status, m)));
}

/** Does an exercise satisfy a workout's criteria (targets, fatigue, set type)? */
export function fitsCriteria(
  ex: Exercise, setType: SetType, c: Criteria | undefined, status: Record<MuscleId, MuscleStatus> | undefined,
): boolean {
  if (!c) return true;
  if (c.setTypes.length && !c.setTypes.includes(setType)) return false;
  const targets = targetMuscleSet(c);
  if (targets.length && !primaryMuscles(ex).some((m) => targets.includes(m))) return false;
  if (c.useFatigue && exerciseRecovery(ex, status) < MIN_RECOVERY) return false;
  return true;
}

export function generateWorkout(input: GenerateInput): GenerateResult {
  const rng = input.rng ?? Math.random;
  const owned = new Set(input.ownedEquipment);
  const { criteria, sessions, status } = input;
  const restScale = input.restScale ?? 1;
  const notes: string[] = [];
  const types: SetType[] = criteria.setTypes.length ? criteria.setTypes : ['regular'];
  const budget = (criteria.maxMinutes ?? DEFAULT_MINUTES) * 60;
  const byId = new Map(input.exercises.map((e) => [e.id, e]));
  const available = input.exercises.filter((e) => !e.inactive && hasEquipment(e, owned));

  const lastTrained = (ex: Exercise): number => {
    const ts = primaryMuscles(ex).map((m) => status?.[m].lastTrained ?? 0);
    return ts.length ? Math.min(...ts) : 0;
  };
  const used = new Set<string>();
  const musclesUsed = new Map<MuscleId, number>();

  const pool = (t: SetType, muscles?: MuscleId[]): Exercise[] => {
    const noTypes = { ...criteria, setTypes: [] };
    return available.filter(
      (e) => !used.has(e.id) && supportsSetType(e, t) && (e.kind !== 'cardio' || (t === 'hiit' && isFreeCardio(e))) && fitsCriteria(e, t, noTypes, status)
        && (!muscles || primaryMuscles(e).some((m) => muscles.includes(m))),
    );
  };

  // Every selected region/muscle gets its share of the exercises that fit the time allotment.
  const { groups } = allocate(criteria, exerciseCapacity(criteria));
  const slots = groups.flatMap((g) => g.leaves).filter((l) => l.quota > 0).map((l) => ({ ...l, remaining: l.quota }));
  type Slot = (typeof slots)[number];
  const slotOf = new Map<string, Slot>();

  const score = (e: Exercise): number => {
    const rec = exerciseRecovery(e, status) / 100;
    const days = lastTrained(e) ? Math.min(7, (Date.now() - lastTrained(e)) / 86_400_000) / 7 : 1;
    const repeat = primaryMuscles(e).reduce((s, m) => s + (musclesUsed.get(m) ?? 0), 0) * 0.35;
    const fatigueWeight = criteria.useFatigue ? 1 : 0.2;
    return fatigueWeight * (rec + 0.4 * days) - repeat + rng() * 0.5;
  };

  const best = (list: Exercise[]) => list.slice().sort((a, b) => score(b) - score(a));
  const markUsed = (e: Exercise) => {
    used.add(e.id);
    primaryMuscles(e).forEach((m) => musclesUsed.set(m, (musclesUsed.get(m) ?? 0) + 1));
  };

  const items: PlanItem[] = [];

  if (criteria.cardioWarmup) {
    const cardio = available.filter(isMachineCardio);
    if (cardio.length) {
      const pick = cardio[Math.floor(rng() * cardio.length)];
      const it = makeItem(pick, 'regular', sessions, restScale, undefined, input.equipment);
      it.sets = 1;
      it.durationSec = pick.equipment.length ? 300 : 180;
      it.restSec = 0;
      used.add(pick.id);
      items.push(it);
    } else notes.push('No cardio warm-up available with your equipment.');
  }

  /** Pick the next exercise for the slot with the most exercises still owed; claims it immediately. */
  const pickFor = (t: SetType, partner?: Exercise, ok: (e: Exercise) => boolean = () => true): Exercise | null => {
    const open = slots.filter((s) => s.remaining > 0).sort((x, y) => y.remaining - x.remaining);
    for (const slot of open) {
      const list = pool(t, slot.muscles).filter(ok);
      if (!list.length) continue;
      const adj = (e: Exercise) => score(e) + (partner && isAntagonist(partner, e) ? 0.6 : 0);
      const e = list.sort((x, y) => adj(y) - adj(x))[0];
      slot.remaining--;
      slotOf.set(e.id, slot);
      markUsed(e);
      return e;
    }
    return null;
  };

  /** Fill out a block from the same slot as `anchor` when no other slot has anything left (may exceed the quota by one). */
  const fillFrom = (t: SetType, anchor: Exercise, ok: (e: Exercise) => boolean = () => true): Exercise | null => {
    const slot = slotOf.get(anchor.id);
    const e = best(pool(t, slot?.muscles).filter(ok))[0];
    if (!e) return null;
    if (slot) slotOf.set(e.id, slot);
    markUsed(e);
    return e;
  };

  const release = (ids: string[]) => ids.forEach((id) => {
    used.delete(id);
    const slot = slotOf.get(id);
    if (slot) slot.remaining++;
    slotOf.delete(id);
  });

  const blockOf = (t: SetType): PlanItem[] | null => {
    if (t === 'regular') {
      const e = pickFor('regular');
      if (!e) return null;
      return [makeItem(e, 'regular', sessions, restScale, undefined, input.equipment)];
    }
    if (t === 'superset') {
      const first = pickFor('superset');
      if (!first) return null;
      const partner = pickFor('superset', first) ?? fillFrom('superset', first, (e) => e.id !== first.id);
      if (!partner) { release([first.id]); return null; }
      const g = uid('ss');
      const a = makeItem(first, 'superset', sessions, restScale, g, input.equipment);
      const b = makeItem(partner, 'superset', sessions, restScale, g, input.equipment);
      const rounds = Math.min(a.sets, b.sets);
      a.sets = b.sets = rounds;
      a.restSec = b.restSec = Math.max(a.restSec, b.restSec);
      return [a, b];
    }
    const picks: Exercise[] = [];
    const distinct = (e: Exercise) => !picks.some((p) => primaryMuscles(p).some((m) => primaryMuscles(e).includes(m)));
    while (picks.length < 3) {
      const e = pickFor('hiit', undefined, distinct) ?? (picks.length < 2 ? pickFor('hiit') : null);
      if (!e) break;
      picks.push(e);
    }
    while (picks.length > 0 && picks.length < 2) {
      const e = fillFrom('hiit', picks[0], (x) => x.id !== picks[0].id);
      if (!e) break;
      picks.push(e);
    }
    if (picks.length < 2) { release(picks.map((p) => p.id)); return null; }
    const g = uid('hi');
    return picks.map((p) => {
      const it = makeItem(p, 'hiit', sessions, restScale, g, input.equipment);
      it.sets = 3;
      it.durationSec = HIIT_WORK_SEC;
      it.restSec = HIIT_REST_SEC;
      return it;
    });
  };

  const exhausted = new Set<SetType>();
  const chosen: PlanItem[][] = [];
  let total = estimateWorkoutSeconds(items, byId);
  let turn = 0;
  while (exhausted.size < types.length && chosen.length < 12 && total < budget * 0.92 && slots.some((s) => s.remaining > 0)) {
    const t = types[turn++ % types.length];
    if (exhausted.has(t)) continue;
    const block = blockOf(t);
    if (!block) { exhausted.add(t); continue; }
    let est = estimateBlockSeconds(block, byId);
    if (total + est > budget * 1.08 && block[0].setType !== 'hiit') {
      block.forEach((i) => (i.sets = Math.min(i.sets, 2)));
      est = estimateBlockSeconds(block, byId);
    }
    if (total + est > budget * 1.08 && (chosen.length > 0 || items.length > 0)) {
      release(block.map((i) => i.exerciseId));
      exhausted.add(t);
      continue;
    }
    chosen.push(block);
    total += est + 30;
  }

  for (const t of types) {
    if (t !== 'regular' && !chosen.some((b) => b[0].setType === t)) {
      notes.push(`Couldn't fit a ${t === 'hiit' ? 'HIIT' : 'superset'} block with your equipment/targets/time.`);
    }
  }
  for (const slot of slots) {
    if (slot.remaining > 0 && chosen.length) notes.push(`Couldn't fill ${slot.remaining} exercise slot(s) for ${slot.label} with your equipment/set types/time.`);
  }
  if (!chosen.length) notes.push('No exercises matched. Try adding equipment, relaxing targets, or allowing more time.');

  const order: Record<SetType, number> = { regular: 0, superset: 1, hiit: 2 };
  chosen.sort((a, b) => order[a[0].setType] - order[b[0].setType]);
  const all = [...items, ...chosen.flat()];

  const label = !isFullBody(criteria) ? 'Targeted' : criteria.useFatigue ? 'Recovery-based' : 'Suggested';
  const workout = newWorkout(input.name ?? `${label} workout`, all, criteria);
  return { workout, notes };
}

/** Exercises that can replace `item` while still satisfying the workout's criteria. */
const MACHINE_EQUIPMENT = ['treadmill', 'bike', 'rower'];

/** Cardio machines (treadmill, bike, rower): only used for the cardio warm-up. */
export const isMachineCardio = (e: Exercise): boolean => e.kind === 'cardio' && e.equipment.some((q) => MACHINE_EQUIPMENT.includes(q));

/** Free cardio (jumping jacks, jump rope, high knees): only used in HIIT sets. */
export const isFreeCardio = (e: Exercise): boolean => e.kind === 'cardio' && !isMachineCardio(e);

export function swapCandidates(
  workout: Workout, item: PlanItem, exercises: Exercise[], ownedEquipment: Iterable<string>,
  status?: Record<MuscleId, MuscleStatus>,
): Exercise[] {
  const owned = new Set(ownedEquipment);
  const byId = new Map(exercises.map((e) => [e.id, e]));
  const original = byId.get(item.exerciseId);
  if (!original) return [];
  const targets = primaryMuscles(original);
  const inWorkout = new Set(workout.items.map((i) => i.exerciseId));
  const c = workout.criteria;
  return exercises.filter((e) => {
    if (e.id === original.id || inWorkout.has(e.id)) return false;
    if (!hasEquipment(e, owned)) return false;
    if (!supportsSetType(e, item.setType)) return false;
    if (!primaryMuscles(e).some((m) => targets.includes(m))) return false;
    if (e.kind === 'cardio') {
      if (item.setType === 'hiit' ? !isFreeCardio(e) : !(isMachineCardio(original) && isMachineCardio(e))) return false;
    }
    if (!fitsCriteria(e, item.setType, c, status)) return false;
    if (c?.maxMinutes) {
      const swapped = workout.items.map((i) => (i.id === item.id ? { ...i, exerciseId: e.id } : i));
      const orig = estimateWorkoutSeconds(workout.items, byId);
      const next = estimateWorkoutSeconds(swapped, byId);
      if (next > Math.max(orig, c.maxMinutes * 60 * 1.1)) return false;
    }
    return true;
  });
}

export { buildBlocks };
