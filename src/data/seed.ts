import type { Equipment, Exercise, ExerciseKind, MuscleId } from '../types';

export const SEED_EQUIPMENT: Equipment[] = [
  { id: 'dumbbell', name: 'Dumbbells', owned: false },
  { id: 'barbell', name: 'Barbell & Plates', owned: false },
  { id: 'bench', name: 'Bench', owned: false },
  { id: 'rack', name: 'Squat Rack', owned: false },
  { id: 'pullup_bar', name: 'Pull-up Bar', owned: false },
  { id: 'cable', name: 'Cable Machine', owned: false },
  { id: 'bands', name: 'Resistance Bands', owned: false },
  { id: 'kettlebell', name: 'Kettlebell', owned: false },
  { id: 'leg_press', name: 'Leg Press Machine', owned: false },
  { id: 'box', name: 'Plyo Box / Step', owned: false },
  { id: 'jump_rope', name: 'Jump Rope', owned: false },
  { id: 'treadmill', name: 'Treadmill', owned: false },
  { id: 'bike', name: 'Stationary Bike', owned: false },
  { id: 'rower', name: 'Rowing Machine', owned: false },
  { id: 'ab_wheel', name: 'Ab Wheel', owned: false },
  { id: 'dip_bars', name: 'Dip Bars', owned: false },
];

interface Opts {
  s?: MuscleId[]; // secondary muscles
  ss?: boolean; // superset ok (default true)
  hiit?: boolean;
  reps?: [number, number];
  sec?: number;
  kg?: number;
  rest?: number;
}

function ex(
  id: string, name: string, kind: ExerciseKind, equipment: string[], p: MuscleId[], o: Opts = {},
): Exercise {
  const muscles: Partial<Record<MuscleId, number>> = {};
  for (const m of o.s ?? []) muscles[m] = 0.4;
  for (const m of p) muscles[m] = 1;
  const [repMin, repMax] = o.reps ?? (kind === 'weighted' ? [8, 12] : [10, 20]);
  const defaultRest = kind === 'weighted' ? (p.length && repMax <= 8 ? 120 : 75) : kind === 'cardio' ? 30 : 45;
  return {
    id, name, kind, equipment, muscles,
    supersetOk: o.ss ?? kind !== 'cardio',
    hiitOk: o.hiit ?? (kind === 'bodyweight' || kind === 'cardio'),
    repMin, repMax,
    defaultSeconds: o.sec ?? (kind === 'timed' ? 30 : kind === 'cardio' ? 60 : undefined),
    startKg: o.kg ?? (kind === 'weighted' ? 10 : undefined),
    restSec: o.rest ?? defaultRest,
  };
}

const W = 'weighted', B = 'bodyweight', T = 'timed', C = 'cardio';

