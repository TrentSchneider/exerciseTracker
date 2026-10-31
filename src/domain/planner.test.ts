import { agenda, agendaForDate, monthGrid, dayCriteria, generateForRoutineDay } from './planner';
import { buildBlocks, estimateWorkoutMinutes, estimateWorkoutSeconds, itemSummary, refreshRecommendations } from './workout';
import { METRIC_LABELS, epley, exerciseSeries, metricsFor } from './stats';
import { dateKey, displayToKg, formatDuration, formatWeight, kgToDisplay } from './units';
import { byId, DAY, exercises, seeded, session } from '../test/helpers';
import type { PlanItem, Routine } from '../types';

const item = (over: Partial<PlanItem>): PlanItem => ({
  id: 'i', exerciseId: 'db_curl', setType: 'regular', sets: 3, reps: 10, weightKg: 10, bodyweight: false, durationSec: 0, restSec: 60, ...over,
});

describe('units', () => {
  it('converts kg/lb', () => {
    expect(kgToDisplay(100, 'lb')).toBeCloseTo(220.5, 1);
    expect(kgToDisplay(100, 'kg')).toBe(100);
    expect(displayToKg(220.462, 'lb')).toBeCloseTo(100, 1);
    expect(formatWeight(10, 'kg')).toBe('10 kg');
  });
  it('formats durations', () => {
    expect(formatDuration(45)).toBe('45s');
    expect(formatDuration(125)).toBe('2:05');
  });
});

describe('workout time estimates', () => {
  it('counts rest between sets', () => {
    const short = estimateWorkoutSeconds([item({ restSec: 30 })], byId);
    const long = estimateWorkoutSeconds([item({ restSec: 120 })], byId);
    expect(long - short).toBe(2 * 90);
  });
  it('supersets take less time than the same exercises done straight', () => {
    const a = item({ id: 'a', exerciseId: 'db_curl' });
    const b = item({ id: 'b', exerciseId: 'tricep_pushdown' });
    const straight = estimateWorkoutSeconds([a, b], byId);
    const ss = estimateWorkoutSeconds([{ ...a, setType: 'superset', group: 'g' }, { ...b, setType: 'superset', group: 'g' }], byId);
    expect(ss).toBeLessThan(straight);
  });
  it('uses durations for timed exercises and hiit', () => {
    expect(estimateWorkoutMinutes([item({ exerciseId: 'plank', sets: 1, durationSec: 120 })], byId)).toBe(2);
    expect(estimateWorkoutSeconds([item({ exerciseId: 'burpee', setType: 'hiit', group: 'h', sets: 3, durationSec: 40, restSec: 20 })], byId)).toBe(3 * 40 + 2 * 20);
    expect(estimateWorkoutSeconds([], byId)).toBe(0);
  });
  it('adds the between-exercise rest between blocks', () => {
    const a = item({ id: 'a', sets: 1, transitionSec: 90 });
    const b = item({ id: 'b', sets: 1 });
    const alone = estimateWorkoutSeconds([a], byId) + estimateWorkoutSeconds([b], byId);
    expect(estimateWorkoutSeconds([a, b], byId)).toBe(alone + 90);
  });
  it('groups blocks and summarises items', () => {
    const blocks = buildBlocks([item({ id: '1' }), item({ id: '2', group: 'g' }), item({ id: '3', group: 'g' }), item({ id: '4' })]);
    expect(blocks.map((b) => b.length)).toEqual([1, 2, 1]);
    expect(itemSummary(item({}), byId.get('db_curl'))).toBe('3 × 10 reps');
    expect(itemSummary(item({ durationSec: 45 }), byId.get('plank'))).toBe('3 × 45s');
    expect(itemSummary(item({ setType: 'hiit', durationSec: 40 }), byId.get('burpee'))).toMatch(/40s work/);
  });
  it('refreshRecommendations updates only non-manual items', () => {
    const w = { id: 'w', name: 'w', createdAt: 0, items: [item({ id: 'x', weightKg: 99 }), item({ id: 'y', weightKg: 99, manual: true })] };
    const r = refreshRecommendations(w, byId, [], 1);
    expect(r.items[0].weightKg).toBe(byId.get('db_curl')!.startKg);
    expect(r.items[1].weightKg).toBe(99);
  });
});

