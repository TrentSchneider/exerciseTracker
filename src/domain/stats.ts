import type { Exercise, Session, SetType } from '../types';
import { exerciseHistory } from './recommend';

export type Metric = 'e1rm' | 'topWeight' | 'volume' | 'maxReps' | 'totalReps' | 'duration' | 'effort';

export const METRIC_LABELS: Record<Metric, string> = {
  e1rm: 'Estimated 1-rep max', topWeight: 'Top weight', volume: 'Volume (reps × weight)',
  maxReps: 'Best set reps', totalReps: 'Total reps', duration: 'Longest time (s)', effort: 'Average effort',
};

export function metricsFor(ex: Exercise): Metric[] {
  if (ex.kind === 'weighted') return ['e1rm', 'topWeight', 'volume', 'maxReps', 'effort'];
  if (ex.kind === 'bodyweight') return ['maxReps', 'totalReps', 'topWeight', 'effort'];
  return ['duration', 'effort'];
}

export const epley = (weight: number, reps: number) => (reps <= 1 ? weight : weight * (1 + reps / 30));

export function exerciseSeries(
  exerciseId: string, sessions: Session[], metric: Metric, setType?: SetType,
): { x: number; y: number }[] {
  return exerciseHistory(exerciseId, sessions, setType)
    .reverse()
    .map(({ at, exercise }) => {
      const sets = exercise.sets;
      let y = 0;
      switch (metric) {
        case 'e1rm': y = Math.max(...sets.map((s) => epley(s.weightKg, s.reps))); break;
        case 'topWeight': y = Math.max(...sets.map((s) => s.weightKg)); break;
        case 'volume': y = sets.reduce((n, s) => n + s.reps * s.weightKg, 0); break;
        case 'maxReps': y = Math.max(...sets.map((s) => s.reps)); break;
        case 'totalReps': y = sets.reduce((n, s) => n + s.reps, 0); break;
        case 'duration': y = Math.max(...sets.map((s) => s.durationSec)); break;
        case 'effort': y = sets.reduce((n, s) => n + s.effort, 0) / sets.length; break;
      }
      return { x: at, y };
    });
}

export function isWeightMetric(m: Metric): boolean {
  return m === 'e1rm' || m === 'topWeight' || m === 'volume';
}
