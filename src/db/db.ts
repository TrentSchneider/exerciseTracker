import { openDB, type IDBPDatabase } from 'idb';
import { SEED_EQUIPMENT, SEED_EXERCISES } from '../data/seed';
import type { Settings } from '../types';

export const DB_NAME = 'workout-tracker';
export const DB_VERSION = 1;
export const SCHEMA_VERSION = 1;

export const DATA_STORES = ['equipment', 'exercises', 'workouts', 'routines', 'plans', 'sessions'] as const;
export type DataStore = (typeof DATA_STORES)[number];
export const ALL_STORES = ['settings', ...DATA_STORES] as const;

export const DEFAULT_SETTINGS: Settings = { units: 'lb', bodyweightKg: 75, restScale: 1, hiitAutoAdvance: false };
export const ACTIVE_SESSION_KEY = 'activeSession';

let dbPromise: Promise<IDBPDatabase> | null = null;

export function getDb(): Promise<IDBPDatabase> {
  dbPromise ??= openDB(DB_NAME, DB_VERSION, {
    upgrade(db) {
      db.createObjectStore('settings', { keyPath: 'key' });
      for (const s of DATA_STORES) db.createObjectStore(s, { keyPath: 'id' });
    },
  });
  return dbPromise;
}

export async function closeDb(): Promise<void> {
  if (dbPromise) (await dbPromise).close();
  dbPromise = null;
}

export async function getAll<T>(store: DataStore): Promise<T[]> {
  return (await getDb()).getAll(store);
}

export async function put<T>(store: DataStore, value: T): Promise<void> {
  await (await getDb()).put(store, value);
}

export async function remove(store: DataStore, id: string): Promise<void> {
  await (await getDb()).delete(store, id);
}

export async function getSetting<T>(key: string, fallback: T): Promise<T> {
  const row = await (await getDb()).get('settings', key);
  return row ? (row.value as T) : fallback;
}

export async function setSetting<T>(key: string, value: T): Promise<void> {
  await (await getDb()).put('settings', { key, value });
}

export async function deleteSetting(key: string): Promise<void> {
  await (await getDb()).delete('settings', key);
}

/** Adds any missing built-in equipment/exercises; existing rows are never overwritten. Built-ins can't be deleted. */
export async function initDb(): Promise<void> {
  const db = await getDb();
  const tx = db.transaction(['equipment', 'exercises', 'settings'], 'readwrite');
  const existingEq = new Set((await tx.objectStore('equipment').getAllKeys()) as string[]);
  const existingEx = new Set((await tx.objectStore('exercises').getAllKeys()) as string[]);
  for (const e of SEED_EQUIPMENT) if (!existingEq.has(e.id)) await tx.objectStore('equipment').put(e);
  for (const e of SEED_EXERCISES) if (!existingEx.has(e.id)) await tx.objectStore('exercises').put(e);
  if (!(await tx.objectStore('settings').get('settings'))) await tx.objectStore('settings').put({ key: 'settings', value: DEFAULT_SETTINGS });
  await tx.done;
}

export async function clearAll(): Promise<void> {
  const db = await getDb();
  const tx = db.transaction([...ALL_STORES], 'readwrite');
  for (const s of ALL_STORES) await tx.objectStore(s).clear();
  await tx.done;
}
