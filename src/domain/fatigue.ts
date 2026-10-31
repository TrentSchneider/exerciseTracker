import { MUSCLES, type Exercise, type MuscleId, type Session, type SetLog, type SetType } from '../types';

export const SET_TYPE_FATIGUE: Record<SetType, number> = { regular: 1, superset: 1.15, hiit: 1.3 };

/** Hours for a muscle's fatigue to halve. */
export const HALF_LIFE_HOURS: Record<MuscleId, number> = {
  chest: 28, shoulders_front: 24, shoulders_side: 24, shoulders_rear: 22, biceps: 20, triceps: 20,
  forearms: 16, abs: 16, obliques: 16, traps: 22, lats: 28, upper_back: 26, lower_back: 32,
  glutes: 30, quads: 32, hamstrings: 32, calves: 18, adductors: 24,
};

const BASE_LOAD = 18;
const DAY_MS = 86_400_000;

export interface MuscleStatus {
  muscle: MuscleId;
  fatigue: number; // 0-100
  recovery: number; // 0-100
  lastTrained: number | null;
  hoursToRecovered: number; // until fatigue <= 5%
  sets7d: Record<SetType, number>;
  volume7dKg: number;
  topExercises: { exerciseId: string; sets: number }[];
}

/** Fatigue points a single logged set adds to each muscle it works. */
export function setLoad(ex: Exercise, log: SetLog, setType: SetType): Partial<Record<MuscleId, number>> {
  const effortFactor = 0.4 + 0.6 * (Math.min(10, Math.max(1, log.effort)) / 10);
  let units = 1;
  if (ex.kind === 'timed') units = Math.min(8, Math.max(0.3, log.durationSec / 45));
  if (ex.kind === 'cardio') units = Math.min(8, Math.max(0.3, log.durationSec / 45)) * 0.5;
  const base = BASE_LOAD * effortFactor * SET_TYPE_FATIGUE[setType] * units;
  const out: Partial<Record<MuscleId, number>> = {};
  for (const m of MUSCLES) {
    const w = ex.muscles[m];
    if (w) out[m] = base * w;
  }
  return out;
}

export function computeMuscleStatus(
  sessions: Session[], exercises: Exercise[], now = Date.now(),
): Record<MuscleId, MuscleStatus> {
  const byId = new Map(exercises.map((e) => [e.id, e]));
  const load = Object.fromEntries(MUSCLES.map((m) => [m, 0])) as Record<MuscleId, number>;
  const last = Object.fromEntries(MUSCLES.map((m) => [m, null])) as Record<MuscleId, number | null>;
  const sets7 = Object.fromEntries(
    MUSCLES.map((m) => [m, { regular: 0, superset: 0, hiit: 0 }]),
  ) as Record<MuscleId, Record<SetType, number>>;
  const vol = Object.fromEntries(MUSCLES.map((m) => [m, 0])) as Record<MuscleId, number>;
  const tops = Object.fromEntries(MUSCLES.map((m) => [m, new Map<string, number>()])) as Record<MuscleId, Map<string, number>>;

  for (const s of sessions) {
    for (const se of s.exercises) {
      if (se.skipped) continue;
      const ex = byId.get(se.exerciseId);
      if (!ex) continue;
      for (const log of se.sets) {
        if (log.at > now) continue;
        const l = setLoad(ex, log, se.setType);
        const within7 = now - log.at <= 7 * DAY_MS;
        for (const m of MUSCLES) {
          const v = l[m];
          if (!v) continue;
          load[m] += v * Math.pow(0.5, (now - log.at) / 3_600_000 / HALF_LIFE_HOURS[m]);
          if (last[m] === null || log.at > last[m]!) last[m] = log.at;
          if (within7) {
            if ((ex.muscles[m] ?? 0) >= 0.6) {
              sets7[m][se.setType] += 1;
              vol[m] += log.reps * (log.weightKg || 0);
            }
            tops[m].set(ex.id, (tops[m].get(ex.id) ?? 0) + 1);
          }
        }
      }
    }
  }

  const result = {} as Record<MuscleId, MuscleStatus>;
  for (const m of MUSCLES) {
    const fatigue = Math.min(100, Math.round(load[m] * 10) / 10);
    result[m] = {
      muscle: m,
      fatigue,
      recovery: Math.round((100 - fatigue) * 10) / 10,
      lastTrained: last[m],
      hoursToRecovered: fatigue <= 5 ? 0 : HALF_LIFE_HOURS[m] * Math.log2(load[m] / 5),
      sets7d: sets7[m],
      volume7dKg: Math.round(vol[m]),
      topExercises: [...tops[m].entries()]
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5)
        .map(([exerciseId, sets]) => ({ exerciseId, sets })),
    };
  }
  return result;
}

export function fatigueColor(fatiguePct: number): string {
  const t = Math.min(1, Math.max(0, fatiguePct / 100));
  const from = [22, 50, 140];
  const to = [235, 45, 50];
  const c = from.map((f, i) => Math.round(f + (to[i] - f) * t));
  return `rgb(${c[0]}, ${c[1]}, ${c[2]})`;
}

export function recoveryMap(status: Record<MuscleId, MuscleStatus>): Record<MuscleId, number> {
  return Object.fromEntries(MUSCLES.map((m) => [m, status[m].recovery])) as Record<MuscleId, number>;
}

export function primaryMuscles(ex: Exercise): MuscleId[] {
  return MUSCLES.filter((m) => (ex.muscles[m] ?? 0) >= 0.6);
}
