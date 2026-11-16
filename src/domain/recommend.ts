import type { Equipment, Exercise, PlanItem, ProgressionGoal, Session, SessionExercise, SetLog, SetType } from '../types';

export const TYPE_LOAD_FACTOR: Record<SetType, number> = { regular: 1, superset: 0.9, hiit: 0.8 };
export const HIIT_WORK_SEC = 40;
export const HIIT_REST_SEC = 20;
const DAY_MS = 86_400_000;
const WEIGHT_TOLERANCE = 0.001;

export interface ProgressionSettings {
  progressionGoal?: ProgressionGoal;
  largeJumpPercent?: number;
}

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
const sameWeight = (a: number, b: number) => Math.abs(a - b) <= WEIGHT_TOLERANCE;

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
    Math.abs(option - weight) < Math.abs(best - weight) ? option : best, options[0]);
}

function atOrBelow(options: number[], target: number): number {
  return [...options].reverse().find((weight) => weight <= target + WEIGHT_TOLERANCE) ?? options[0];
}

interface WorkHistory {
  at: number;
  weight: number;
  bodyweight: boolean;
  sets: SetLog[];
  effort: number;
  reps: number;
  duration: number;
}

function workHistory(entry: HistoryEntry, timed: boolean): WorkHistory | undefined {
  const valid = entry.exercise.sets.filter((s) =>
    Number.isFinite(s.weightKg) && s.weightKg >= 0 && Number.isFinite(s.effort) && s.effort >= 1 && s.effort <= 10 &&
    (timed ? Number.isFinite(s.durationSec) && s.durationSec > 0 : Number.isFinite(s.reps) && s.reps > 0));
  const last = valid[valid.length - 1];
  if (!last) return undefined;
  const sets = valid.filter((s) => s.bodyweight === last.bodyweight && sameWeight(s.weightKg, last.weightKg));
  return {
    at: entry.at, weight: last.weightKg, bodyweight: last.bodyweight, sets,
    effort: mean(sets.map((s) => s.effort)),
    reps: mean(sets.map((s) => s.reps)),
    duration: mean(sets.map((s) => s.durationSec)),
  };
}

function goalRange(ex: Exercise, goal: ProgressionGoal): [number, number] {
  if (ex.kind !== 'weighted' || ex.custom || goal === 'balanced') return [ex.repMin, ex.repMax];
  return goal === 'strength' ? [4, 8] : [8, 15];
}

function qualifiesForTrial(
  history: WorkHistory[], current: number, next: number, bodyweight: boolean, repMin: number, repMax: number, timed: boolean,
): boolean {
  const relevant: WorkHistory[] = [];
  for (const h of history) {
    if (sameWeight(h.weight, next) && (h.sets.some((s) => s.effort >= 10) ||
      (!timed && h.sets.some((s) => s.reps < repMin)))) break;
    if (h.bodyweight === bodyweight && sameWeight(h.weight, current)) {
      relevant.push(h);
      if (relevant.length === 2) break;
    }
  }
  return relevant.length === 2 && relevant.every((h) =>
    h.effort <= 7 && h.sets.every((s) => s.effort < 10 && (timed ? s.durationSec >= 40 : s.reps >= repMax + 2)));
}

function nextLoad(
  options: number[], current: number, history: WorkHistory[], bodyweight: boolean,
  repMin: number, repMax: number, timed: boolean, threshold: number,
): { weight?: number; reason: string } {
  const next = options.find((option) => option > current + WEIGHT_TOLERANCE);
  if (next === undefined) return { reason: 'Equipment limit reached' };
  const jump = current > WEIGHT_TOLERANCE ? (next - current) / current * 100 : Infinity;
  const ready = qualifiesForTrial(history, current, next, bodyweight, repMin, repMax, timed);
  if (current <= WEIGHT_TOLERANCE) {
    return ready ? { weight: next, reason: 'Trying added weight; stop or adjust if it feels too hard.' }
      : { reason: 'Build more consistent reps before trying added weight' };
  }
  if (jump > 30 + 1e-8) return { reason: 'The next weight jumps more than 30%; consider a smaller increment or harder variation' };
  if (jump > threshold + 1e-8) {
    return ready ? { weight: next, reason: `Trying the next weight (${Math.round(jump)}% increase); stop or adjust if it feels too hard.` }
      : { reason: `The next weight is a large jump (${Math.round(jump)}%); build more consistent reps first` };
  }
  return { weight: next, reason: 'Ready to increase weight.' };
}

