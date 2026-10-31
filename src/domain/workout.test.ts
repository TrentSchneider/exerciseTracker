import { blockWork, setBlockWork, blockRest, blockTransition, setBlockRest, setBlockTransition, syncBlockRest } from './workout';
import { generateWorkout } from './generator';
import { guidanceFor, GUIDED_EXERCISE_IDS } from '../data/guidance';
import { exercises, seeded } from '../test/helpers';
import type { PlanItem } from '../types';

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
    expect(setBlockWork(block, block, 60).map((i) => i.durationSec)).toEqual([60, 60]);
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
