import type { Exercise, MuscleId, Session, SetLog, SetType } from '../types';
import { primaryMuscles } from './fatigue';
import { epley, type Metric } from './stats';

export type ProgressRange = '4w' | '12w' | '1y' | 'all';
export interface ProgressPoint { x: number; y: number }

export function rangeStart(range: ProgressRange, now: number): number {
  if (range === 'all') return -Infinity;
  const date = new Date(now);
  if (range === '1y') date.setFullYear(date.getFullYear() - 1);
  else date.setDate(date.getDate() - (range === '4w' ? 28 : 84));
  return date.getTime();
}

function inRange(log: SetLog, start: number, now: number): boolean {
  return Number.isFinite(log.at) && log.at >= start && log.at <= now;
}

function validNumber(n: number): boolean {
  return Number.isFinite(n) && n >= 0;
}

export function progressExerciseSeries(
  ex: Exercise, sessions: Session[], metric: Metric, range: ProgressRange, now: number, setType?: SetType,
): ProgressPoint[] {
  const start = rangeStart(range, now);
  const points: ProgressPoint[] = [];
  for (const session of sessions) {
    for (const entry of session.exercises) {
      if (entry.skipped || entry.exerciseId !== ex.id || (setType && entry.setType !== setType)) continue;
      const repMetric = metric === 'e1rm' || metric === 'volume' || metric === 'maxReps' || metric === 'totalReps';
      if (repMetric && (entry.setType === 'hiit' || ex.kind === 'timed' || ex.kind === 'cardio')) continue;
      const sets = entry.sets.filter((s) => inRange(s, start, now)).filter((s) => {
        if (metric === 'duration') return validNumber(s.durationSec);
        if (metric === 'effort') return validNumber(s.effort);
        if (metric === 'topWeight') return validNumber(s.weightKg);
        if (!validNumber(s.reps) || s.reps === 0) return false;
        return metric === 'maxReps' || metric === 'totalReps' || validNumber(s.weightKg);
      });
      if (!sets.length) continue;
      let y: number;
      switch (metric) {
        case 'e1rm': y = Math.max(...sets.map((s) => epley(s.weightKg, s.reps))); break;
        case 'topWeight': y = Math.max(...sets.map((s) => s.weightKg)); break;
        case 'volume': y = sets.reduce((n, s) => n + s.reps * s.weightKg, 0); break;
        case 'maxReps': y = Math.max(...sets.map((s) => s.reps)); break;
        case 'totalReps': y = sets.reduce((n, s) => n + s.reps, 0); break;
        case 'duration': y = Math.max(...sets.map((s) => s.durationSec)); break;
        case 'effort': y = sets.reduce((n, s) => n + s.effort, 0) / sets.length; break;
      }
      points.push({ x: Math.max(...sets.map((s) => s.at)), y });
    }
  }
  return points.sort((a, b) => a.x - b.x);
}

export interface MuscleWeek {
  start: number;
  sets: number;
  volumeKg: number | null;
  complete: boolean;
}

export interface MuscleProgress {
  weeks: MuscleWeek[];
  totalSets: number;
  volumeKg: number | null;
  exercises: { id: string; sets: number }[];
}

function weekStart(time: number): number {
  const d = new Date(time);
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() - d.getDay());
  return d.getTime();
}

function nextWeek(time: number): number {
  const d = new Date(time);
  d.setDate(d.getDate() + 7);
  return d.getTime();
}

export function muscleProgress(
  muscle: MuscleId, sessions: Session[], exercises: Exercise[], range: ProgressRange, now: number,
): MuscleProgress {
  const start = rangeStart(range, now);
  const byId = new Map(exercises.map((ex) => [ex.id, ex]));
  const weeks = new Map<number, { sets: number; volume: number; eligible: number }>();
  const counts = new Map<string, number>();
  let totalSets = 0, totalVolume = 0, eligible = 0;
  for (const session of sessions) {
    for (const entry of session.exercises) {
      const ex = byId.get(entry.exerciseId);
      if (entry.skipped || !ex || !primaryMuscles(ex).includes(muscle)) continue;
      for (const log of entry.sets) {
        if (!inRange(log, start, now)) continue;
        const key = weekStart(log.at);
        const week = weeks.get(key) ?? { sets: 0, volume: 0, eligible: 0 };
        week.sets++;
        totalSets++;
        counts.set(ex.id, (counts.get(ex.id) ?? 0) + 1);
        if (entry.setType !== 'hiit' && ex.kind !== 'timed' && ex.kind !== 'cardio'
          && validNumber(log.reps) && log.reps > 0 && validNumber(log.weightKg)) {
          const volume = log.reps * log.weightKg;
          week.volume += volume;
          week.eligible++;
          totalVolume += volume;
          eligible++;
        }
        weeks.set(key, week);
      }
    }
  }
  if (!totalSets) return { weeks: [], totalSets: 0, volumeKg: null, exercises: [] };
  const first = range === 'all' ? Math.min(...weeks.keys()) : weekStart(start);
  const result: MuscleWeek[] = [];
  for (let t = first; t <= now; t = nextWeek(t)) {
    const week = weeks.get(t);
    result.push({
      start: t, sets: week?.sets ?? 0,
      volumeKg: week ? (week.eligible ? week.volume : null) : 0,
      complete: t >= start && nextWeek(t) <= now,
    });
  }
  return {
    weeks: result, totalSets, volumeKg: eligible ? totalVolume : null,
    exercises: [...counts].map(([id, sets]) => ({ id, sets })).sort((a, b) => b.sets - a.sets || a.id.localeCompare(b.id)),
  };
}

export function summarize(points: ProgressPoint[]): {
  latest: number; best: number; change: number | null; percent: number | null;
} | null {
  if (!points.length) return null;
  const first = points[0].y;
  const latest = points[points.length - 1].y;
  const change = points.length > 1 ? latest - first : null;
  return {
    latest, best: Math.max(...points.map((p) => p.y)), change,
    percent: change === null || first === 0 ? null : change / first * 100,
  };
}