export function recommend(
  ex: Exercise, setType: SetType, sessions: Session[], restScale = 1, now = Date.now(), equipment: Equipment[] = [],
  settings: ProgressionSettings = {},
): Recommendation {
  const weights = exerciseWeightOptions(ex, equipment);
  const goal = settings.progressionGoal ?? 'balanced';
  const [repMin, repMax] = goalRange(ex, goal);
  const goalNote = ex.kind === 'weighted' && !ex.custom && setType !== 'hiit' && goal !== 'balanced'
    ? ` (${goal === 'muscle' ? 'muscle growth' : 'strength'} goal)` : '';
  const threshold = settings.largeJumpPercent ?? 10;
  const timed = ex.kind === 'timed' || ex.kind === 'cardio' || setType === 'hiit';
  const defaultDuration = setType === 'hiit' ? HIIT_WORK_SEC : ex.defaultSeconds ?? 30;
  const base: Recommendation = {
    sets: 3, reps: Math.round(repMin + (repMax - repMin) / 3), weightKg: 0,
    bodyweight: ex.kind !== 'weighted', durationSec: defaultDuration, restSec: recommendedRest(ex, setType, restScale),
    reason: `No history yet — starting suggestion.${goalNote}`,
  };
  if (ex.kind === 'weighted') base.weightKg = weights.length ? closestWeight(weights, ex.startKg ?? 10) : ex.startKg ?? 10;

  let entries = exerciseHistory(ex.id, sessions, setType);
  let scale = 1;
  let borrowed = false;
  if (!entries.length) {
    entries = exerciseHistory(ex.id, sessions);
    if (!entries.length) return base;
    scale = TYPE_LOAD_FACTOR[setType] / TYPE_LOAD_FACTOR[entries[0].setType];
    borrowed = true;
    entries = entries.filter((entry) => entry.setType === entries[0].setType);
  }
  const latestWork = workHistory(entries[0], timed);
  const history = entries.map((entry) => workHistory(entry, timed)).filter((h): h is WorkHistory => h !== undefined);
  if (!latestWork) {
    if (borrowed && timed) {
      const previous = workHistory(entries[0], false);
      if (previous) {
        const weight = previous.weight * scale;
        return {
          ...base, weightKg: weights.length && weight > 0 ? atOrBelow(weights, weight) : weight,
          bodyweight: previous.bodyweight,
          reason: `Not enough recorded time to progress — starting interval (adjusted from ${entries[0].setType} sets).`,
        };
      }
    }
    return { ...base, reason: `Not enough recorded work to progress — starting suggestion.${goalNote}` };
  }
  const last = latestWork;
  const src = (borrowed ? ` (adjusted from ${entries[0].setType} sets)` : '') + goalNote;
  const layoff = (now - last.at) / DAY_MS > 42 ? 0.8 : (now - last.at) / DAY_MS > 21 ? 0.9 : 1;
  const bodyweight = ex.kind === 'bodyweight' || last.bodyweight;
  const rec: Recommendation = {
    ...base, sets: Math.min(5, Math.max(2, last.sets.length >= 2 ? last.sets.length : 3)),
    bodyweight, reps: timed ? base.reps : Math.max(1, Math.round(last.reps)),
  };
  let weight = last.weight * scale;
  const tooHard = last.sets.some((s) => s.effort >= 10 || (!timed && s.reps < repMin));

  if (weights.length && weight > 0) {
    if (!weights.some((option) => sameWeight(option, weight))) {
      const available = atOrBelow(weights, weight);
      rec.weightKg = layoff < 1 && !bodyweight ? atOrBelow(weights, available * layoff) : available;
      if (!timed) rec.reps = Math.max(1, Math.round(Math.min(repMax, last.reps) * (layoff < 1 && bodyweight ? layoff : 1)));
      rec.durationSec = Math.max(10, Math.round(last.duration * layoff / 5) * 5);
      rec.reason = 'Previous weight is unavailable; using an available weight with a conservative target.' +
        (layoff < 1 ? ' Time away — reduced target.' : '') + src;
      return rec;
    }
    weight = atOrBelow(weights, weight);
  }
  if (layoff < 1) {
    if (bodyweight) rec.reps = Math.max(1, Math.round(rec.reps * layoff));
    else weight = weights.length ? atOrBelow(weights, weight * layoff) : Math.max(0, roundHalf(weight * layoff));
    if (timed) rec.durationSec = Math.max(10, Math.round(last.duration * layoff / 5) * 5);
    rec.weightKg = weight;
    rec.reason = 'Time away — reduced target.' + src;
    return rec;
  }

  if (timed) {
    rec.durationSec = Math.max(10, Math.round(last.duration / 5) * 5);
    if (ex.kind === 'timed') rec.durationSec = Math.min(600, rec.durationSec);
    rec.weightKg = weight;
    if (tooHard) {
      const lower = weights.filter((option) => option < weight - WEIGHT_TOLERANCE).pop();
      if (lower !== undefined && weight > 0) {
        rec.weightKg = lower;
        rec.reason = 'Last time felt maximal — reducing weight.';
      } else {
        if (setType !== 'hiit') rec.durationSec = Math.max(10, rec.durationSec - 5);
        rec.reason = setType === 'hiit' ? 'Last time felt maximal — the HIIT block determines work time.' : 'Last time felt maximal — reducing time.';
      }
    } else if (last.effort <= 8.5) {
      const choice = weights.length && ex.kind !== 'cardio' && last.duration >= 40
        ? nextLoad(weights, weight, history, last.bodyweight, repMin, repMax, true, threshold) : undefined;
      if (choice?.weight !== undefined) {
        rec.weightKg = choice.weight;
        rec.reason = choice.reason;
      } else {
        const previousDuration = rec.durationSec;
        if (setType !== 'hiit') rec.durationSec = Math.min(ex.kind === 'timed' ? 600 : Infinity, rec.durationSec + 5);
        rec.reason = setType === 'hiit' ? 'The HIIT block determines work time.'
          : rec.durationSec === previousDuration ? 'Time limit reached — consider a harder variation or additional equipment.'
          : choice ? `${choice.reason} — increasing time instead.` : 'Room to spare — adding time.';
      }
    } else rec.reason = setType === 'hiit' ? 'The HIIT block determines work time.' : 'Holding at last duration.';
    rec.reason += src;
    return rec;
  }

  if (tooHard) {
    const lower = weights.filter((option) => option < weight - WEIGHT_TOLERANCE).pop();
    if (weight > 0 && (lower !== undefined || !weights.length && !bodyweight)) {
      weight = lower ?? Math.max(0, roundHalf(weight - Math.max(1, roundHalf(weight * 0.05))));
      rec.reps = Math.max(1, Math.min(repMax, Math.round(last.reps)));
      rec.reason = 'Last time was very hard — reducing weight.';
    } else {
      rec.reps = Math.max(1, Math.round(last.reps) - 1);
      rec.reason = 'Last time was very hard — reducing reps.';
    }
  } else if (last.effort > 8.5) {
    rec.reason = 'Holding at last performance.';
  } else if (last.reps < repMax) {
    rec.reps = Math.round(last.reps) + 1;
    rec.reason = 'Room to spare — adding a rep.';
  } else {
    const choice = weights.length ? nextLoad(weights, weight, history, last.bodyweight, repMin, repMax, false, threshold) : undefined;
    if (choice?.weight !== undefined) {
      weight = choice.weight;
      rec.reps = repMin;
      rec.reason = choice.reason;
    } else if (!weights.length && !bodyweight && weight > 0) {
      const next = Math.round(weight * (1 + Math.min(5, threshold) / 100) * 100) / 100;
      if (next > weight && (next - weight) / weight <= 0.3) {
        weight = next;
        rec.reps = repMin;
        rec.reason = 'Hit the top of the rep range — increasing weight.';
      } else {
        rec.reps = Math.round(last.reps) + 1;
        rec.reason = 'Weight increment is too large — adding a rep instead.';
      }
    } else {
      rec.reps = Math.round(last.reps) + 1;
      rec.reason = choice ? `${choice.reason} — adding a rep instead.` : 'No added weight configured — adding a rep instead.';
      if (rec.reps >= 30) rec.reason += ' Consider a harder variation or additional equipment.';
    }
  }
  rec.weightKg = weight;
  rec.reason += src;
  return rec;
}

/** Fill a plan item from recommendations unless the user adjusted it manually. */
export function applyRecommendation(
  item: PlanItem, ex: Exercise, sessions: Session[], restScale = 1, now = Date.now(), equipment: Equipment[] = [],
  settings: ProgressionSettings = {},
): PlanItem {
  if (item.manual) return item;
  const r = recommend(ex, item.setType, sessions, restScale, now, equipment, settings);
  return {
    ...item, sets: item.sets || r.sets, reps: r.reps, weightKg: r.weightKg, bodyweight: r.bodyweight,
    durationSec: item.setType === 'hiit' ? item.durationSec || HIIT_WORK_SEC : r.durationSec, restSec: item.restEdited ? item.restSec : r.restSec,
  };
}
