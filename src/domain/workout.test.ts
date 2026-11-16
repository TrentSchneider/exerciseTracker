import {
  blockWork, setBlockWork, blockRest, blockTransition, setBlockRest, setBlockTransition, syncBlockRest,
  makeItem, progressHiitBlock, refreshRecommendations,
} from './workout';
import { generateWorkout } from './generator';
import { guidanceFor, GUIDED_EXERCISE_IDS } from '../data/guidance';
import { exercises, seeded, session } from '../test/helpers';
import type { PlanItem, Session } from '../types';

const item = (id: string, over: Partial<PlanItem> = {}): PlanItem => ({
  id, exerciseId: 'db_curl', setType: 'superset', group: 'g', sets: 3, reps: 10, weightKg: 10, bodyweight: false,
  durationSec: 0, restSec: 60, ...over,
});

describe('block rest model', () => {
  it('shares one rest across a block and prefers the edited value', () => {
    const block = [item('a', { restSec: 45 }), item('b', { restSec: 75 })];
    expect(blockRest(block)).toBe(75);
    const edited = setBlockRest(block, block, 20);
    expect(edited.every((i) => i.restSec === 20 && i.restEdited)).toBe(true);
    expect(blockRest(edited)).toBe(20);
    expect(syncBlockRest([item('a', { restSec: 10 }), item('b', { restSec: 50 })]).map((i) => i.restSec)).toEqual([50, 50]);
  });

  it('stores the between-exercise rest on the last item of a block', () => {
    const block = [item('a'), item('b')];
    expect(blockTransition(block)).toBe(30);
    const next = setBlockTransition(block, block, 90);
    expect(next[1].transitionSec).toBe(90);
    expect(next[0].transitionSec).toBeUndefined();
    expect(blockTransition(next)).toBe(90);
  });

  it('generated supersets and HIIT blocks share a single rest value', () => {
    const owned = [...new Set(exercises.flatMap((e) => e.equipment))];
    const { workout } = generateWorkout({
      exercises, ownedEquipment: owned, sessions: [], rng: seeded(3),
      criteria: { targetMuscles: [], useFatigue: false, setTypes: ['superset', 'hiit'], cardioWarmup: false, maxMinutes: 60 },
    });
    const groups = new Map<string, number[]>();
    for (const i of workout.items) if (i.group) groups.set(i.group, [...(groups.get(i.group) ?? []), i.restSec]);
    expect(groups.size).toBeGreaterThan(0);
    for (const rests of groups.values()) expect(new Set(rests).size).toBe(1);
  });
});

