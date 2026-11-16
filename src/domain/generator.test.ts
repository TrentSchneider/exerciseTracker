import { generateWorkout, swapCandidates, isMachineCardio, fitsCriteria, hasEquipment } from './generator';
import { computeMuscleStatus, primaryMuscles } from './fatigue';
import { estimateWorkoutMinutes, buildBlocks } from './workout';
import { displayToKg } from './units';
import { byId, exercises, seeded, session, HOUR } from '../test/helpers';
import type { Criteria } from '../types';

const NOW = Date.now();
const FULL = ['dumbbell', 'barbell', 'bench', 'rack', 'pullup_bar', 'cable', 'bands', 'kettlebell', 'box', 'jump_rope'];
const base = (c: Partial<Criteria> = {}): Criteria => ({ targetMuscles: [], useFatigue: false, setTypes: ['regular'], cardioWarmup: false, ...c });
const MACHINES = [...FULL, 'treadmill', 'bike', 'rower'];
const gen = (c: Partial<Criteria>, owned: string[] = FULL, sessions = [] as ReturnType<typeof session>[], seed = 7) =>
  generateWorkout({
    exercises, ownedEquipment: owned, criteria: base(c), sessions,
    status: computeMuscleStatus(sessions, exercises, NOW), rng: seeded(seed),
  });

describe('cardio exercises', () => {
  const status = computeMuscleStatus([], exercises, NOW);
  it('machine cardio is only the warm-up; free cardio is only in HIIT', () => {
    let freeInHiit = 0;
    for (const seed of [1, 2, 3, 4, 5, 6, 7, 8]) {
      const { workout } = gen({ setTypes: ['regular', 'superset', 'hiit'], cardioWarmup: true }, MACHINES, [], seed);
      const [warm, ...rest] = workout.items;
      expect(isMachineCardio(byId.get(warm.exerciseId)!)).toBe(true);
      for (const it of rest) {
        const e = byId.get(it.exerciseId)!;
        expect(isMachineCardio(e)).toBe(false);
        if (e.kind === 'cardio') {
          expect(it.setType).toBe('hiit');
          freeInHiit++;
        }
        for (const c of swapCandidates(workout, it, exercises, FULL, status)) {
          expect(isMachineCardio(c)).toBe(false);
          if (c.kind === 'cardio') expect(it.setType).toBe('hiit');
        }
      }
    }
    expect(freeInHiit).toBeGreaterThan(0);
  });

  it('free cardio never appears without hiit, and machines never in hiit', () => {
    const { workout } = gen({ setTypes: ['hiit'] }, FULL, [], 3);
    for (const it of workout.items) expect(isMachineCardio(byId.get(it.exerciseId)!)).toBe(false);
    const reg = gen({ setTypes: ['regular', 'superset'] }, FULL, [], 3).workout;
    for (const it of reg.items) expect(byId.get(it.exerciseId)!.kind).not.toBe('cardio');
  });
});

