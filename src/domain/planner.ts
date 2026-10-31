import { REGION_LABELS, type Criteria, type PlanEntry, type Region, type Routine, type RoutineDay } from '../types';
import { isFullBody } from './targets';
import { dateKey } from './units';
import { generateWorkout, type GenerateInput } from './generator';

export const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

export function dayCriteria(day: RoutineDay): Criteria {
  return {
    targetMuscles: day.targetMuscles, targetRegions: day.targetRegions, useFatigue: false, setTypes: day.setTypes,
    cardioWarmup: day.cardioWarmup, maxMinutes: day.maxMinutes,
  };
}

export function generateForRoutineDay(day: RoutineDay, routineName: string, input: Omit<GenerateInput, 'criteria' | 'name'>) {
  return generateWorkout({ ...input, criteria: { ...dayCriteria(day), useFatigue: true }, name: `${routineName} — ${day.label}` });
}

export interface AgendaDay {
  date: string;
  entries: PlanEntry[];
  routineDays: { routine: Routine; day: RoutineDay }[];
}

export const dayWeekdays = (day: RoutineDay): number[] => (day.weekdays?.length ? day.weekdays : [day.weekday]);

/** Does this routine's recurrence (start/end dates, daily/weekly) cover the given calendar date? */
export function routineCovers(routine: Routine, date: Date): boolean {
  if (!routine.active) return false;
  const key = dateKey(date);
  if (routine.startDate && key < routine.startDate) return false;
  if (routine.endDate && key > routine.endDate) return false;
  return true;
}

/** Tier-2 groups a day rotates through: full body -> upper, core, lower; otherwise the selected groups (needs 2+). */
export function rotationGroups(day: RoutineDay): Region[] {
  if (isFullBody(day)) return ['upper', 'core', 'lower'];
  const regions = day.targetRegions ?? [];
  return day.targetMuscles.length === 0 && regions.length >= 2 ? regions : [];
}

const ROTATION_ANCHOR = new Date(2024, 0, 7); // a Sunday, used when a routine has no start date

/** How many times this day has occurred (from the routine start) before `date`. */
export function occurrenceIndex(routine: Routine, day: RoutineDay, date: Date): number {
  const start = routine.startDate ? new Date(`${routine.startDate}T00:00:00`) : ROTATION_ANCHOR;
  const days = dayWeekdays(day);
  let n = 0;
  for (let d = new Date(start); d < date && dateKey(d) < dateKey(date); d = new Date(d.getFullYear(), d.getMonth(), d.getDate() + 1)) {
    if (days.includes(d.getDay())) n++;
  }
  return n;
}

/** The day as it applies on `date`; with rotation on it is narrowed to one tier-2 group. */
export function resolveDay(routine: Routine, day: RoutineDay, date: Date): RoutineDay {
  const groups = routine.frequency === 'daily' || !routine.rotate ? [] : rotationGroups(day);
  if (groups.length < 2) return day;
  const region = groups[occurrenceIndex(routine, day, date) % groups.length];
  return { ...day, targetMuscles: [], targetRegions: [region], label: `${day.label} — ${REGION_LABELS[region]}` };
}

export function agendaForDate(date: Date, plans: PlanEntry[], routines: Routine[]): AgendaDay {
  const key = dateKey(date);
  return {
    date: key,
    entries: plans.filter((p) => p.date === key),
    routineDays: routines
      .filter((r) => routineCovers(r, date))
      .flatMap((routine) => routine.days
        .filter((day) => (routine.frequency === 'daily' ? true : dayWeekdays(day).includes(date.getDay())))
        .map((day) => ({ routine, day: resolveDay(routine, day, date) }))),
  };
}

export function agenda(start: Date, days: number, plans: PlanEntry[], routines: Routine[]): AgendaDay[] {
  return Array.from({ length: days }, (_, i) =>
    agendaForDate(new Date(start.getFullYear(), start.getMonth(), start.getDate() + i), plans, routines));
}

/** Weeks (Sunday first) for a month grid; days outside the month are null. */
export function monthGrid(year: number, month: number): (Date | null)[][] {
  const first = new Date(year, month, 1);
  const count = new Date(year, month + 1, 0).getDate();
  const cells: (Date | null)[] = [...Array(first.getDay()).fill(null), ...Array.from({ length: count }, (_, i) => new Date(year, month, i + 1))];
  while (cells.length % 7) cells.push(null);
  return Array.from({ length: cells.length / 7 }, (_, w) => cells.slice(w * 7, w * 7 + 7));
}
