import type { Equipment, Exercise, PlanItem, SetType, Workout } from '../types';
import { HIIT_WORK_SEC, applyRecommendation, recommend } from './recommend';
import { uid } from './units';
import type { Session } from '../types';

const SECONDS_PER_REP = 3;
const SETUP_SEC = 10;
export const DEFAULT_TRANSITION_SEC = 30;

/** Consecutive items sharing a `group` form one block (superset / hiit circuit). */
export function buildBlocks(items: PlanItem[]): PlanItem[][] {
  const blocks: PlanItem[][] = [];
  for (const it of items) {
    const prev = blocks[blocks.length - 1];
    if (it.group && prev && prev[0].group === it.group) prev.push(it);
    else blocks.push([it]);
  }
  return blocks;
}

export function workSeconds(item: PlanItem, ex: Exercise | undefined): number {
  if (item.setType === 'hiit') return item.durationSec || HIIT_WORK_SEC;
  if (ex && (ex.kind === 'timed' || ex.kind === 'cardio')) return item.durationSec;
  return item.reps * SECONDS_PER_REP + SETUP_SEC;
}

/** Rest between sets (regular) or between rounds (superset / hiit); shared by every item of a block. */
export function blockRest(block: PlanItem[]): number {
  const edited = block.find((i) => i.restEdited);
  return edited ? edited.restSec : Math.max(...block.map((i) => i.restSec));
}

/** Rest between this block (or exercise) and the next one. */
export function blockTransition(block: PlanItem[]): number {
  return block[block.length - 1].transitionSec ?? DEFAULT_TRANSITION_SEC;
}

export function estimateBlockSeconds(block: PlanItem[], byId: Map<string, Exercise>): number {
  const rounds = Math.max(...block.map((i) => i.sets));
  const work = block.reduce((s, i) => s + workSeconds(i, byId.get(i.exerciseId)), 0);
  return rounds * work + (rounds - 1) * blockRest(block);
}

export function estimateWorkoutSeconds(items: PlanItem[], exercises: Exercise[] | Map<string, Exercise>): number {
  const byId = exercises instanceof Map ? exercises : new Map(exercises.map((e) => [e.id, e]));
  const blocks = buildBlocks(items);
  if (!blocks.length) return 0;
  return blocks.reduce((s, b, i) => s + estimateBlockSeconds(b, byId) + (i < blocks.length - 1 ? blockTransition(b) : 0), 0);
}

/** Estimated seconds for a list of items as they will run (blocks synced to one rest / HIIT work time). */
export function estimateItemsSeconds(items: PlanItem[], byId: Map<string, Exercise>): number {
  return items.length ? estimateWorkoutSeconds(syncBlockRest(items), byId) : 0;
}

/** Give every item of a block the same between-round rest. */
export function setBlockRest(items: PlanItem[], block: PlanItem[], restSec: number): PlanItem[] {
  const ids = new Set(block.map((i) => i.id));
  return items.map((i) => (ids.has(i.id) ? { ...i, restSec, restEdited: true } : i));
}

export function setBlockTransition(items: PlanItem[], block: PlanItem[], transitionSec: number): PlanItem[] {
  const lastId = block[block.length - 1].id;
  return items.map((i) => (i.id === lastId ? { ...i, transitionSec } : i));
}

/** HIIT is purely time based: every exercise in a HIIT block works for the same duration. */
export function blockWork(block: PlanItem[]): number {
  return block[0].durationSec || HIIT_WORK_SEC;
}

export function setBlockWork(items: PlanItem[], block: PlanItem[], durationSec: number): PlanItem[] {
  const ids = new Set(block.map((i) => i.id));
  return items.map((i) => (ids.has(i.id) ? { ...i, durationSec } : i));
}

/** Make all items in each block agree on one rest value (and one work time for HIIT). */
export function syncBlockRest(items: PlanItem[]): PlanItem[] {
  return buildBlocks(items).flatMap((b) => {
    if (b.length < 2 && b[0].setType !== 'hiit') return b;
    const r = blockRest(b);
    const w = b[0].setType === 'hiit' ? blockWork(b) : undefined;
    return b.map((i) => ({ ...i, restSec: r, ...(w ? { durationSec: w } : {}) }));
  });
}

export const estimateWorkoutMinutes = (items: PlanItem[], exercises: Exercise[] | Map<string, Exercise>) =>
  Math.round(estimateWorkoutSeconds(items, exercises) / 60);

export function makeItem(
  ex: Exercise, setType: SetType, sessions: Session[], restScale: number, group?: string, equipment: Equipment[] = [],
): PlanItem {
  const r = recommend(ex, setType, sessions, restScale, Date.now(), equipment);
  return {
    id: uid('it'), exerciseId: ex.id, setType, sets: r.sets, reps: r.reps, weightKg: r.weightKg,
    bodyweight: r.bodyweight, durationSec: r.durationSec, restSec: r.restSec, group,
  };
}

export function newWorkout(name: string, items: PlanItem[], criteria?: Workout['criteria']): Workout {
  return { id: uid('wo'), name, items, criteria, createdAt: Date.now() };
}

export function itemSummary(item: PlanItem, ex: Exercise | undefined): string {
  if (item.setType === 'hiit') return `${item.sets} rounds × ${item.durationSec}s work`;
  if (ex && (ex.kind === 'timed' || ex.kind === 'cardio')) return `${item.sets} × ${item.durationSec}s`;
  return `${item.sets} × ${item.reps} reps`;
}

/** Re-derive weight/reps/time for every item the user hasn't manually adjusted. */
export function refreshRecommendations(
  workout: Workout, byId: Map<string, Exercise>, sessions: Session[], restScale: number, equipment: Equipment[] = [],
): Workout {
  return {
    ...workout,
    items: syncBlockRest(workout.items.map((it) => {
      const ex = byId.get(it.exerciseId);
      return ex ? applyRecommendation(it, ex, sessions, restScale, Date.now(), equipment) : it;
    })),
  };
}