describe('generateWorkout', () => {
  it('only uses equipment the user owns', () => {
    for (const owned of [[], ['dumbbell'], ['bands', 'pullup_bar']]) {
      const { workout } = gen({ setTypes: ['regular', 'superset', 'hiit'] }, owned);
      for (const it of workout.items) expect(hasEquipment(byId.get(it.exerciseId)!, new Set(owned))).toBe(true);
      expect(workout.items.length).toBeGreaterThan(0);
    }
  });

  it('builds recommendations from only the registered weight options', () => {
    const equipment = [{ id: 'dumbbell', name: 'Dumbbells', owned: true, weightOptionsKg: [5, 10] }];
    const result = generateWorkout({
      exercises: [byId.get('db_curl')!],
      equipment,
      ownedEquipment: ['dumbbell'],
      criteria: base({ targetMuscles: ['biceps'], maxMinutes: 45 }),
      sessions: [],
      rng: seeded(7),
    });
    expect(result.workout.items).toHaveLength(1);
    expect(equipment[0].weightOptionsKg).toContain(result.workout.items[0].weightKg);
  });

  it('uses the maximum listed dumbbell weight and progresses reps in generated workouts', () => {
    const weights = [5, 10, 15, 20, 25].map((lb) => displayToKg(lb, 'lb'));
    const equipment = [{ id: 'dumbbell', name: 'Dumbbells', owned: true, weightOptionsKg: weights }];
    const result = generateWorkout({
      exercises: [byId.get('db_curl')!],
      equipment,
      ownedEquipment: ['dumbbell'],
      criteria: base({ targetMuscles: ['biceps'], maxMinutes: 45 }),
      sessions: [session('db_curl', [{ reps: 12, weightKg: weights[4], effort: 7 }], { at: NOW - HOUR })],
      rng: seeded(7),
    });
    expect(result.workout.items).toHaveLength(1);
    expect(result.workout.items[0].weightKg).toBe(weights[4]);
    expect(result.workout.items[0].reps).toBe(13);
  });

  it('uses the selected progression goal when generating a workout', () => {
    const history = [session('db_curl', [{ reps: 8, weightKg: 10, effort: 7 }], { at: NOW - HOUR })];
    const input = {
      exercises: [byId.get('db_curl')!], ownedEquipment: ['dumbbell'],
      criteria: base({ targetMuscles: ['biceps'] }), sessions: history, rng: seeded(7),
    };
    const strength = generateWorkout({ ...input, progression: { progressionGoal: 'strength' } }).workout.items[0];
    const muscle = generateWorkout({ ...input, progression: { progressionGoal: 'muscle' } }).workout.items[0];
    expect(strength.reps).toBe(4);
    expect(strength.weightKg).toBeGreaterThan(10);
    expect(muscle.reps).toBe(9);
    expect(muscle.weightKg).toBe(10);
  });

  it('with no equipment falls back to bodyweight exercises', () => {
    const { workout } = gen({}, []);
    expect(workout.items.every((i) => byId.get(i.exerciseId)!.equipment.length === 0)).toBe(true);
  });

  it('respects targeted muscle groups', () => {
    const { workout } = gen({ targetMuscles: ['biceps', 'triceps'] });
    expect(workout.items.length).toBeGreaterThan(0);
    for (const it of workout.items) {
      expect(primaryMuscles(byId.get(it.exerciseId)!).some((m) => m === 'biceps' || m === 'triceps')).toBe(true);
    }
  });

  it('avoids fatigued muscles when basing on fatigue', () => {
    const sets = Array.from({ length: 8 }, () => ({ effort: 10 }));
    const sessions = [session('bench_press', sets, { at: NOW - HOUR }), session('incline_bench', sets, { at: NOW - HOUR })];
    const status = computeMuscleStatus(sessions, exercises, NOW);
    expect(status.chest.recovery).toBeLessThan(40);
    const { workout } = gen({ useFatigue: true, maxMinutes: 60 }, FULL, sessions);
    for (const it of workout.items) {
      expect(primaryMuscles(byId.get(it.exerciseId)!)).not.toContain('chest');
    }
  });

  it('combines fatigue and targets (targets win, fatigued ones excluded)', () => {
    const sets = Array.from({ length: 8 }, () => ({ effort: 10 }));
    const sessions = [session('barbell_curl', sets, { at: NOW - HOUR })];
    const { workout } = gen({ useFatigue: true, targetMuscles: ['biceps', 'triceps'] }, FULL, sessions);
    for (const it of workout.items) expect(primaryMuscles(byId.get(it.exerciseId)!)).not.toContain('biceps');
    expect(workout.items.length).toBeGreaterThan(0);
  });

  it('creates superset blocks from two exercises sharing a group', () => {
    const { workout } = gen({ setTypes: ['superset'] });
    const blocks = buildBlocks(workout.items);
    expect(blocks.length).toBeGreaterThan(0);
    for (const b of blocks) {
      expect(b).toHaveLength(2);
      expect(b.every((i) => i.setType === 'superset' && byId.get(i.exerciseId)!.supersetOk)).toBe(true);
      expect(b[0].sets).toBe(b[1].sets);
    }
  });

  it('creates HIIT circuits with work/rest intervals', () => {
    const { workout } = gen({ setTypes: ['hiit'], maxMinutes: 20 });
    const hiit = workout.items.filter((i) => i.setType === 'hiit');
    expect(hiit.length).toBeGreaterThanOrEqual(2);
    for (const it of hiit) {
      expect(byId.get(it.exerciseId)!.hiitOk).toBe(true);
      expect(it.durationSec).toBeGreaterThan(0);
      expect(it.restSec).toBeLessThanOrEqual(30);
    }
  });

  it('generates one progressed shared interval from actual same-type history for every member', () => {
    const sessions = exercises.filter((e) => e.hiitOk).map((e) =>
      session(e.id, [{ reps: 0, weightKg: 20, bodyweight: e.kind === 'bodyweight', durationSec: 40, effort: 7 }], { setType: 'hiit', at: NOW - HOUR }),
    );
    const { workout } = gen({ setTypes: ['hiit'], maxMinutes: 20 }, FULL, sessions);
    const hiit = workout.items.filter((i) => i.setType === 'hiit');
    expect(hiit.length).toBeGreaterThanOrEqual(2);
    expect(new Set(hiit.map((i) => i.durationSec))).toEqual(new Set([45]));
  });

  it('mixes set types, ordering regular → superset → hiit', () => {
    const { workout } = gen({ setTypes: ['regular', 'superset', 'hiit'], maxMinutes: 60 });
    const types = workout.items.map((i) => i.setType);
    expect(new Set(types)).toEqual(new Set(['regular', 'superset', 'hiit']));
    const rank = { regular: 0, superset: 1, hiit: 2 };
    const ranks = types.map((t) => rank[t]);
    expect(ranks).toEqual([...ranks].sort());
  });

  it('adds a cardio warm-up first when requested', () => {
    const { workout } = gen({ cardioWarmup: true }, MACHINES);
    expect(byId.get(workout.items[0].exerciseId)!.kind).toBe('cardio');
    expect(workout.items[0].setType).toBe('regular');
  });

  it('falls back to free cardio for the warm-up when no cardio machine is owned', () => {
    const { workout } = gen({ cardioWarmup: true }, FULL);
    const first = byId.get(workout.items[0].exerciseId)!;
    expect(first.kind).toBe('cardio');
    expect(isMachineCardio(first)).toBe(false);
  });

  it('fits the requested time frame', () => {
    for (const minutes of [15, 30, 45, 60, 90]) {
      const { workout } = gen({ maxMinutes: minutes, setTypes: ['regular', 'superset'] });
      const est = estimateWorkoutMinutes(workout.items, byId);
      expect(est).toBeLessThanOrEqual(Math.ceil(minutes * 1.15));
      expect(est).toBeGreaterThan(minutes * 0.4);
    }
  });

  it('longer time frames produce more exercises', () => {
    const short = gen({ maxMinutes: 15 }).workout.items.length;
    const long = gen({ maxMinutes: 75 }).workout.items.length;
    expect(long).toBeGreaterThan(short);
  });

  it('does not repeat exercises', () => {
    const { workout } = gen({ setTypes: ['regular', 'superset', 'hiit'], maxMinutes: 90 });
    const ids = workout.items.map((i) => i.exerciseId);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('uses history to set weights', () => {
    const sessions = [session('db_curl', [{ reps: 12, weightKg: 14, effort: 6 }], { at: NOW - 86_400_000 })];
    const { workout } = gen({ targetMuscles: ['biceps'] }, ['dumbbell'], sessions);
    const curl = workout.items.find((i) => i.exerciseId === 'db_curl');
    if (curl) expect(curl.weightKg).toBeGreaterThan(14);
  });

  it('reports a note when nothing can be built', () => {
    const { workout, notes } = gen({ targetMuscles: ['biceps'], setTypes: ['hiit'] }, []);
    expect(workout.items).toHaveLength(0);
    expect(notes.length).toBeGreaterThan(0);
  });

  it('stores the criteria on the workout', () => {
    const c = base({ targetMuscles: ['quads'], maxMinutes: 30 });
    expect(generateWorkout({ exercises, ownedEquipment: FULL, criteria: c, sessions: [], rng: seeded(3) }).workout.criteria).toEqual(c);
  });
});

describe('swapCandidates', () => {
  const owned = FULL;
  it('returns exercises for the same muscle that meet all criteria', () => {
    const { workout } = gen({ targetMuscles: ['chest'], setTypes: ['regular'] });
    const item = workout.items[0];
    const original = byId.get(item.exerciseId)!;
    const cands = swapCandidates(workout, item, exercises, owned);
    expect(cands.length).toBeGreaterThan(0);
    for (const c of cands) {
      expect(c.id).not.toBe(original.id);
      expect(primaryMuscles(c).some((m) => primaryMuscles(original).includes(m))).toBe(true);
      expect(hasEquipment(c, new Set(owned))).toBe(true);
      expect(fitsCriteria(c, item.setType, workout.criteria, undefined)).toBe(true);
    }
  });

  it('excludes exercises already in the workout and those lacking equipment', () => {
    const { workout } = gen({ targetMuscles: ['chest'] }, ['dumbbell', 'bench']);
    const item = workout.items[0];
    const cands = swapCandidates(workout, item, exercises, ['dumbbell', 'bench']);
    const inWorkout = new Set(workout.items.map((i) => i.exerciseId));
    for (const c of cands) {
      expect(inWorkout.has(c.id)).toBe(false);
      expect(c.equipment.every((e) => ['dumbbell', 'bench'].includes(e))).toBe(true);
    }
  });

  it('only offers exercises that support the item set type', () => {
    const { workout } = gen({ setTypes: ['hiit'], maxMinutes: 20 });
    const item = workout.items[0];
    for (const c of swapCandidates(workout, item, exercises, owned)) expect(c.hiitOk).toBe(true);
    const ss = gen({ setTypes: ['superset'] }).workout;
    for (const c of swapCandidates(ss, ss.items[0], exercises, owned)) expect(c.supersetOk).toBe(true);
  });

  it('excludes candidates that conflict with the workout target muscles', () => {
    const { workout } = gen({ targetMuscles: ['quads'], setTypes: ['regular'] });
    const item = workout.items[0];
    for (const c of swapCandidates(workout, item, exercises, owned)) {
      expect(primaryMuscles(c)).toContain('quads');
    }
  });

  it('excludes candidates for fatigued muscles when the workout is fatigue-based', () => {
    const { workout } = gen({ useFatigue: true, targetMuscles: ['quads', 'glutes'] });
    const item = workout.items[0];
    const sessions = [session('squat', Array.from({ length: 10 }, () => ({ effort: 10 })), { at: NOW - HOUR })];
    const status = computeMuscleStatus(sessions, exercises, NOW);
    expect(swapCandidates(workout, item, exercises, owned, status)).toHaveLength(0);
  });
});

describe('inactive exercises', () => {
  it('are excluded from generated workouts but remain in the pool', () => {
    const { workout } = gen({}, FULL, [], 3);
    const used = new Set(workout.items.map((i) => i.exerciseId));
    const marked = exercises.map((e) => (used.has(e.id) ? { ...e, inactive: true } : e));
    const r = generateWorkout({ exercises: marked, ownedEquipment: FULL, criteria: base(), sessions: [], rng: seeded(3) });
    expect(r.workout.items.every((i) => !used.has(i.exerciseId))).toBe(true);
    expect(marked.filter((e) => e.inactive).length).toBe(used.size);
  });
});
