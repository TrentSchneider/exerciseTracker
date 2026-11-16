import { applyRecommendation, exerciseHistory, recommend, recommendedRest } from './recommend';
import { displayToKg, kgToDisplay } from './units';
import { byId, DAY, session } from '../test/helpers';

const NOW = 1_800_000_000_000;
const bench = byId.get('bench_press')!; // 5-8 reps
const dbCurl = byId.get('db_curl')!; // 8-12
const pushup = byId.get('pushup')!; // 8-25
const plank = byId.get('plank')!;

describe('recommend', () => {
  it('gives a starting suggestion with no history', () => {
    const r = recommend(dbCurl, 'regular', [], 1, NOW);
    expect(r.weightKg).toBe(dbCurl.startKg);
    expect(r.reps).toBeGreaterThanOrEqual(dbCurl.repMin);
    expect(r.reason).toMatch(/no history/i);
  });

  it('adds a rep when the last session felt easy', () => {
    const s = [session('db_curl', [{ reps: 9, weightKg: 10, effort: 6 }, { reps: 9, weightKg: 10, effort: 6 }, { reps: 9, weightKg: 10, effort: 6 }], { at: NOW - 3 * DAY })];
    const r = recommend(dbCurl, 'regular', s, 1, NOW);
    expect(r.weightKg).toBe(10);
    expect(r.reps).toBe(10);
  });

  it('increases weight after hitting the top of the rep range', () => {
    const s = [session('db_curl', [{ reps: 12, weightKg: 10, effort: 7 }, { reps: 12, weightKg: 10, effort: 7 }], { at: NOW - 3 * DAY })];
    const r = recommend(dbCurl, 'regular', s, 1, NOW);
    expect(r.weightKg).toBeGreaterThan(10);
    expect(r.reps).toBe(dbCurl.repMin);
  });

  it('limits starting weight to an available equipment option', () => {
    const equipment = [{ id: 'dumbbell', name: 'Dumbbells', owned: true, weightOptionsKg: [2.26796185, 4.5359237] }];
    const r = recommend(dbCurl, 'regular', [], 1, NOW, equipment);
    expect(r.weightKg).toBe(4.5359237);
    expect(equipment[0].weightOptionsKg).toContain(r.weightKg);
  });

  it('increases reps beyond the normal range when already at the heaviest available weight', () => {
    const s = [session('db_curl', [{ reps: 12, weightKg: 10, effort: 7 }, { reps: 12, weightKg: 10, effort: 7 }], { at: NOW - 3 * DAY })];
    const equipment = [{ id: 'dumbbell', name: 'Dumbbells', owned: true, weightOptionsKg: [5, 10] }];
    const r = recommend(dbCurl, 'regular', s, 1, NOW, equipment);
    expect(r.weightKg).toBe(10);
    expect(r.reps).toBeGreaterThan(dbCurl.repMax);
    expect(r.reason).toMatch(/equipment limit/i);
  });

  it('uses a manageable available weight increase and resets reps for progression', () => {
    const s = [session('db_curl', [{ reps: 12, weightKg: 10, effort: 7 }, { reps: 12, weightKg: 10, effort: 7 }], { at: NOW - 3 * DAY })];
    const equipment = [{ id: 'dumbbell', name: 'Dumbbells', owned: true, weightOptionsKg: [5, 10, 11] }];
    const r = recommend(dbCurl, 'regular', s, 1, NOW, equipment);
    expect(r.weightKg).toBe(11);
    expect(r.reps).toBe(dbCurl.repMin);
  });

  it('preserves exact available pound weights for progression, holding, and reductions', () => {
    const options = [5, 10, 15, 20, 25].map((lb) => displayToKg(lb, 'lb'));
    const equipment = [{ id: 'dumbbell', name: 'Dumbbells', owned: true, weightOptionsKg: options }];
    const cases = [
      { reps: 12, weightKg: options[1], effort: 7, expected: 10 },
      { reps: 10, weightKg: options[2], effort: 9, expected: 15 },
      { reps: 8, weightKg: options[2], effort: 10, expected: 10 },
    ];
    for (const { expected, ...log } of cases) {
      const history = [session('db_curl', [log], { at: NOW - DAY })];
      const r = recommend(dbCurl, 'regular', history, 1, NOW, equipment);
      expect(options).toContain(r.weightKg);
      expect(kgToDisplay(r.weightKg, 'lb')).toBe(expected);
    }
  });

  it('adds one rep at the equipment limit on repeated sessions', () => {
    const options = [5, 10, 15, 20, 25].map((lb) => displayToKg(lb, 'lb'));
    const equipment = [{ id: 'dumbbell', name: 'Dumbbells', owned: true, weightOptionsKg: options }];
    for (const reps of [12, 20]) {
      const history = [session('db_curl', [{ reps, weightKg: options[4], effort: 7 }], { at: NOW - DAY })];
      const r = recommend(dbCurl, 'regular', history, 1, NOW, equipment);
      expect(r.weightKg).toBe(options[4]);
      expect(r.reps).toBe(reps + 1);
      expect(r.reason).toMatch(/adding a rep instead/i);
    }
  });

  it('uses a conservative target when previous equipment was heavier than the current maximum', () => {
    const equipment = [{ id: 'dumbbell', name: 'Dumbbells', owned: true, weightOptionsKg: [5, 10, 15, 20, 25] }];
    const history = [session('db_curl', [{ reps: 12, weightKg: 30, effort: 7 }], { at: NOW - DAY })];
    const r = recommend(dbCurl, 'regular', history, 1, NOW, equipment);
    expect(r.weightKg).toBe(25);
    expect(r.reps).toBe(12);
  });

  it('does not increase equipment weight after a layoff', () => {
    const equipment = [{ id: 'dumbbell', name: 'Dumbbells', owned: true, weightOptionsKg: [0.5, 1, 1.5, 2] }];
    const history = [session('db_curl', [{ reps: 12, weightKg: 1, effort: 7 }], { at: NOW - 30 * DAY })];
    const r = recommend(dbCurl, 'regular', history, 1, NOW, equipment);
    expect(r.weightKg).toBe(0.5);
    expect(r.reason).toMatch(/time away/i);
  });

  it('increases time at the equipment limit, then holds time with a manageable weight increase', () => {
    const weightedTimed = { ...plank, equipment: ['dumbbell'] };
    const s = [session('plank', [{ reps: 0, durationSec: 60, weightKg: 10, effort: 6 }], { at: NOW - DAY })];
    const limited = [{ id: 'dumbbell', name: 'Dumbbells', owned: true, weightOptionsKg: [5, 10] }];
    const expanded = [{ ...limited[0], weightOptionsKg: [5, 10, 11] }];

    const atLimit = recommend(weightedTimed, 'regular', s, 1, NOW, limited);
    const withMoreWeight = recommend(weightedTimed, 'regular', s, 1, NOW, expanded);
    expect(atLimit.weightKg).toBe(10);
    expect(atLimit.durationSec).toBeGreaterThan(60);
    expect(withMoreWeight.weightKg).toBe(11);
    expect(withMoreWeight.durationSec).toBe(60);
  });

  it('does not increase timed exercise weight after a layoff', () => {
    const weightedTimed = { ...plank, equipment: ['dumbbell'] };
    const history = [session('plank', [{ reps: 0, durationSec: 60, weightKg: 10, effort: 6 }], { at: NOW - 30 * DAY })];
    const equipment = [{ id: 'dumbbell', name: 'Dumbbells', owned: true, weightOptionsKg: [5, 10, 15] }];
    const r = recommend(weightedTimed, 'regular', history, 1, NOW, equipment);
    expect(r.weightKg).toBe(5);
    expect(r.reason).toMatch(/time away/i);
  });

  it('uses goal-specific ranges for built-in weighted exercises but not custom exercises', () => {
    const history = [session('db_curl', [{ reps: 8, weightKg: 10, effort: 7 }], { at: NOW - DAY })];
    const strength = recommend(dbCurl, 'regular', history, 1, NOW, [], { progressionGoal: 'strength' });
    const muscle = recommend(dbCurl, 'regular', history, 1, NOW, [], { progressionGoal: 'muscle' });
    const custom = recommend({ ...dbCurl, custom: true }, 'regular', history, 1, NOW, [], { progressionGoal: 'strength' });
    expect(strength.weightKg).toBeGreaterThan(10);
    expect(strength.reps).toBe(4);
    expect(muscle.weightKg).toBe(10);
    expect(muscle.reps).toBe(9);
    expect(custom.weightKg).toBe(10);
    expect(custom.reps).toBe(9);
  });

  it('only trials a large jump after two qualifying sessions, and does not retry immediately after failure', () => {
    const equipment = [{ id: 'dumbbell', name: 'Dumbbells', owned: true, weightOptionsKg: [10, 12.5] }];
    const easy = (days: number, reps = 14) => session('db_curl', [{ reps, weightKg: 10, effort: 7 }], { at: NOW - days * DAY });
    const once = recommend(dbCurl, 'regular', [easy(1)], 1, NOW, equipment);
    expect(once.weightKg).toBe(10);
    expect(once.reps).toBe(15);
    const twice = recommend(dbCurl, 'regular', [easy(1), easy(2)], 1, NOW, equipment);
    expect(twice.weightKg).toBe(12.5);
    expect(twice.reps).toBe(8);
    expect(twice.reason).toMatch(/trying/i);

    const failed = session('db_curl', [{ reps: 7, weightKg: 12.5, effort: 10 }], { at: NOW - 2 * DAY });
    const afterFailure = recommend(dbCurl, 'regular', [easy(1), failed, easy(3), easy(4)], 1, NOW, equipment);
    expect(afterFailure.weightKg).toBe(10);
    expect(afterFailure.reps).toBe(15);
    const readyAgain = recommend(dbCurl, 'regular', [easy(1), easy(1.5), failed, easy(3)], 1, NOW, equipment);
    expect(readyAgain.weightKg).toBe(12.5);
    const reduction = recommend(dbCurl, 'regular', [failed, easy(3)], 1, NOW, equipment);
    expect(reduction.weightKg).toBe(10);
  });

  it('honors the configured jump threshold and rejects automatic jumps above 30%', () => {
    const history = [session('db_curl', [{ reps: 14, weightKg: 10, effort: 7 }], { at: NOW - DAY }),
      session('db_curl', [{ reps: 14, weightKg: 10, effort: 7 }], { at: NOW - 2 * DAY })];
    const equipment = [{ id: 'dumbbell', name: 'Dumbbells', owned: true, weightOptionsKg: [10, 11] }];
    expect(recommend(dbCurl, 'regular', history.slice(0, 1), 1, NOW, equipment, { largeJumpPercent: 10 }).weightKg).toBe(11);
    expect(recommend(dbCurl, 'regular', history.slice(0, 1), 1, NOW, equipment, { largeJumpPercent: 5 }).weightKg).toBe(10);
    const extreme = [{ ...equipment[0], weightOptionsKg: [10, 20] }];
    const r = recommend(dbCurl, 'regular', history, 1, NOW, extreme, { largeJumpPercent: 20 });
    expect(r.weightKg).toBe(10);
    expect(r.reps).toBe(15);
    expect(r.reason).toMatch(/more than 30%/);
  });

  it('treats threshold and 30% boundaries as inclusive', () => {
    const easy = (days: number) => session('db_curl', [{ reps: 14, weightKg: 10, effort: 7 }], { at: NOW - days * DAY });
    const weights = (next: number) => [{ id: 'dumbbell', name: 'Dumbbells', owned: true, weightOptionsKg: [10, next] }];
    expect(recommend(dbCurl, 'regular', [easy(1)], 1, NOW, weights(11.25), { largeJumpPercent: 12.5 }).weightKg).toBe(11.25);
    expect(recommend(dbCurl, 'regular', [easy(1)], 1, NOW, weights(11.26), { largeJumpPercent: 12.5 }).weightKg).toBe(10);
    expect(recommend(dbCurl, 'regular', [easy(1), easy(2)], 1, NOW, weights(13)).weightKg).toBe(13);
    expect(recommend(dbCurl, 'regular', [easy(1), easy(2)], 1, NOW, weights(13.01)).weightKg).toBe(10);
  });

  it('uses the last work weight and only its matching sets for reps and effort', () => {
    const history = [session('db_curl', [
      { reps: 5, weightKg: 15, effort: 10 },
      { reps: 10, weightKg: 10, effort: 7 },
      { reps: 10, weightKg: 10, effort: 7 },
    ], { at: NOW - DAY })];
    const r = recommend(dbCurl, 'regular', history, 1, NOW);
    expect(r.weightKg).toBe(10);
    expect(r.reps).toBe(11);
  });

  it('does not progress on missing valid work or on an RPE 10 matching set', () => {
    const empty = [session('db_curl', [{ reps: 0, weightKg: 10, effort: 7 }], { at: NOW - DAY })];
    expect(recommend(dbCurl, 'regular', empty, 1, NOW).reason).toMatch(/not enough/i);
    const hard = [session('db_curl', [{ reps: 12, weightKg: 10, effort: 6 }, { reps: 12, weightKg: 10, effort: 10 }], { at: NOW - DAY })];
    expect(recommend(dbCurl, 'regular', hard, 1, NOW).weightKg).toBeLessThan(10);
  });

  it('requires two easy sessions before an initial bodyweight added-load trial', () => {
    const ex = { ...pushup, equipment: ['dumbbell'] };
    const equipment = [{ id: 'dumbbell', name: 'Dumbbells', owned: true, weightOptionsKg: [2, 4] }];
    const easy = (days: number) => session('pushup', [{ reps: 27, weightKg: 0, bodyweight: true, effort: 7 }], { at: NOW - days * DAY });
    expect(recommend(ex, 'regular', [easy(1)], 1, NOW, equipment).weightKg).toBe(0);
    const trial = recommend(ex, 'regular', [easy(1), easy(2)], 1, NOW, equipment);
    expect(trial.weightKg).toBe(2);
    expect(trial.bodyweight).toBe(true);
  });

  it('requires two easy timed sessions to trial a large added-load jump without changing duration', () => {
    const ex = { ...plank, equipment: ['dumbbell'] };
    const equipment = [{ id: 'dumbbell', name: 'Dumbbells', owned: true, weightOptionsKg: [10, 12.5] }];
    const easy = (days: number) => session('plank', [{ durationSec: 60, weightKg: 10, effort: 7 }], { at: NOW - days * DAY });
    const before = recommend(ex, 'regular', [easy(1)], 1, NOW, equipment);
    expect(before.weightKg).toBe(10);
    expect(before.durationSec).toBe(65);
    const trial = recommend(ex, 'regular', [easy(1), easy(2)], 1, NOW, equipment);
    expect(trial.weightKg).toBe(12.5);
    expect(trial.durationSec).toBe(60);
  });

  it('does not progress HIIT using nominal reps without recorded duration', () => {
    const history = [session('db_curl', [{ reps: 20, durationSec: 0, weightKg: 10, effort: 7 }], { at: NOW - DAY, setType: 'hiit' })];
    const r = recommend(dbCurl, 'hiit', history, 1, NOW);
    expect(r.durationSec).toBe(40);
    expect(r.reason).toMatch(/not enough recorded work/i);
  });

  it('does not claim to add time beyond the timed exercise limit', () => {
    const history = [session('plank', [{ durationSec: 600, weightKg: 0, effort: 7 }], { at: NOW - DAY })];
    const r = recommend(plank, 'regular', history, 1, NOW);
    expect(r.durationSec).toBe(600);
    expect(r.reason).toMatch(/time limit reached/i);
  });

  it('holds weight at hard-but-ok effort', () => {
    const s = [session('db_curl', [{ reps: 10, weightKg: 10, effort: 9 }], { at: NOW - 3 * DAY })];
    const r = recommend(dbCurl, 'regular', s, 1, NOW);
    expect(r.weightKg).toBe(10);
    expect(r.reps).toBe(10);
  });

  it('decreases weight when effort was maximal', () => {
    const s = [session('db_curl', [{ reps: 8, weightKg: 10, effort: 10 }], { at: NOW - 3 * DAY })];
    expect(recommend(dbCurl, 'regular', s, 1, NOW).weightKg).toBeLessThan(10);
  });

  it('decreases weight when reps fell under the range', () => {
    const s = [session('bench_press', [{ reps: 3, weightKg: 60, effort: 8 }], { at: NOW - 3 * DAY })];
    expect(recommend(bench, 'regular', s, 1, NOW).weightKg).toBeLessThan(60);
  });

  it('reduces load after a long layoff', () => {
    const s = [session('db_curl', [{ reps: 10, weightKg: 10, effort: 9 }], { at: NOW - 30 * DAY })];
    const r = recommend(dbCurl, 'regular', s, 1, NOW);
    expect(r.weightKg).toBeLessThan(10);
    expect(r.reason).toMatch(/time away/i);
  });

  it('uses the most recent session only', () => {
    const s = [
      session('db_curl', [{ reps: 10, weightKg: 8, effort: 9 }], { at: NOW - 20 * DAY }),
      session('db_curl', [{ reps: 10, weightKg: 12, effort: 9 }], { at: NOW - 2 * DAY }),
    ];
    expect(recommend(dbCurl, 'regular', s, 1, NOW).weightKg).toBe(12);
  });

  it('tracks set types separately', () => {
    const s = [
      session('db_curl', [{ reps: 12, weightKg: 10, effort: 7 }], { at: NOW - 5 * DAY, setType: 'regular' }),
      session('db_curl', [{ reps: 10, weightKg: 8, effort: 9 }], { at: NOW - 1 * DAY, setType: 'superset' }),
    ];
    expect(exerciseHistory('db_curl', s, 'regular')).toHaveLength(1);
    expect(recommend(dbCurl, 'superset', s, 1, NOW).weightKg).toBe(8); // superset history, hold
    expect(recommend(dbCurl, 'regular', s, 1, NOW).weightKg).toBeGreaterThan(10); // regular history only
  });

  it('borrows from other set types (scaled) when a type has no history', () => {
    const s = [session('db_curl', [{ reps: 10, weightKg: 10, effort: 9 }], { at: NOW - 2 * DAY, setType: 'regular' })];
    const hiit = recommend(dbCurl, 'hiit', s, 1, NOW);
    expect(hiit.weightKg).toBeLessThan(10);
    expect(hiit.reason).toMatch(/adjusted from regular/);
  });

  it('ignores skipped exercises in history', () => {
    const s = [session('db_curl', [], { at: NOW - 2 * DAY, skipped: true })];
    expect(exerciseHistory('db_curl', s)).toHaveLength(0);
    expect(recommend(dbCurl, 'regular', s, 1, NOW).reason).toMatch(/no history/i);
  });

  it('bodyweight: continues adding reps without configured added weights', () => {
    const easy = [session('pushup', [{ reps: 15, weightKg: 0, bodyweight: true, effort: 6 }], { at: NOW - DAY })];
    const r1 = recommend(pushup, 'regular', easy, 1, NOW);
    expect(r1.bodyweight).toBe(true);
    expect(r1.reps).toBeGreaterThan(15);
    const top = [session('pushup', [{ reps: 25, weightKg: 0, bodyweight: true, effort: 7 }], { at: NOW - DAY })];
    const r2 = recommend(pushup, 'regular', top, 1, NOW);
    expect(r2.weightKg).toBe(0);
    expect(r2.reps).toBe(26);
  });

  it('bodyweight: reduces reps when maximal', () => {
    const hard = [session('pushup', [{ reps: 15, weightKg: 0, bodyweight: true, effort: 10 }], { at: NOW - DAY })];
    expect(recommend(pushup, 'regular', hard, 1, NOW).reps).toBeLessThan(15);
  });

  it('timed: increases or decreases duration by effort', () => {
    const easy = [session('plank', [{ reps: 0, durationSec: 45, bodyweight: true, effort: 5 }], { at: NOW - DAY })];
    const hard = [session('plank', [{ reps: 0, durationSec: 45, bodyweight: true, effort: 10 }], { at: NOW - DAY })];
    expect(recommend(plank, 'regular', easy, 1, NOW).durationSec).toBeGreaterThan(45);
    expect(recommend(plank, 'regular', hard, 1, NOW).durationSec).toBeLessThan(45);
  });

  it('scales rest by setting and uses short rests for hiit', () => {
    expect(recommendedRest(bench, 'regular', 1)).toBe(120);
    expect(recommendedRest(bench, 'regular', 0.5)).toBe(60);
    expect(recommendedRest(bench, 'hiit', 1)).toBe(20);
    expect(recommendedRest(bench, 'superset', 1)).toBeLessThanOrEqual(75);
  });

  it('applyRecommendation respects manual overrides', () => {
    const item = { id: 'i', exerciseId: 'db_curl', setType: 'regular' as const, sets: 3, reps: 5, weightKg: 99, bodyweight: false, durationSec: 0, restSec: 60, manual: true };
    expect(applyRecommendation(item, dbCurl, [], 1, NOW)).toBe(item);
    const auto = applyRecommendation({ ...item, manual: false }, dbCurl, [], 1, NOW);
    expect(auto.weightKg).toBe(dbCurl.startKg);
  });
});