describe('planner', () => {
  const routine: Routine = {
    id: 'r', name: 'PPL', active: true,
    days: [{ id: 'd1', weekday: 1, label: 'Push', targetMuscles: ['chest', 'triceps'], cardioWarmup: true, setTypes: ['regular', 'superset'], maxMinutes: 45 }],
  };
  it('lists plan entries and active routine days per date', () => {
    const monday = new Date(2026, 0, 5); // Monday
    const days = agenda(monday, 7, [{ id: 'p', date: '2026-01-06', workoutId: 'w' }], [routine]);
    expect(days).toHaveLength(7);
    expect(days[0].routineDays).toHaveLength(1);
    expect(days[1].entries).toHaveLength(1);
    expect(days[2].routineDays).toHaveLength(0);
    expect(agenda(monday, 1, [], [{ ...routine, active: false }])[0].routineDays).toHaveLength(0);
    expect(dateKey(monday)).toBe('2026-01-05');
  });
  it('generates a routine-day workout honoring targets, warm-up and set types', () => {
    const { workout } = generateForRoutineDay(routine.days[0], routine.name, {
      exercises, ownedEquipment: ['dumbbell', 'bench', 'bands', 'treadmill'], sessions: [], rng: seeded(2),
    });
    expect(dayCriteria(routine.days[0]).cardioWarmup).toBe(true);
    expect(byId.get(workout.items[0].exerciseId)!.kind).toBe('cardio');
    expect(workout.name).toBe('PPL — Push');
    expect(workout.items.length).toBeGreaterThan(2);
  });
});

describe('stats', () => {
  const sessions = [
    session('bench_press', [{ reps: 5, weightKg: 60, effort: 8 }, { reps: 5, weightKg: 60, effort: 9 }], { at: 1 * DAY }),
    session('bench_press', [{ reps: 5, weightKg: 62.5, effort: 8 }], { at: 3 * DAY }),
    session('bench_press', [{ reps: 8, weightKg: 40, effort: 6 }], { at: 4 * DAY, setType: 'hiit' }),
  ];
  it('builds ascending progress series per metric', () => {
    const s = exerciseSeries('bench_press', sessions, 'topWeight', 'regular');
    expect(s.map((p) => p.y)).toEqual([60, 62.5]);
    expect(exerciseSeries('bench_press', sessions, 'volume', 'regular').map((p) => p.y)).toEqual([600, 312.5]);
    expect(exerciseSeries('bench_press', sessions, 'effort', 'regular')[0].y).toBe(8.5);
    expect(exerciseSeries('bench_press', sessions, 'e1rm')).toHaveLength(3);
  });
  it('filters by set type', () => {
    expect(exerciseSeries('bench_press', sessions, 'topWeight', 'hiit')).toHaveLength(1);
    expect(exerciseSeries('bench_press', sessions, 'topWeight', 'superset')).toHaveLength(0);
  });
  it('excludes skipped sessions', () => {
    expect(exerciseSeries('bench_press', [session('bench_press', [], { skipped: true })], 'topWeight')).toHaveLength(0);
  });
  it('picks metrics by exercise kind', () => {
    expect(metricsFor(byId.get('bench_press')!)).toContain('e1rm');
    expect(metricsFor(byId.get('plank')!)).toContain('duration');
    expect(metricsFor(byId.get('pushup')!)).toContain('maxReps');
    expect(Object.keys(METRIC_LABELS).length).toBeGreaterThan(5);
    expect(epley(100, 1)).toBe(100);
    expect(epley(100, 10)).toBeCloseTo(133.3, 1);
  });
});