describe('HIIT work time', () => {
  it('is shared by every exercise in the block', () => {
    const block = [item('a', { setType: 'hiit', durationSec: 30 }), item('b', { setType: 'hiit', durationSec: 45 })];
    expect(blockWork(block)).toBe(30);
    expect(syncBlockRest(block).map((i) => i.durationSec)).toEqual([30, 30]);
    const edited = setBlockWork(block, block, 60);
    expect(edited.map((i) => i.durationSec)).toEqual([60, 60]);
    expect(edited.every((i) => i.workEdited)).toBe(true);
  });

  const hiitBlock = [item('a', { exerciseId: 'jumping_jacks', setType: 'hiit', durationSec: 40 }), item('b', { exerciseId: 'high_knees', setType: 'hiit', durationSec: 40 })];
  const historyFor = (efforts: [number, number], durations: [number, number] = [40, 40]): Session[] =>
    hiitBlock.map((it, i) => session(it.exerciseId, [{ reps: 0, weightKg: 10, durationSec: durations[i], effort: efforts[i] }], { setType: 'hiit' }));

  it('progresses by five seconds only when every exercise has manageable actual HIIT history', () => {
    const sessions = historyFor([7, 8]);
    expect(progressHiitBlock(hiitBlock, sessions)).toBe(45);
    expect(progressHiitBlock(hiitBlock, [session('jumping_jacks', [{ durationSec: 40, effort: 7 }], { setType: 'regular' })])).toBe(40);
    expect(progressHiitBlock(hiitBlock, sessions.slice(0, 1))).toBe(40);
    expect(progressHiitBlock(hiitBlock, historyFor([7, 7]).map((s) => ({
      ...s, exercises: s.exercises.map((se) => ({ ...se, sets: se.sets.map((set) => ({ ...set, weightKg: 12 })) })),
    })))).toBe(40);
  });

  it('holds mixed effort and reduces five seconds for maximal effort, within the automatic band', () => {
    expect(progressHiitBlock(hiitBlock, historyFor([7, 9]))).toBe(40);
    expect(progressHiitBlock(hiitBlock, historyFor([7, 10]))).toBe(35);
    expect(progressHiitBlock(hiitBlock.map((i) => ({ ...i, durationSec: 60 })), historyFor([7, 7], [60, 60]))).toBe(60);
    expect(progressHiitBlock(hiitBlock.map((i) => ({ ...i, durationSec: 20 })), historyFor([10, 7], [20, 20]))).toBe(20);
    expect(progressHiitBlock(hiitBlock, historyFor([7, 7], [60, 60]))).toBe(45);
  });

  it('keeps edited shared work through synchronization and saved-workout refresh', () => {
    const inconsistent = [hiitBlock[0], { ...hiitBlock[1], durationSec: 55, workEdited: true }];
    const synced = syncBlockRest(inconsistent);
    expect(synced.map((i) => i.durationSec)).toEqual([55, 55]);
    expect(synced.every((i) => i.workEdited)).toBe(true);

    const edited = setBlockWork(hiitBlock, hiitBlock, 50);
    const workout = { id: 'w', name: 'HIIT', items: edited, createdAt: 1 };
    const refreshed = refreshRecommendations(workout, new Map(exercises.map((e) => [e.id, e])), historyFor([7, 7]), 1);
    expect(refreshed.items.map((i) => i.durationSec)).toEqual([50, 50]);
  });

  it('does not clamp an existing out-of-band HIIT interval', () => {
    const longer = hiitBlock.map((i) => ({ ...i, durationSec: 90 }));
    expect(progressHiitBlock(longer, historyFor([7, 7], [90, 90]))).toBe(90);
  });

  it('does not use an older HIIT session when the newest has no valid duration', () => {
    const valid = historyFor([7, 7]);
    const invalid = session('jumping_jacks', [{ durationSec: 0, effort: 7, weightKg: 10 }], { setType: 'hiit', at: Date.now() + 1 });
    expect(progressHiitBlock(hiitBlock, [...valid, invalid])).toBe(40);
  });

  it('starts new HIIT items at the shared default until the whole block has evidence', () => {
    const history = historyFor([7, 7]);
    const ex = exercises.find((e) => e.id === 'jumping_jacks')!;
    const first = makeItem(ex, 'hiit', history, 1, 'g');
    expect(first.durationSec).toBe(40);
    const missing = { ...hiitBlock[1], exerciseId: 'plank' };
    expect(progressHiitBlock([first, missing], history)).toBe(40);
    expect(progressHiitBlock([{ ...hiitBlock[0], manual: true }, hiitBlock[1]], history)).toBe(40);
  });
});

describe('exercise guidance', () => {
  it('covers every seed exercise with a description, steps and a pose', () => {
    for (const e of exercises) expect(GUIDED_EXERCISE_IDS).toContain(e.id);
    for (const id of GUIDED_EXERCISE_IDS) {
      const g = guidanceFor({ id, name: id, kind: 'weighted' });
      expect(g.description.length).toBeGreaterThan(10);
      expect(g.steps.length).toBeGreaterThanOrEqual(3);
    }
  });

  it('falls back to generic guidance for custom exercises', () => {
    const g = guidanceFor({ id: 'custom_x', name: 'My Move', kind: 'timed' }, ['Abs']);
    expect(g.description).toContain('My Move');
    expect(g.steps.length).toBeGreaterThan(0);
  });
});