export const SEED_EXERCISES: Exercise[] = [
  // Chest
  ex('bench_press', 'Barbell Bench Press', W, ['barbell', 'bench'], ['chest'], { s: ['triceps', 'shoulders_front'], reps: [5, 8], kg: 40, rest: 120 }),
  ex('incline_bench', 'Incline Barbell Bench Press', W, ['barbell', 'bench'], ['chest'], { s: ['shoulders_front', 'triceps'], reps: [6, 10], kg: 30, rest: 120 }),
  ex('db_bench', 'Dumbbell Bench Press', W, ['dumbbell', 'bench'], ['chest'], { s: ['triceps', 'shoulders_front'], kg: 14 }),
  ex('db_incline_press', 'Incline Dumbbell Press', W, ['dumbbell', 'bench'], ['chest'], { s: ['shoulders_front', 'triceps'], kg: 12 }),
  ex('db_fly', 'Dumbbell Fly', W, ['dumbbell', 'bench'], ['chest'], { s: ['shoulders_front'], reps: [10, 15], kg: 8 }),
  ex('floor_press', 'Dumbbell Floor Press', W, ['dumbbell'], ['chest'], { s: ['triceps'], kg: 12 }),
  ex('cable_fly', 'Cable Fly', W, ['cable'], ['chest'], { reps: [10, 15], kg: 10 }),
  ex('pushup', 'Push-up', B, [], ['chest'], { s: ['triceps', 'shoulders_front', 'abs'], reps: [8, 25] }),
  ex('incline_pushup', 'Incline Push-up', B, ['bench'], ['chest'], { s: ['triceps', 'shoulders_front'], reps: [10, 25] }),
  ex('band_chest_press', 'Band Chest Press', W, ['bands'], ['chest'], { s: ['triceps'], kg: 8, reps: [10, 20] }),
  ex('dip', 'Chest Dip', B, ['dip_bars'], ['chest', 'triceps'], { s: ['shoulders_front'], reps: [6, 15], hiit: false }),
  // Shoulders
  ex('ohp', 'Barbell Overhead Press', W, ['barbell'], ['shoulders_front'], { s: ['triceps', 'shoulders_side', 'upper_back'], reps: [5, 8], kg: 30, rest: 120 }),
  ex('db_shoulder_press', 'Dumbbell Shoulder Press', W, ['dumbbell'], ['shoulders_front', 'shoulders_side'], { s: ['triceps'], kg: 10 }),
  ex('lateral_raise', 'Lateral Raise', W, ['dumbbell'], ['shoulders_side'], { reps: [12, 20], kg: 4, rest: 60 }),
  ex('front_raise', 'Front Raise', W, ['dumbbell'], ['shoulders_front'], { reps: [10, 15], kg: 5, rest: 60 }),
  ex('rear_delt_fly', 'Rear Delt Fly', W, ['dumbbell'], ['shoulders_rear'], { s: ['upper_back'], reps: [12, 20], kg: 4, rest: 60 }),
  ex('face_pull', 'Cable Face Pull', W, ['cable'], ['shoulders_rear'], { s: ['upper_back', 'traps'], reps: [12, 20], kg: 15, rest: 60 }),
  ex('band_face_pull', 'Band Face Pull', W, ['bands'], ['shoulders_rear'], { s: ['upper_back'], reps: [12, 20], kg: 5, rest: 60 }),
  ex('band_lateral_raise', 'Band Lateral Raise', W, ['bands'], ['shoulders_side'], { reps: [12, 20], kg: 3, rest: 60 }),
  ex('pike_pushup', 'Pike Push-up', B, [], ['shoulders_front'], { s: ['triceps', 'shoulders_side'], reps: [6, 15] }),
  ex('arnold_press', 'Arnold Press', W, ['dumbbell'], ['shoulders_front', 'shoulders_side'], { s: ['triceps'], kg: 8 }),
  ex('shrug', 'Dumbbell Shrug', W, ['dumbbell'], ['traps'], { s: ['forearms'], reps: [10, 15], kg: 16 }),
  ex('barbell_shrug', 'Barbell Shrug', W, ['barbell'], ['traps'], { s: ['forearms'], reps: [8, 12], kg: 40 }),
  // Back
  ex('pullup', 'Pull-up', B, ['pullup_bar'], ['lats'], { s: ['biceps', 'upper_back', 'forearms'], reps: [4, 12], hiit: false }),
  ex('chinup', 'Chin-up', B, ['pullup_bar'], ['lats', 'biceps'], { s: ['upper_back', 'forearms'], reps: [4, 12], hiit: false }),
  ex('lat_pulldown', 'Cable Lat Pulldown', W, ['cable'], ['lats'], { s: ['biceps', 'upper_back'], kg: 30 }),
  ex('barbell_row', 'Barbell Row', W, ['barbell'], ['upper_back', 'lats'], { s: ['biceps', 'lower_back', 'shoulders_rear'], reps: [6, 10], kg: 40, rest: 120 }),
  ex('db_row', 'One-arm Dumbbell Row', W, ['dumbbell'], ['lats', 'upper_back'], { s: ['biceps', 'shoulders_rear'], kg: 14 }),
  ex('chest_supported_row', 'Chest-supported Dumbbell Row', W, ['dumbbell', 'bench'], ['upper_back'], { s: ['lats', 'biceps', 'shoulders_rear'], kg: 10 }),
  ex('cable_row', 'Seated Cable Row', W, ['cable'], ['upper_back', 'lats'], { s: ['biceps', 'shoulders_rear'], kg: 30 }),
  ex('band_row', 'Band Row', W, ['bands'], ['upper_back'], { s: ['lats', 'biceps'], kg: 10, reps: [10, 20] }),
  ex('band_pulldown', 'Band Lat Pulldown', W, ['bands'], ['lats'], { s: ['biceps'], kg: 10, reps: [10, 20] }),
  ex('inverted_row', 'Inverted Row', B, ['rack'], ['upper_back', 'lats'], { s: ['biceps', 'shoulders_rear'], reps: [6, 15], hiit: false }),
  ex('deadlift', 'Barbell Deadlift', W, ['barbell'], ['hamstrings', 'glutes', 'lower_back'], { s: ['traps', 'forearms', 'quads', 'upper_back'], reps: [3, 6], kg: 60, rest: 150, ss: false }),
  ex('rdl', 'Romanian Deadlift', W, ['barbell'], ['hamstrings', 'glutes'], { s: ['lower_back', 'forearms'], reps: [6, 10], kg: 40, rest: 120 }),
  ex('db_rdl', 'Dumbbell Romanian Deadlift', W, ['dumbbell'], ['hamstrings', 'glutes'], { s: ['lower_back', 'forearms'], kg: 14 }),
  ex('back_extension', 'Back Extension', B, [], ['lower_back'], { s: ['glutes', 'hamstrings'], reps: [10, 20] }),
  ex('superman', 'Superman Hold', T, [], ['lower_back'], { s: ['glutes'], sec: 30 }),
  // Arms
  ex('barbell_curl', 'Barbell Curl', W, ['barbell'], ['biceps'], { s: ['forearms'], kg: 20, rest: 60 }),
  ex('db_curl', 'Dumbbell Curl', W, ['dumbbell'], ['biceps'], { s: ['forearms'], kg: 8, rest: 60 }),
  ex('hammer_curl', 'Hammer Curl', W, ['dumbbell'], ['biceps', 'forearms'], { kg: 8, rest: 60 }),
  ex('cable_curl', 'Cable Curl', W, ['cable'], ['biceps'], { kg: 15, rest: 60 }),
  ex('band_curl', 'Band Curl', W, ['bands'], ['biceps'], { kg: 6, reps: [12, 20], rest: 60 }),
  ex('tricep_pushdown', 'Cable Triceps Pushdown', W, ['cable'], ['triceps'], { kg: 20, rest: 60 }),
  ex('skullcrusher', 'Skullcrusher', W, ['barbell', 'bench'], ['triceps'], { kg: 20, rest: 60 }),
  ex('overhead_tri_ext', 'Overhead Triceps Extension', W, ['dumbbell'], ['triceps'], { kg: 10, rest: 60 }),
  ex('band_tri_ext', 'Band Triceps Pushdown', W, ['bands'], ['triceps'], { kg: 6, reps: [12, 20], rest: 60 }),
  ex('bench_dip', 'Bench Dip', B, ['bench'], ['triceps'], { s: ['chest', 'shoulders_front'], reps: [8, 20], hiit: false }),
  ex('diamond_pushup', 'Diamond Push-up', B, [], ['triceps'], { s: ['chest', 'shoulders_front'], reps: [6, 20] }),
  ex('wrist_curl', 'Wrist Curl', W, ['dumbbell'], ['forearms'], { reps: [12, 20], kg: 6, rest: 45 }),
  ex('farmer_carry', 'Farmer Carry', T, ['dumbbell'], ['forearms', 'traps'], { s: ['abs', 'obliques'], sec: 40, ss: false, kg: 20 }),
  // Legs
  ex('squat', 'Barbell Back Squat', W, ['barbell', 'rack'], ['quads', 'glutes'], { s: ['hamstrings', 'lower_back', 'adductors', 'abs'], reps: [5, 8], kg: 50, rest: 150, ss: false }),
  ex('front_squat', 'Barbell Front Squat', W, ['barbell', 'rack'], ['quads'], { s: ['glutes', 'abs', 'upper_back'], reps: [5, 8], kg: 40, rest: 150, ss: false }),
  ex('goblet_squat', 'Goblet Squat', W, ['dumbbell'], ['quads', 'glutes'], { s: ['adductors', 'abs'], kg: 14 }),
  ex('kb_goblet_squat', 'Kettlebell Goblet Squat', W, ['kettlebell'], ['quads', 'glutes'], { s: ['adductors', 'abs'], kg: 12 }),
  ex('leg_press', 'Leg Press', W, ['leg_press'], ['quads'], { s: ['glutes', 'hamstrings', 'adductors'], reps: [8, 15], kg: 60, rest: 90 }),
  ex('lunge', 'Dumbbell Lunge', W, ['dumbbell'], ['quads', 'glutes'], { s: ['hamstrings', 'adductors'], kg: 10 }),
  ex('bw_lunge', 'Bodyweight Lunge', B, [], ['quads', 'glutes'], { s: ['hamstrings', 'adductors'], reps: [10, 24] }),
  ex('bulgarian_split', 'Bulgarian Split Squat', W, ['dumbbell', 'bench'], ['quads', 'glutes'], { s: ['adductors', 'hamstrings'], kg: 8 }),
  ex('step_up', 'Step-up', W, ['box', 'dumbbell'], ['quads', 'glutes'], { s: ['calves'], kg: 8 }),
  ex('bw_squat', 'Bodyweight Squat', B, [], ['quads', 'glutes'], { s: ['hamstrings', 'adductors'], reps: [12, 30] }),
  ex('jump_squat', 'Jump Squat', B, [], ['quads', 'glutes'], { s: ['calves', 'hamstrings'], reps: [8, 20] }),
  ex('wall_sit', 'Wall Sit', T, [], ['quads'], { s: ['glutes'], sec: 45 }),
  ex('hip_thrust', 'Barbell Hip Thrust', W, ['barbell', 'bench'], ['glutes'], { s: ['hamstrings'], reps: [6, 12], kg: 40, rest: 90 }),
  ex('glute_bridge', 'Glute Bridge', B, [], ['glutes'], { s: ['hamstrings', 'lower_back'], reps: [12, 25] }),
  ex('db_glute_bridge', 'Dumbbell Glute Bridge', W, ['dumbbell'], ['glutes'], { s: ['hamstrings'], reps: [10, 15], kg: 14 }),
  ex('leg_curl_band', 'Band Hamstring Curl', W, ['bands'], ['hamstrings'], { reps: [12, 20], kg: 6 }),
  ex('kb_swing', 'Kettlebell Swing', W, ['kettlebell'], ['glutes', 'hamstrings'], { s: ['lower_back', 'shoulders_front', 'forearms'], reps: [12, 20], kg: 12, hiit: true }),
  ex('good_morning', 'Good Morning', W, ['barbell', 'rack'], ['hamstrings', 'lower_back'], { s: ['glutes'], reps: [8, 12], kg: 25 }),
  ex('calf_raise', 'Standing Calf Raise', B, [], ['calves'], { reps: [12, 30], rest: 45 }),
  ex('db_calf_raise', 'Dumbbell Calf Raise', W, ['dumbbell'], ['calves'], { reps: [12, 20], kg: 14, rest: 45 }),
  ex('side_lunge', 'Side Lunge', B, [], ['adductors'], { s: ['quads', 'glutes'], reps: [10, 20] }),
  ex('sumo_squat', 'Sumo Squat', W, ['dumbbell'], ['adductors', 'glutes'], { s: ['quads'], kg: 14 }),
  // Core
  ex('plank', 'Plank', T, [], ['abs'], { s: ['obliques', 'shoulders_front', 'lower_back'], sec: 45 }),
  ex('side_plank', 'Side Plank', T, [], ['obliques'], { s: ['abs', 'shoulders_side'], sec: 30 }),
  ex('crunch', 'Crunch', B, [], ['abs'], { reps: [12, 30] }),
  ex('bicycle_crunch', 'Bicycle Crunch', B, [], ['abs', 'obliques'], { reps: [16, 40] }),
  ex('leg_raise', 'Lying Leg Raise', B, [], ['abs'], { s: ['quads'], reps: [8, 20] }),
  ex('hanging_leg_raise', 'Hanging Leg Raise', B, ['pullup_bar'], ['abs'], { s: ['forearms'], reps: [6, 15], hiit: false }),
  ex('russian_twist', 'Russian Twist', B, [], ['obliques'], { s: ['abs'], reps: [16, 40] }),
  ex('mountain_climber', 'Mountain Climber', B, [], ['abs'], { s: ['shoulders_front', 'quads'], reps: [20, 50] }),
  ex('dead_bug', 'Dead Bug', B, [], ['abs'], { reps: [10, 24], hiit: false }),
  ex('ab_wheel', 'Ab Wheel Rollout', B, ['ab_wheel'], ['abs'], { s: ['lats', 'shoulders_front'], reps: [6, 15], hiit: false }),
  ex('cable_crunch', 'Cable Crunch', W, ['cable'], ['abs'], { reps: [10, 20], kg: 20, rest: 60 }),
  ex('woodchop', 'Cable Woodchop', W, ['cable'], ['obliques'], { s: ['abs'], reps: [10, 15], kg: 10, rest: 60 }),
  ex('hollow_hold', 'Hollow Hold', T, [], ['abs'], { s: ['quads'], sec: 30 }),
  ex('bird_dog', 'Bird Dog', B, [], ['lower_back'], { s: ['glutes', 'abs'], reps: [10, 20], hiit: false }),
  // Full-body / conditioning
  ex('burpee', 'Burpee', B, [], ['quads', 'chest'], { s: ['glutes', 'shoulders_front', 'triceps', 'abs'], reps: [8, 20] }),
  ex('thruster', 'Dumbbell Thruster', W, ['dumbbell'], ['quads', 'shoulders_front'], { s: ['glutes', 'triceps'], kg: 8, reps: [8, 15], hiit: true }),
  ex('kb_clean_press', 'Kettlebell Clean & Press', W, ['kettlebell'], ['shoulders_front', 'glutes'], { s: ['triceps', 'traps', 'forearms'], kg: 10, reps: [6, 12], hiit: true }),
  ex('box_jump', 'Box Jump', B, ['box'], ['quads', 'glutes'], { s: ['calves'], reps: [6, 15] }),
  ex('band_pull_apart', 'Band Pull-apart', W, ['bands'], ['shoulders_rear'], { s: ['upper_back'], reps: [15, 30], kg: 4, rest: 45 }),
  // Cardio
  ex('jumping_jacks', 'Jumping Jacks', C, [], ['calves'], { s: ['shoulders_side', 'quads'], sec: 60 }),
  ex('high_knees', 'High Knees', C, [], ['quads'], { s: ['calves', 'abs'], sec: 45 }),
  ex('jump_rope', 'Jump Rope', C, ['jump_rope'], ['calves'], { s: ['shoulders_side', 'forearms'], sec: 90 }),
  ex('treadmill_run', 'Treadmill Jog', C, ['treadmill'], ['quads'], { s: ['calves', 'hamstrings', 'glutes'], sec: 300, ss: false }),
  ex('bike_ride', 'Stationary Bike', C, ['bike'], ['quads'], { s: ['calves', 'glutes', 'hamstrings'], sec: 300, ss: false }),
  ex('row_machine', 'Rowing Machine', C, ['rower'], ['lats'], { s: ['quads', 'upper_back', 'biceps', 'hamstrings'], sec: 300, ss: false }),
  ex('shadow_boxing', 'Shadow Boxing', C, [], ['shoulders_front'], { s: ['obliques', 'calves', 'triceps'], sec: 60 }),
  ex('skater_hops', 'Skater Hops', C, [], ['glutes', 'adductors'], { s: ['quads', 'calves'], sec: 45 }),
];
