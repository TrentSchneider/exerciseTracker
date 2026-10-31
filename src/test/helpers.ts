import { SEED_EXERCISES } from '../data/seed';
import type { Exercise, Session, SetLog, SetType } from '../types';

export const HOUR = 3_600_000;
export const DAY = 24 * HOUR;

export const exercises: Exercise[] = SEED_EXERCISES;
export const byId = new Map(exercises.map((e) => [e.id, e]));

export function log(p: Partial<SetLog> = {}): SetLog {
  return { reps: 10, weightKg: 20, bodyweight: false, durationSec: 0, effort: 7, at: Date.now(), ...p };
}

export function session(
  exerciseId: string, sets: Partial<SetLog>[], opts: { at?: number; setType?: SetType; skipped?: boolean; id?: string } = {},
): Session {
  const at = opts.at ?? Date.now();
  return {
    id: opts.id ?? `s_${exerciseId}_${at}`, name: 'Test workout', startedAt: at - HOUR, completedAt: at, durationSec: 3600,
    exercises: [{
      itemId: `it_${exerciseId}`, exerciseId, setType: opts.setType ?? 'regular', skipped: opts.skipped ?? false,
      sets: sets.map((s) => log({ at, ...s })),
    }],
  };
}

/** Deterministic pseudo-random generator for reproducible suggestions. */
export function seeded(seed = 1): () => number {
  let s = seed;
  return () => {
    s = (s * 16807) % 2147483647;
    return (s - 1) / 2147483646;
  };
}