describe('seed data', () => {
  it('has a rich, valid exercise library', () => {
    expect(exercises.length).toBeGreaterThanOrEqual(80);
    const ids = new Set(exercises.map((e) => e.id));
    expect(ids.size).toBe(exercises.length);
    for (const e of exercises) {
      expect(Object.values(e.muscles).some((w) => (w ?? 0) >= 0.6)).toBe(true);
      expect(e.repMax).toBeGreaterThanOrEqual(e.repMin);
      if (e.kind === 'weighted') expect(e.startKg).toBeGreaterThan(0);
    }
  });
});

describe('recurrence', () => {
  const day = (weekdays: number[]) => ({ id: 'd', weekday: weekdays[0], weekdays, label: 'L', targetMuscles: [], cardioWarmup: false, setTypes: ['regular' as const], maxMinutes: 30 });
  const base = { id: 'r', name: 'R', active: true };
  const n = (r: Routine, y: number, m: number, d: number) => agendaForDate(new Date(y, m, d), [], [r]).routineDays.length;
  it('weekly supports several weekdays within start/end', () => {
    const r: Routine = { ...base, frequency: 'weekly', startDate: '2026-01-05', endDate: '2026-01-11', days: [day([1, 3])] };
    expect(n(r, 2026, 0, 5)).toBe(1); // Mon
    expect(n(r, 2026, 0, 7)).toBe(1); // Wed
    expect(n(r, 2026, 0, 6)).toBe(0);
    expect(n(r, 2026, 0, 12)).toBe(0); // after end
    expect(n(r, 2025, 11, 29)).toBe(0); // before start
  });
  it('daily repeats every day and no end date is unbounded', () => {
    const r: Routine = { ...base, frequency: 'daily', startDate: '2026-01-01', days: [day([1])] };
    expect(n(r, 2026, 0, 3)).toBe(1);
    expect(n(r, 2030, 5, 9)).toBe(1);
    expect(n(r, 2025, 11, 31)).toBe(0);
  });
  it('builds a Sunday-first month grid', () => {
    const g = monthGrid(2026, 0); // Jan 1 2026 is Thursday
    expect(g[0].slice(0, 4).every((c) => c === null)).toBe(true);
    expect(g[0][4]?.getDate()).toBe(1);
    expect(g.flat().filter(Boolean)).toHaveLength(31);
  });
});

describe('rotation', () => {
  const mk = (regions: ('upper' | 'lower' | 'core')[], rotate = true): Routine => ({
    id: 'r', name: 'R', active: true, frequency: 'weekly', startDate: '2026-01-05', rotate,
    days: [{ id: 'd', weekday: 1, weekdays: [1, 3, 5], label: 'Train', targetMuscles: [], targetRegions: regions, cardioWarmup: false, setTypes: ['regular'], maxMinutes: 30 }],
  });
  const seq = (r: Routine, dates: [number, number, number][]) =>
    dates.map(([y, m, d]) => agendaForDate(new Date(y, m, d), [], [r]).routineDays[0].day.targetRegions);
  it('full body rotates upper, core, lower on M/W/F', () => {
    expect(seq(mk([]), [[2026, 0, 5], [2026, 0, 7], [2026, 0, 9], [2026, 0, 12]])).toEqual([['upper'], ['core'], ['lower'], ['upper']]);
  });
  it('two groups alternate and continue across weeks', () => {
    expect(seq(mk(['upper', 'lower']), [[2026, 0, 5], [2026, 0, 7], [2026, 0, 9], [2026, 0, 12], [2026, 0, 14], [2026, 0, 16]]))
      .toEqual([['upper'], ['lower'], ['upper'], ['lower'], ['upper'], ['lower']]);
  });
  it('does nothing when off or with a single group', () => {
    expect(seq(mk([], false), [[2026, 0, 5]])).toEqual([[]]);
    expect(seq(mk(['upper']), [[2026, 0, 7]])).toEqual([['upper']]);
  });
});
