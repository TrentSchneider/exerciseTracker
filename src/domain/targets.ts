import { REGIONS, REGION_LABELS, REGION_MUSCLES, MUSCLE_LABELS, type Criteria, type MuscleId, type Region, type SetType } from '../types';

export const DEFAULT_MINUTES = 45;
export const WARMUP_SECONDS = 330;

// Average seconds per whole block (including the rest before the next block) and exercises per block.
const BLOCK: Record<SetType, { seconds: number; exercises: number }> = {
  regular: { seconds: 300, exercises: 1 },
  superset: { seconds: 430, exercises: 2 },
  hiit: { seconds: 450, exercises: 3 },
};

export const regionOf = (m: MuscleId): Region => REGIONS.find((r) => REGION_MUSCLES[r].includes(m))!;

export const isFullBody = (c: Pick<Criteria, 'targetMuscles' | 'targetRegions'>) =>
  c.targetMuscles.length === 0 && (c.targetRegions?.length ?? 0) === 0;

/** Muscles eligible under the criteria; empty means everything (full body). */
export function targetMuscleSet(c: Pick<Criteria, 'targetMuscles' | 'targetRegions'>): MuscleId[] {
  if (isFullBody(c)) return [];
  const set = new Set<MuscleId>(c.targetMuscles);
  (c.targetRegions ?? []).forEach((r) => REGION_MUSCLES[r].forEach((m) => set.add(m)));
  return [...set];
}

/** The most exercises that fit the time allotment, given the set types and the cardio warm-up. */
export function exerciseCapacity(c: Pick<Criteria, 'maxMinutes' | 'setTypes' | 'cardioWarmup'>): number {
  const types: SetType[] = c.setTypes.length ? c.setTypes : ['regular'];
  const budget = (c.maxMinutes ?? DEFAULT_MINUTES) * 60 - (c.cardioWarmup ? WARMUP_SECONDS : 0);
  const cycleSeconds = types.reduce((s, t) => s + BLOCK[t].seconds, 0);
  const cycleExercises = types.reduce((s, t) => s + BLOCK[t].exercises, 0);
  return Math.max(1, Math.floor((budget / cycleSeconds) * cycleExercises));
}

export interface Leaf { label: string; muscles: MuscleId[]; quota: number }
export interface Group { region: Region; quota: number; leaves: Leaf[] }

const split = (total: number, parts: number): number[] =>
  Array.from({ length: parts }, (_, i) => Math.floor(total / parts) + (i < total % parts ? 1 : 0));

/**
 * Divide `capacity` exercises evenly across the selected regions, then evenly across the
 * selections inside each region. `fits` is false when some selection would get no exercise.
 */
export function allocate(c: Pick<Criteria, 'targetMuscles' | 'targetRegions'>, capacity: number): { groups: Group[]; fits: boolean } {
  const full = isFullBody(c);
  const regions = full ? [...REGIONS] : REGIONS.filter((r) => c.targetRegions?.includes(r) || c.targetMuscles.some((m) => regionOf(m) === r));
  const groups: Group[] = regions.map((region) => {
    const wholeRegion = full || c.targetRegions?.includes(region);
    const leaves: Leaf[] = wholeRegion
      ? [{ label: REGION_LABELS[region], muscles: REGION_MUSCLES[region], quota: 0 }]
      : c.targetMuscles.filter((m) => regionOf(m) === region).map((m) => ({ label: MUSCLE_LABELS[m], muscles: [m], quota: 0 }));
    return { region, quota: 0, leaves };
  });
  if (!groups.length) return { groups, fits: true };

  // Remainders go to the groups with the most selections first so every selection can be covered.
  const order = groups.map((g, i) => i).sort((a, b) => groups[b].leaves.length - groups[a].leaves.length || a - b);
  const quotas = split(capacity, groups.length);
  order.forEach((gi, rank) => { groups[gi].quota = quotas[rank]; });

  let fits = true;
  for (const g of groups) {
    if (!full && g.quota < g.leaves.length) { fits = false; g.quota = g.leaves.length; }
    split(g.quota, g.leaves.length).forEach((q, i) => { g.leaves[i].quota = q; });
  }
  return { groups, fits: full || fits };
}

export const selectionFits = (c: Pick<Criteria, 'targetMuscles' | 'targetRegions'>, capacity: number) => allocate(c, capacity).fits;

type Targets = Pick<Criteria, 'targetMuscles' | 'targetRegions'>;
const norm = (t: Targets): Targets => ({ targetMuscles: t.targetMuscles, targetRegions: t.targetRegions ?? [] });

export const selectFullBody = (): Targets => ({ targetMuscles: [], targetRegions: [] });

/** Selecting a region drops full body and the region's specific muscles; deselecting works as a plain toggle. */
export function toggleRegion(c: Targets, r: Region): Targets {
  const { targetMuscles, targetRegions } = norm(c);
  if (targetRegions!.includes(r)) return { targetMuscles, targetRegions: targetRegions!.filter((x) => x !== r) };
  return { targetMuscles: targetMuscles.filter((m) => regionOf(m) !== r), targetRegions: [...targetRegions!, r] };
}

/** Selecting a muscle drops full body and its region; other regions stay selected. */
export function toggleMuscle(c: Targets, m: MuscleId): Targets {
  const { targetMuscles, targetRegions } = norm(c);
  if (targetMuscles.includes(m)) return { targetMuscles: targetMuscles.filter((x) => x !== m), targetRegions };
  return { targetMuscles: [...targetMuscles, m], targetRegions: targetRegions!.filter((r) => r !== regionOf(m)) };
}

/** Drop the most recent selections until everything fits (used when time, set types or warm-up shrink capacity). */
export function trimToCapacity<T extends Targets>(c: T, capacity: number): T {
  let t: Targets = norm(c);
  while (!selectionFits(t, capacity)) {
    if (t.targetMuscles.length) t = { ...t, targetMuscles: t.targetMuscles.slice(0, -1) };
    else t = { ...t, targetRegions: t.targetRegions!.slice(0, -1) };
  }
  return { ...c, targetMuscles: t.targetMuscles, targetRegions: t.targetRegions };
}
