import { allocate, exerciseCapacity, selectionFits, toggleMuscle, toggleRegion, trimToCapacity, targetMuscleSet } from './targets';
import { generateWorkout } from './generator';
import { computeMuscleStatus, primaryMuscles } from './fatigue';
import { exercises, byId, seeded } from '../test/helpers';
import { REGION_MUSCLES, type Criteria, type Region } from '../types';
import { regionOf } from './targets';

const FULL = ['dumbbell', 'barbell', 'bench', 'rack', 'pullup_bar', 'cable', 'bands', 'kettlebell', 'box', 'jump_rope'];
const crit = (c: Partial<Criteria> = {}): Criteria => ({ targetMuscles: [], targetRegions: [], useFatigue: false, setTypes: ['regular'], cardioWarmup: false, maxMinutes: 30, ...c });
const gen = (c: Partial<Criteria>, seed = 1) => generateWorkout({
  exercises, ownedEquipment: FULL, criteria: crit(c), sessions: [], status: computeMuscleStatus([], exercises, Date.now()), rng: seeded(seed),
}).workout;
const countRegion = (items: { exerciseId: string }[], r: Region) =>
  items.filter((i) => primaryMuscles(byId.get(i.exerciseId)!).some((m) => REGION_MUSCLES[r].includes(m))).length;

describe('capacity', () => {
  it('depends on time, set types and warm-up', () => {
    expect(exerciseCapacity(crit({ maxMinutes: 30 }))).toBe(6);
    expect(exerciseCapacity(crit({ maxMinutes: 30, cardioWarmup: true }))).toBeLessThan(6);
    expect(exerciseCapacity(crit({ maxMinutes: 30, setTypes: ['hiit'] }))).toBeGreaterThan(6);
    expect(exerciseCapacity(crit({ maxMinutes: 15, cardioWarmup: true }))).toBeGreaterThanOrEqual(1);
  });
});

describe('target tree selection', () => {
  it('region selection clears its muscles; muscle selection clears its region', () => {
    let t = toggleMuscle({ targetMuscles: [], targetRegions: [] }, 'calves');
    t = toggleMuscle(t, 'chest');
    t = toggleRegion(t, 'lower');
    expect(t).toEqual({ targetMuscles: ['chest'], targetRegions: ['lower'] });
    t = toggleRegion(t, 'upper');
    expect(t).toEqual({ targetMuscles: [], targetRegions: ['lower', 'upper'] });
    t = toggleMuscle(t, 'glutes');
    expect(t).toEqual({ targetMuscles: ['glutes'], targetRegions: ['upper'] });
  });
  it('expands regions into muscles', () => {
    expect(targetMuscleSet({ targetMuscles: ['calves'], targetRegions: ['core'] }).sort()).toEqual(['abs', 'calves', 'lower_back', 'obliques']);
    expect(targetMuscleSet({ targetMuscles: [], targetRegions: [] })).toEqual([]);
  });
});

describe('allocation', () => {
  it('splits evenly between regions, then between muscles within a region', () => {
    const { groups, fits } = allocate({ targetMuscles: ['calves', 'glutes'], targetRegions: ['upper'] }, 6);
    expect(fits).toBe(true);
    expect(groups.map((g) => [g.region, g.quota])).toEqual([['upper', 3], ['lower', 3]]);
    expect(groups[1].leaves.map((l) => l.quota).sort()).toEqual([1, 2]);
  });
  it('splits full body across upper, lower and core', () => {
    expect(allocate({ targetMuscles: [], targetRegions: [] }, 6).groups.map((g) => g.quota)).toEqual([2, 2, 2]);
  });
  it('rejects selections that cannot all fit and trims them', () => {
    const t = { targetMuscles: ['quads', 'glutes', 'calves', 'hamstrings'] as any, targetRegions: ['upper'] as Region[] };
    expect(selectionFits(t, 6)).toBe(false);
    expect(selectionFits(t, 8)).toBe(true);
    expect(selectionFits(trimToCapacity(t, 6), 6)).toBe(true);
  });
});

describe('generation follows the allocation', () => {
  it('gives upper body 3 exercises and calves/glutes the other 3', () => {
    for (const seed of [1, 2, 3, 4, 5]) {
      const w = gen({ targetRegions: ['upper'], targetMuscles: ['calves', 'glutes'] }, seed);
      const lower = w.items.filter((i) => primaryMuscles(byId.get(i.exerciseId)!).some((m) => regionOf(m) === 'lower'));
      expect(countRegion(w.items, 'upper')).toBeGreaterThanOrEqual(3);
      const hasCalves = lower.some((i) => primaryMuscles(byId.get(i.exerciseId)!).includes('calves'));
      const hasGlutes = lower.some((i) => primaryMuscles(byId.get(i.exerciseId)!).includes('glutes'));
      expect(hasCalves && hasGlutes).toBe(true);
      expect(w.items).toHaveLength(6);
    }
  });
  it('full body covers upper, lower and core evenly', () => {
    for (const seed of [1, 2, 3]) {
      const w = gen({}, seed);
      expect(w.items).toHaveLength(6);
      for (const r of ['upper', 'lower', 'core'] as Region[]) expect(countRegion(w.items, r)).toBeGreaterThanOrEqual(2);
    }
  });
});
