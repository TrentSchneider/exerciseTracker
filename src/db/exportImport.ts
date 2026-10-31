import { ALL_STORES, DATA_STORES, SCHEMA_VERSION, getDb, initDb, type DataStore } from './db';

export const APP_ID = 'workout-tracker-pwa';

export interface ExportFile {
  app: typeof APP_ID;
  schemaVersion: number;
  exportedAt: string;
  data: { settings: unknown } & Record<DataStore, { id: string }[]>;
}

export async function exportData(): Promise<ExportFile> {
  const db = await getDb();
  const data = { settings: (await db.get('settings', 'settings'))?.value ?? null } as ExportFile['data'];
  for (const s of DATA_STORES) data[s] = await db.getAll(s);
  return { app: APP_ID, schemaVersion: SCHEMA_VERSION, exportedAt: new Date().toISOString(), data };
}

export class ImportError extends Error {}

export function parseImport(text: string): ExportFile {
  let json: any;
  try {
    json = JSON.parse(text);
  } catch {
    throw new ImportError('That file is not valid JSON.');
  }
  if (!json || json.app !== APP_ID) throw new ImportError('This file is not a Workout Tracker export.');
  if (typeof json.schemaVersion !== 'number') throw new ImportError('Export is missing a schema version.');
  if (json.schemaVersion > SCHEMA_VERSION) {
    throw new ImportError('This export was made by a newer version of the app. Update the app and try again.');
  }
  if (!json.data || typeof json.data !== 'object') throw new ImportError('Export contains no data.');
  for (const s of DATA_STORES) {
    const rows = json.data[s] ?? [];
    if (!Array.isArray(rows) || rows.some((r) => !r || typeof r.id !== 'string')) {
      throw new ImportError(`The "${s}" section of the export is malformed.`);
    }
    json.data[s] = rows;
  }
  return json as ExportFile;
}

export interface StoreImpact {
  store: DataStore;
  existing: number;
  incoming: number;
  overwritten: number; // existing rows with the same id and different content that merge would replace
  deleted: number; // existing rows replace-all would remove
}

export interface ImportImpact {
  stores: StoreImpact[];
  settingsOverwritten: boolean;
  totalOverwritten: number;
  totalDeleted: number;
}

export async function analyzeImport(file: ExportFile): Promise<ImportImpact> {
  const db = await getDb();
  const stores: StoreImpact[] = [];
  for (const store of DATA_STORES) {
    const existing = new Map<string, string>((await db.getAll(store)).map((r) => [r.id, JSON.stringify(r)]));
    const incoming = file.data[store];
    // Identical rows (e.g. untouched built-in exercises) aren't really overwritten.
    const overwritten = incoming.filter((r) => existing.has(r.id) && existing.get(r.id) !== JSON.stringify(r)).length;
    stores.push({ store, existing: existing.size, incoming: incoming.length, overwritten, deleted: existing.size });
  }
  const settingsOverwritten = file.data.settings != null;
  return {
    stores, settingsOverwritten,
    totalOverwritten: stores.reduce((n, s) => n + s.overwritten, 0) + (settingsOverwritten ? 1 : 0),
    totalDeleted: stores.reduce((n, s) => n + s.deleted, 0),
  };
}

/** replace: wipe everything first. merge: keep existing rows, imported rows win on matching ids. */
export async function applyImport(file: ExportFile, mode: 'replace' | 'merge'): Promise<void> {
  const db = await getDb();
  const tx = db.transaction([...ALL_STORES], 'readwrite');
  if (mode === 'replace') {
    for (const s of DATA_STORES) await tx.objectStore(s).clear();
    await tx.objectStore('settings').clear();
  }
  for (const s of DATA_STORES) for (const row of file.data[s]) await tx.objectStore(s).put(row);
  if (file.data.settings) await tx.objectStore('settings').put({ key: 'settings', value: file.data.settings });
  await tx.done;
  await initDb();
}
