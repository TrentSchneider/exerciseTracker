import type { PlanItem, Session, SetLog, Workout } from '../types';
import { blockRest, blockTransition, buildBlocks } from './workout';

export interface Step {
  itemId: string;
  round: number; // 0-based set / round number
  restAfter: number;
  restKind: 'set' | 'exercise'; // between sets/rounds of the same exercise or block, or before the next exercise
}

export interface ActiveSession {
  id: string;
  name: string;
  startedAt: number;
  items: PlanItem[];
  steps: Step[];
  cursor: number;
  logs: Record<string, SetLog[]>;
  skipped: string[];
  pausedAt?: number; // set while the workout is paused
  pausedMs?: number; // total time spent paused, excluded from the duration
}

export function buildSteps(items: PlanItem[]): Step[] {
  const steps: Step[] = [];
  for (const block of buildBlocks(items)) {
    const rounds = Math.max(...block.map((i) => i.sets));
    const rest = blockRest(block);
    const transition = blockTransition(block);
    for (let r = 0; r < rounds; r++) {
      const roundItems = block.filter((it) => r < it.sets);
      roundItems.forEach((it, idx) => {
        const endOfRound = idx === roundItems.length - 1;
        if (!endOfRound) steps.push({ itemId: it.id, round: r, restAfter: 0, restKind: 'set' });
        else if (r < rounds - 1) steps.push({ itemId: it.id, round: r, restAfter: rest, restKind: 'set' });
        else steps.push({ itemId: it.id, round: r, restAfter: transition, restKind: 'exercise' });
      });
    }
  }
  return steps;
}

export function startSession(workout: Workout, now = Date.now(), id = `s_${now.toString(36)}`): ActiveSession {
  return {
    id, name: workout.name, startedAt: now, items: workout.items, steps: buildSteps(workout.items),
    cursor: 0, logs: {}, skipped: [],
  };
}

function nextIndex(s: ActiveSession, from: number): number {
  let i = from;
  while (i < s.steps.length && s.skipped.includes(s.steps[i].itemId)) i++;
  return i;
}

/** Seconds actually spent working out: excludes paused time. */
export function activeSeconds(s: ActiveSession, now = Date.now()): number {
  const end = s.pausedAt ?? now;
  return Math.max(0, Math.round((end - s.startedAt - (s.pausedMs ?? 0)) / 1000));
}

export function pauseSession(s: ActiveSession, now = Date.now()): ActiveSession {
  return s.pausedAt ? s : { ...s, pausedAt: now };
}

export function resumeSession(s: ActiveSession, now = Date.now()): ActiveSession {
  if (!s.pausedAt) return s;
  const { pausedAt, ...rest } = s;
  return { ...rest, pausedMs: (s.pausedMs ?? 0) + Math.max(0, now - pausedAt) };
}

export function currentStep(s: ActiveSession): Step | null {
  const i = nextIndex(s, s.cursor);
  return i < s.steps.length ? s.steps[i] : null;
}

export function isLastStep(s: ActiveSession): boolean {
  return nextIndex(s, nextIndex(s, s.cursor) + 1) >= s.steps.length;
}

export function logSet(s: ActiveSession, log: SetLog): ActiveSession {
  const i = nextIndex(s, s.cursor);
  if (i >= s.steps.length) return s;
  const step = s.steps[i];
  return {
    ...s, cursor: i + 1,
    logs: { ...s.logs, [step.itemId]: [...(s.logs[step.itemId] ?? []), log] },
  };
}

export function skipExercise(s: ActiveSession, itemId: string): ActiveSession {
  if (s.skipped.includes(itemId)) return s;
  return { ...s, skipped: [...s.skipped, itemId] };
}

export function undoSkip(s: ActiveSession, itemId: string): ActiveSession {
  return { ...s, skipped: s.skipped.filter((i) => i !== itemId) };
}

/** Exercises with no logged sets (skipped or never reached) are stored as skipped and excluded from stats. */
export function finishSession(s: ActiveSession, now = Date.now()): Session {
  return {
    id: s.id,
    name: s.name,
    startedAt: s.startedAt,
    completedAt: now,
    durationSec: activeSeconds(s, now),
    exercises: s.items.map((it) => {
      const sets = s.logs[it.id] ?? [];
      return { itemId: it.id, exerciseId: it.exerciseId, setType: it.setType, skipped: sets.length === 0, sets };
    }),
  };
}

export function progress(s: ActiveSession): { done: number; total: number } {
  const total = s.steps.filter((st) => !s.skipped.includes(st.itemId) || (s.logs[st.itemId]?.length ?? 0) > 0).length;
  const done = Object.values(s.logs).reduce((n, l) => n + l.length, 0);
  return { done, total };
}
