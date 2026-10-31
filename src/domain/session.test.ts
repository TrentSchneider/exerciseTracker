import { buildSteps, currentStep, finishSession, isLastStep, logSet, progress, skipExercise, startSession, undoSkip } from './session';
import { activeSeconds, pauseSession, resumeSession } from './session';
import { newWorkout } from './workout';
import { computeMuscleStatus } from './fatigue';
import { exerciseHistory, recommend } from './recommend';
import { exercises, log } from '../test/helpers';
import type { PlanItem } from '../types';

const item = (id: string, exerciseId: string, over: Partial<PlanItem> = {}): PlanItem => ({
  id, exerciseId, setType: 'regular', sets: 3, reps: 10, weightKg: 20, bodyweight: false, durationSec: 0, restSec: 60, ...over,
});

describe('workout session', () => {
  it('builds sequential steps for regular sets', () => {
    const steps = buildSteps([item('a', 'db_curl', { sets: 2 }), item('b', 'db_row', { sets: 2 })]);
    expect(steps.map((s) => `${s.itemId}${s.round}`)).toEqual(['a0', 'a1', 'b0', 'b1']);
    expect(steps[0].restAfter).toBe(60);
  });

  it('alternates exercises in supersets with no rest between exercises, only between rounds', () => {
    const steps = buildSteps([
      item('a', 'db_curl', { setType: 'superset', group: 'g', sets: 2, restSec: 90 }),
      item('b', 'tricep_pushdown', { setType: 'superset', group: 'g', sets: 2, restSec: 90 }),
    ]);
    expect(steps.map((s) => `${s.itemId}${s.round}`)).toEqual(['a0', 'b0', 'a1', 'b1']);
    expect(steps.map((s) => s.restAfter)).toEqual([0, 90, 0, 30]);
    expect(steps.map((s) => s.restKind)).toEqual(['set', 'set', 'set', 'exercise']);
  });

  it('cycles HIIT rounds with rest only between rounds', () => {
    const steps = buildSteps([
      item('a', 'burpee', { setType: 'hiit', group: 'h', sets: 2, durationSec: 40, restSec: 20 }),
      item('b', 'high_knees', { setType: 'hiit', group: 'h', sets: 2, durationSec: 40, restSec: 20 }),
    ]);
    expect(steps).toHaveLength(4);
    expect(steps.map((s) => s.restAfter)).toEqual([0, 20, 0, 30]);
  });

  it('uses the between-exercise rest after the last set of an exercise', () => {
    const steps = buildSteps([
      item('a', 'db_curl', { sets: 2, restSec: 60, transitionSec: 45 }),
      item('b', 'hammer_curl', { sets: 1 }),
    ]);
    expect(steps.map((s) => [s.restAfter, s.restKind])).toEqual([[60, 'set'], [45, 'exercise'], [30, 'exercise']]);
  });

  it('logs sets in order and finishes', () => {
    let s = startSession(newWorkout('W', [item('a', 'db_curl', { sets: 2 })]), 1000, 'sid');
    expect(currentStep(s)).toMatchObject({ itemId: 'a', round: 0 });
    s = logSet(s, log());
    expect(isLastStep(s)).toBe(true);
    s = logSet(s, log());
    expect(currentStep(s)).toBeNull();
    expect(progress(s)).toEqual({ done: 2, total: 2 });
    const done = finishSession(s, 61_000);
    expect(done.durationSec).toBe(60);
    expect(done.exercises[0]).toMatchObject({ skipped: false });
    expect(done.exercises[0].sets).toHaveLength(2);
  });

  it('skipping an exercise removes its remaining steps', () => {
    let s = startSession(newWorkout('W', [item('a', 'db_curl'), item('b', 'db_row', { sets: 1 })]), 0, 'sid');
    s = skipExercise(s, 'a');
    expect(currentStep(s)).toMatchObject({ itemId: 'b' });
    expect(progress(s).total).toBe(1);
    s = undoSkip(s, 'a');
    expect(currentStep(s)).toMatchObject({ itemId: 'a' });
  });

  it('skipped exercises are saved as skipped with no sets and excluded from history and fatigue', () => {
    let s = startSession(newWorkout('W', [item('a', 'db_curl', { sets: 1 }), item('b', 'db_row', { sets: 1 })]), 0, 'sid');
    s = skipExercise(s, 'a');
    s = logSet(s, log({ at: 5 }));
    const session = finishSession(s, 10);
    const curl = session.exercises.find((e) => e.exerciseId === 'db_curl')!;
    expect(curl.skipped).toBe(true);
    expect(curl.sets).toHaveLength(0);
    expect(exerciseHistory('db_curl', [session])).toHaveLength(0);
    expect(exerciseHistory('db_row', [session])).toHaveLength(1);
    const status = computeMuscleStatus([session], exercises, 10);
    expect(status.biceps.fatigue).toBeGreaterThan(0); // row's secondary
    expect(recommend(exercises.find((e) => e.id === 'db_curl')!, 'regular', [session], 1, 10).reason).toMatch(/no history/i);
  });

  it('unreached exercises are treated as skipped', () => {
    const s = startSession(newWorkout('W', [item('a', 'db_curl'), item('b', 'db_row')]), 0, 'sid');
    const done = finishSession(logSet(s, log()), 10);
    expect(done.exercises.map((e) => e.skipped)).toEqual([false, true]);
  });

  it('keeps sets already logged when an exercise is skipped part-way', () => {
    let s = startSession(newWorkout('W', [item('a', 'db_curl')]), 0, 'sid');
    s = logSet(s, log());
    s = skipExercise(s, 'a');
    expect(currentStep(s)).toBeNull();
    expect(finishSession(s, 1).exercises[0]).toMatchObject({ skipped: false });
  });
});

describe('pausing', () => {
  it('excludes paused time from the workout duration', () => {
    let s = startSession(newWorkout('W', [item('a', 'db_curl')]), 0, 'sid');
    s = pauseSession(s, 10_000);
    expect(activeSeconds(s, 100_000)).toBe(10);
    s = resumeSession(s, 70_000);
    expect(s.pausedAt).toBeUndefined();
    expect(activeSeconds(s, 100_000)).toBe(40);
    expect(finishSession(s, 100_000).durationSec).toBe(40);
    expect(finishSession(pauseSession(s, 90_000), 500_000).durationSec).toBe(30);
  });
});
