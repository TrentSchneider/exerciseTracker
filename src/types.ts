export type SetType = 'regular' | 'superset' | 'hiit';
export type ExerciseKind = 'weighted' | 'bodyweight' | 'timed' | 'cardio';

export const MUSCLES = [
  'chest', 'shoulders_front', 'shoulders_side', 'shoulders_rear', 'biceps', 'triceps', 'forearms',
  'abs', 'obliques', 'traps', 'lats', 'upper_back', 'lower_back', 'glutes', 'quads', 'hamstrings',
  'calves', 'adductors',
] as const;
export type MuscleId = (typeof MUSCLES)[number];

export const MUSCLE_LABELS: Record<MuscleId, string> = {
  chest: 'Chest', shoulders_front: 'Front Delts', shoulders_side: 'Side Delts', shoulders_rear: 'Rear Delts',
  biceps: 'Biceps', triceps: 'Triceps', forearms: 'Forearms', abs: 'Abs', obliques: 'Obliques',
  traps: 'Traps', lats: 'Lats', upper_back: 'Upper Back', lower_back: 'Lower Back', glutes: 'Glutes',
  quads: 'Quads', hamstrings: 'Hamstrings', calves: 'Calves', adductors: 'Adductors',
};

/** Tier 2 of the target tree: full body > region > muscle. */
export const REGIONS = ['upper', 'lower', 'core'] as const;
export type Region = (typeof REGIONS)[number];

export const REGION_LABELS: Record<Region, string> = { upper: 'Upper body', lower: 'Lower body', core: 'Core' };

export const REGION_MUSCLES: Record<Region, MuscleId[]> = {
  upper: ['chest', 'shoulders_front', 'shoulders_side', 'shoulders_rear', 'biceps', 'triceps', 'forearms', 'traps', 'lats', 'upper_back'],
  lower: ['glutes', 'quads', 'hamstrings', 'calves', 'adductors'],
  core: ['abs', 'obliques', 'lower_back'],
};

export interface Equipment {
  id: string;
  name: string;
  owned: boolean;
  custom?: boolean;
  weightOptionsKg?: number[];
}

export interface Exercise {
  id: string;
  name: string;
  kind: ExerciseKind;
  equipment: string[]; // all required; empty = bodyweight only
  muscles: Partial<Record<MuscleId, number>>; // involvement weight 0..1; >=0.6 is "primary"
  supersetOk: boolean;
  hiitOk: boolean;
  repMin: number;
  repMax: number;
  defaultSeconds?: number; // timed / cardio
  startKg?: number; // starting load for weighted exercises
  restSec: number;
  custom?: boolean;
  inactive?: boolean; // excluded from generated workouts; absent = active. Custom workouts can still use it
}

export interface Settings {
  units: 'lb' | 'kg';
  bodyweightKg: number;
  restScale: number; // multiplier on recommended rest
  plannerView?: 'list' | 'calendar'; // saved planner display mode
  theme?: 'auto' | 'light' | 'dark'; // appearance; absent = auto (follow the device)
  welcomeDismissed?: boolean; // Home welcome card closed; reopened from Settings
  hiitAutoAdvance?: boolean; // HIIT work timer ending logs the exercise and moves on
}

export interface PlanItem {
  id: string;
  exerciseId: string;
  setType: SetType;
  sets: number; // rounds for hiit/superset
  reps: number;
  weightKg: number; // added load (0 when bodyweight)
  bodyweight: boolean;
  durationSec: number; // timed exercises, or hiit work interval
  restSec: number; // rest between sets (regular) or between rounds (superset / hiit block, shared by the block)
  restEdited?: boolean; // user set restSec; recommendations won't overwrite
  transitionSec?: number; // rest after this exercise/block before the next one (set on a block's last item)
  group?: string; // shared by items of the same superset / hiit block
  manual?: boolean; // user adjusted; recommendations won't overwrite
}

export interface Criteria {
  targetMuscles: MuscleId[]; // specific muscles (tier 3); empty targetMuscles and targetRegions = full body
  targetRegions?: Region[]; // whole regions (tier 2)
  useFatigue: boolean;
  setTypes: SetType[];
  cardioWarmup: boolean;
  maxMinutes?: number;
}

export interface Workout {
  id: string;
  name: string;
  items: PlanItem[];
  criteria?: Criteria;
  createdAt: number;
}

export interface RoutineDay {
  id: string;
  weekday: number; // 0 = Sunday; used when `weekdays` is absent
  weekdays?: number[]; // weekly recurrence: every selected weekday (0 = Sunday)
  label: string;
  targetMuscles: MuscleId[];
  targetRegions?: Region[];
  cardioWarmup: boolean;
  setTypes: SetType[];
  maxMinutes?: number;
}

export interface Routine {
  id: string;
  name: string;
  active: boolean;
  days: RoutineDay[];
  frequency?: 'daily' | 'weekly'; // default weekly
  startDate?: string; // YYYY-MM-DD; absent = no start limit
  endDate?: string; // YYYY-MM-DD; absent = no end date
  rotate?: boolean; // weekly only: rotate tier-2 groups across each day's occurrences
}

export interface PlanEntry {
  id: string;
  date: string; // YYYY-MM-DD
  workoutId: string;
}

export interface SetLog {
  reps: number;
  weightKg: number;
  bodyweight: boolean;
  durationSec: number;
  effort: number; // 1-10 RPE
  at: number;
}

export interface SessionExercise {
  itemId: string;
  exerciseId: string;
  setType: SetType;
  skipped: boolean;
  sets: SetLog[];
}

export interface Session {
  id: string;
  name: string;
  startedAt: number;
  completedAt: number;
  durationSec: number;
  exercises: SessionExercise[];
}
