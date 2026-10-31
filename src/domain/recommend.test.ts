import { applyRecommendation, exerciseHistory, recommend, recommendedRest } from './recommend';
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

  it('uses a newly available heavier weight and resets reps for progression', () => {
    const s = [session('db_curl', [{ reps: 12, weightKg: 10, effort: 7 }, { reps: 12, weightKg: 10, effort: 7 }], { at: NOW - 3 * DAY })];
    const equipment = [{ id: 'dumbbell', name: 'Dumbbells', owned: true, weightOptionsKg: [5, 10, 12.5] }];
    const r = recommend(dbCurl, 'regular', s, 1, NOW, equipment);
    expect(r.weightKg).toBe(12.5);
    expect(r.reps).toBe(dbCurl.repMin);
  });

  it('increases time at the equipment limit, then reduces time when heavier equipment is added', () => {
    const weightedTimed = { ...plank, equipment: ['dumbbell'] };
    const s = [session('plank', [{ reps: 0, durationSec: 60, weightKg: 10, effort: 6 }], { at: NOW - DAY })];
    const limited = [{ id: 'dumbbell', name: 'Dumbbells', owned: true, weightOptionsKg: [5, 10] }];
    const expanded = [{ ...limited[0], weightOptionsKg: [5, 10, 12.5] }];

    const atLimit = recommend(weightedTimed, 'regular', s, 1, NOW, limited);
    const withMoreWeight = recommend(weightedTimed, 'regular', s, 1, NOW, expanded);
    expect(atLimit.weightKg).toBe(10);
    expect(atLimit.durationSec).toBeGreaterThan(60);
    expect(withMoreWeight.weightKg).toBe(12.5);
    expect(withMoreWeight.durationSec).toBeLessThan(60);
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

  it('bodyweight: adds reps, then added weight at the top of the range', () => {
    const easy = [session('pushup', [{ reps: 15, weightKg: 0, bodyweight: true, effort: 6 }], { at: NOW - DAY })];
    const r1 = recommend(pushup, 'regular', easy, 1, NOW);
    expect(r1.bodyweight).toBe(true);
    expect(r1.reps).toBeGreaterThan(15);
    const top = [session('pushup', [{ reps: 25, weightKg: 0, bodyweight: true, effort: 7 }], { at: NOW - DAY })];
    const r2 = recommend(pushup, 'regular', top, 1, NOW);
    expect(r2.weightKg).toBeGreaterThan(0);
    expect(r2.reps).toBe(pushup.repMin);
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
