import { byId, session } from '../test/helpers';
import { muscleProgress, progressExerciseSeries, rangeStart, summarize } from './progress';

const now = new Date(2026, 10, 20, 12).getTime();
const bench = byId.get('bench_press')!;
const pushup = byId.get('pushup')!;
const plank = byId.get('plank')!;

describe('exercise progress', () => {
  it('filters individual sets by time and set type, keeps partial entries and sorts chronologically', () => {
    const start = rangeStart('4w', now);
    const sessions = [
      session(bench.id, [{ at: now - 1, reps: 5, weightKg: 50 }, { at: now + 1, reps: 5, weightKg: 100 }], { at: now }),
      session(bench.id, [{ at: start, reps: 10, weightKg: 20 }, { at: start - 1, reps: 10, weightKg: 100 }], { at: start }),
      session(bench.id, [{ reps: 10, weightKg: 99 }], { at: now, skipped: true }),
      session(bench.id, [{ reps: 8, weightKg: 30 }], { at: now, setType: 'superset' }),
    ];
    expect(progressExerciseSeries(bench, sessions, 'volume', '4w', now, 'regular')).toEqual([
      { x: start, y: 200 }, { x: now - 1, y: 250 },
    ]);
  });

  it('excludes HIIT and timed entries from rep metrics without excluding duration and effort', () => {
    const hiit = session(pushup.id, [{ reps: 10, weightKg: 0, durationSec: 40 }], { at: now, setType: 'hiit' });
    const timed = session(plank.id, [{ reps: 10, durationSec: 45 }], { at: now });
    expect(progressExerciseSeries(pushup, [hiit], 'maxReps', 'all', now)).toEqual([]);
    expect(progressExerciseSeries(plank, [timed], 'volume', 'all', now)).toEqual([]);
    expect(progressExerciseSeries(plank, [timed], 'duration', 'all', now)[0].y).toBe(45);
    expect(progressExerciseSeries(pushup, [hiit], 'effort', 'all', now)[0].y).toBe(7);
  });

  it('shows absolute change but not a percentage with a zero baseline', () => {
    expect(summarize([{ x: 1, y: 0 }, { x: 2, y: 5 }])).toEqual({ latest: 5, best: 5, change: 5, percent: null });
    expect(summarize([{ x: 1, y: 5 }])?.change).toBeNull();
    expect(summarize([])).toBeNull();
  });
});

describe('muscle progress', () => {
  it('counts primary muscles, repeated entries and timed sets while excluding nominal HIIT volume', () => {
    const sessions = [
      session(bench.id, [{ reps: 10, weightKg: 20 }], { at: now - 100 }),
      session(pushup.id, [{ reps: 12, weightKg: 0, bodyweight: true }], { at: now - 200 }),
      session(pushup.id, [{ reps: 30, weightKg: 5 }], { at: now - 300, setType: 'hiit' }),
      session('missing', [{}], { at: now }),
      session(bench.id, [{}], { at: now, skipped: true }),
      session(bench.id, [{ at: now + 1 }], { at: now }),
    ];
    const result = muscleProgress('chest', sessions, [bench, pushup], '4w', now);
    expect(result.totalSets).toBe(3);
    expect(result.volumeKg).toBe(200);
    expect(result.exercises).toEqual([{ id: pushup.id, sets: 2 }, { id: bench.id, sets: 1 }]);
    expect(muscleProgress('triceps', sessions, [bench, pushup], '4w', now).totalSets).toBe(0);
    const timed = muscleProgress('abs', [session(plank.id, [{ reps: 10 }], { at: now })], [plank], '4w', now);
    expect(timed.totalSets).toBe(1);
    expect(timed.volumeKg).toBeNull();
    expect(timed.weeks.at(-1)?.volumeKg).toBeNull();
    expect(timed.weeks.at(-1)?.complete).toBe(false);
  });

  it('distinguishes zero added weight from unavailable volume and includes inactive history', () => {
    const result = muscleProgress('chest', [session(pushup.id, [{ reps: 10, weightKg: 0 }], { at: now })], [{ ...pushup, inactive: true }], 'all', now);
    expect(result.volumeKg).toBe(0);
    expect(result.weeks.at(-1)?.volumeKg).toBe(0);
  });

  it('counts compound work for each primary muscle and marks boundary weeks partial', () => {
    const compound = { ...bench, muscles: { chest: 1, triceps: 1 } };
    const start = rangeStart('4w', now);
    const sessions = [session(compound.id, [{ at: start, reps: 5, weightKg: 20 }], { at: start })];
    const chest = muscleProgress('chest', sessions, [compound], '4w', now);
    const triceps = muscleProgress('triceps', sessions, [compound], '4w', now);
    expect(chest.totalSets).toBe(1);
    expect(triceps.totalSets).toBe(1);
    expect(chest.weeks[0]).toMatchObject({ sets: 1, volumeKg: 100, complete: false });
    expect(chest.weeks.slice(1, -1).every((week) => week.complete)).toBe(true);
    expect(chest.weeks.at(-1)?.complete).toBe(false);
  });
});
