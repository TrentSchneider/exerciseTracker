import type { Equipment, Exercise, PlanItem, Session, SessionExercise, SetType } from '../types';

export const TYPE_LOAD_FACTOR: Record<SetType, number> = { regular: 1, superset: 0.9, hiit: 0.8 };
export const HIIT_WORK_SEC = 40;
export const HIIT_REST_SEC = 20;
const DAY_MS = 86_400_000;

export interface Recommendation {
  sets: number;
  reps: number;
  weightKg: number;
  bodyweight: boolean;
  durationSec: number;
  restSec: number;
  reason: string;
}

export interface HistoryEntry {
  at: number;
  setType: SetType;
  exercise: SessionExercise;
}

/** Completed (non-skipped, at least one set) entries for an exercise, newest first. */
export function exerciseHistory(exerciseId: string, sessions: Session[], setType?: SetType): HistoryEntry[] {
  const out: HistoryEntry[] = [];
  for (const s of sessions) {
    for (const se of s.exercises) {
      if (se.exerciseId !== exerciseId || se.skipped || se.sets.length === 0) continue;
      if (setType && se.setType !== setType) continue;
      out.push({ at: se.sets[se.sets.length - 1].at, setType: se.setType, exercise: se });
    }
  }
  return out.sort((a, b) => b.at - a.at);
}

export function recommendedRest(ex: Exercise, setType: SetType, restScale = 1): number {
  const base = setType === 'hiit' ? HIIT_REST_SEC : setType === 'superset' ? Math.min(ex.restSec, 75) : ex.restSec;
  return Math.max(5, Math.round((base * (setType === 'hiit' ? 1 : restScale)) / 5) * 5);
}

const roundHalf = (n: number) => Math.round(n * 2) / 2;
const mean = (a: number[]) => a.reduce((x, y) => x + y, 0) / a.length;

function exerciseWeightOptions(ex: Exercise, equipment: Equipment[]): number[] {
  for (const id of ex.equipment) {
    const options = equipment.find((item) => item.id === id)?.weightOptionsKg;
    if (options?.length) {
      return [...new Set(options.filter((weight) => Number.isFinite(weight) && weight > 0))].sort((a, b) => a - b);
    }
  }
  return [];
}

function closestWeight(options: number[], weight: number): number {
  return options.reduce((best, option) =>
    Math.abs(option - weight) < Math.abs(best - weight) ? option : best,
  options[0]);
}

function constrainWeight(
  options: number[], target: number, current: number, increasing: boolean,
  reps: number, avgReps: number, repMax: number, reason: string,
): { weight: number; reps: number; reason: string } {
  if (!options.length) return { weight: target, reps, reason };
  if (increasing) {
    const next = options.find((option) => option > current + 0.001);
    if (next !== undefined) return { weight: next, reps, reason };
    return {
      weight: options[options.length - 1],
      reps: Math.max(reps, repMax + 1, Math.round(avgReps) + 1),
      reason: `${reason} Equipment limit reached — increasing reps instead.`,
    };
  }
  return { weight: closestWeight(options, target), reps, reason };
}

export function recommend(
  ex: Exercise, setType: SetType, sessions: Session[], restScale = 1, now = Date.now(), equipment: Equipment[] = [],
): Recommendation {
  const weights = exerciseWeightOptions(ex, equipment);
  const restSec = recommendedRest(ex, setType, restScale);
  const mid = Math.round(ex.repMin + (ex.repMax - ex.repMin) / 3);
  const defaultDuration = setType === 'hiit' ? HIIT_WORK_SEC : ex.defaultSeconds ?? 30;
  const base: Recommendation = {
    sets: 3, reps: mid, weightKg: 0, bodyweight: ex.kind !== 'weighted', durationSec: defaultDuration, restSec,
    reason: 'No history yet — starting suggestion.',
  };
  if (ex.kind === 'weighted') base.weightKg = ex.startKg ?? 10;

  let hist = exerciseHistory(ex.id, sessions, setType);
  let scale = 1;
  let borrowed = false;
  if (hist.length === 0) {
    const other = exerciseHistory(ex.id, sessions);
    if (other.length === 0) {
      if (ex.kind === 'weighted' && weights.length) base.weightKg = closestWeight(weights, base.weightKg);
      return base;
    }
    hist = other;
    scale = TYPE_LOAD_FACTOR[setType] / TYPE_LOAD_FACTOR[other[0].setType];
    borrowed = true;
  }
  const last = hist[0];
  const logs = last.exercise.sets;
  const avgEffort = mean(logs.map((l) => l.effort));
  const avgReps = mean(logs.map((l) => l.reps));
  const avgDur = mean(logs.map((l) => l.durationSec));
  const topWeight = Math.max(...logs.map((l) => l.weightKg));
  const daysAgo = (now - last.at) / DAY_MS;
  const layoff = daysAgo > 42 ? 0.8 : daysAgo > 21 ? 0.9 : 1;
  const src = borrowed ? ` (adjusted from ${last.setType} sets)` : '';
  const sets = Math.min(5, Math.max(2, logs.length >= 2 ? logs.length : 3));
  const rec: Recommendation = { ...base, sets };

  if (ex.kind === 'timed' || ex.kind === 'cardio') {
    let d = avgDur || defaultDuration;
    if (avgEffort <= 7) { d *= 1.1; rec.reason = 'Felt easy — adding time.'; }
    else if (avgEffort >= 9.5) { d *= 0.9; rec.reason = 'Felt maximal — easing time back.'; }
    else rec.reason = 'Holding at last duration.';
    if (layoff < 1) { d *= layoff; rec.reason = 'Time away — reduced duration.'; }
    rec.durationSec = Math.max(10, Math.round(d / 5) * 5);
    if (ex.kind === 'timed') rec.durationSec = Math.min(600, rec.durationSec);
    if (weights.length && topWeight > 0) {
      const currentWeight = topWeight * scale;
      const nextWeight = weights.find((weight) => weight > currentWeight + 0.001);
      if (avgEffort <= 7 && layoff === 1 && nextWeight !== undefined) {
        rec.weightKg = nextWeight;
        rec.durationSec = Math.max(10, Math.round((avgDur * 0.9 * layoff) / 5) * 5);
        rec.reason = 'Easy at this load — increasing weight and reducing time.';
      } else {
        rec.weightKg = avgEffort <= 7 ? weights[weights.length - 1] : closestWeight(weights, currentWeight);
        if (avgEffort <= 7) rec.reason = 'Equipment limit reached — increasing time instead.';
      }
      rec.bodyweight = false;
    }
    rec.reason += src;
    return rec;
  }

  if (ex.kind === 'bodyweight') {
    let reps = Math.round(avgReps);
    let added = topWeight * scale;
    let increasing = false;
    if (avgEffort >= 9.5 || avgReps < ex.repMin) {
      reps = Math.max(ex.repMin - 2 > 1 ? ex.repMin - 2 : 1, reps - 2);
      if (added > 0) added = roundHalf(added * 0.9);
      rec.reason = 'Last time was very hard — reducing reps.';
    } else if (avgReps >= ex.repMax && avgEffort <= 8.5) {
      added = roundHalf(added + 2.5);
      reps = ex.repMin;
      increasing = true;
      rec.reason = 'Hit the top of the rep range — adding weight.';
    } else if (avgEffort <= 8.5) {
      reps = Math.min(ex.repMax, reps + (avgEffort <= 7 ? 2 : 1));
      rec.reason = 'Room to spare — adding reps.';
    } else rec.reason = 'Holding at last performance.';
    if (layoff < 1) { reps = Math.max(1, Math.round(reps * layoff)); rec.reason = 'Time away — reduced reps.'; }
    if (weights.length && (added > 0 || topWeight > 0)) {
      const constrained = constrainWeight(weights, added, topWeight * scale, increasing, reps, avgReps, ex.repMax, rec.reason);
      added = constrained.weight;
      reps = constrained.reps;
      rec.reason = constrained.reason;
    }
    rec.reps = reps;
    rec.weightKg = Math.max(0, added);
    rec.bodyweight = true;
    rec.reason += src;
    return rec;
  }

  // weighted: double progression driven by reps hit and effort
  let weight = topWeight * scale;
  let reps = Math.round(avgReps);
  let increasing = false;
  const step = Math.max(1, roundHalf(weight * 0.05));
  if (avgEffort >= 9.5 || avgReps < ex.repMin) {
    weight = roundHalf(weight - step);
    reps = Math.max(ex.repMin, Math.round(avgReps));
    rec.reason = 'Last time was very hard — reducing weight.';
  } else if (avgReps >= ex.repMax && avgEffort < 9) {
    weight = roundHalf(weight + step);
    reps = ex.repMin;
    increasing = true;
    rec.reason = 'Hit the top of the rep range — increasing weight.';
  } else if (avgEffort <= 8.5) {
    reps = Math.min(ex.repMax, reps + 1);
    rec.reason = 'Room to spare — adding a rep.';
  } else rec.reason = 'Holding at last performance.';
  if (layoff < 1) { weight = roundHalf(weight * layoff); rec.reason = 'Time away — reduced weight.'; }
  const constrained = constrainWeight(weights, Math.max(0, roundHalf(weight)), topWeight * scale, increasing, reps, avgReps, ex.repMax, rec.reason);
  rec.weightKg = Math.max(0, roundHalf(constrained.weight));
  reps = constrained.reps;
  rec.reps = Math.max(1, reps);
  rec.bodyweight = false;
  rec.reason = constrained.reason + src;
  return rec;
}

/** Fill a plan item from recommendations unless the user adjusted it manually. */
export function applyRecommendation(
  item: PlanItem, ex: Exercise, sessions: Session[], restScale = 1, now = Date.now(), equipment: Equipment[] = [],
): PlanItem {
  if (item.manual) return item;
  const r = recommend(ex, item.setType, sessions, restScale, now, equipment);
  return {
    ...item, sets: item.sets || r.sets, reps: r.reps, weightKg: r.weightKg, bodyweight: r.bodyweight,
    durationSec: item.setType === 'hiit' ? item.durationSec || HIIT_WORK_SEC : r.durationSec, restSec: item.restEdited ? item.restSec : r.restSec,
  };
}
