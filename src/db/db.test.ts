import { SEED_EQUIPMENT, SEED_EXERCISES } from '../data/seed';
import { DEFAULT_SETTINGS, clearAll, getAll, getSetting, initDb, put, remove, setSetting } from './db';
import { ImportError, analyzeImport, applyImport, exportData, parseImport } from './exportImport';
import { session } from '../test/helpers';
import type { Equipment, Exercise, Session, Workout } from '../types';

const workout = (id: string): Workout => ({ id, name: id, items: [], createdAt: 1 });

describe('indexeddb layer', () => {
  it('seeds equipment, exercises and default settings once', async () => {
    await initDb();
    await initDb();
    expect(await getAll('equipment')).toHaveLength(SEED_EQUIPMENT.length);
    expect(await getAll('exercises')).toHaveLength(SEED_EXERCISES.length);
    expect(await getSetting('settings', null)).toEqual(DEFAULT_SETTINGS);
  });

  it('does not overwrite user edits when re-seeding, but adds missing built-ins', async () => {
    await initDb();
    const eq = (await getAll<Equipment>('equipment'))[0];
    await put('equipment', { ...eq, owned: true });
    await remove('exercises', 'plank');
    await initDb();
    expect((await getAll<Equipment>('equipment')).find((e) => e.id === eq.id)!.owned).toBe(true);
    expect((await getAll<Exercise>('exercises')).some((e) => e.id === 'plank')).toBe(true);
  });

  it('persists workouts, sessions and settings', async () => {
    await initDb();
    await put('workouts', workout('w1'));
    await put('sessions', session('bench_press', [{}], { id: 's1' }));
    await setSetting('settings', { ...DEFAULT_SETTINGS, units: 'kg' });
    expect(await getAll('workouts')).toHaveLength(1);
    expect((await getAll<Session>('sessions'))[0].id).toBe('s1');
    expect((await getSetting<typeof DEFAULT_SETTINGS>('settings', DEFAULT_SETTINGS)).units).toBe('kg');
    await remove('workouts', 'w1');
    expect(await getAll('workouts')).toHaveLength(0);
  });
});

describe('export / import', () => {
  it('exports every data store plus settings', async () => {
    await initDb();
    await put('workouts', workout('w1'));
    const file = await exportData();
    expect(file.app).toBe('workout-tracker-pwa');
    expect(file.data.workouts).toHaveLength(1);
    expect(file.data.exercises.length).toBe(SEED_EXERCISES.length);
    expect(file.data.settings).toEqual(DEFAULT_SETTINGS);
    for (const k of ['equipment', 'exercises', 'workouts', 'routines', 'plans', 'sessions']) expect(file.data).toHaveProperty(k);
  });

  it('round-trips through JSON', async () => {
    await initDb();
    await put('sessions', session('bench_press', [{ reps: 5, weightKg: 60 }], { id: 's1' }));
    const text = JSON.stringify(await exportData());
    await clearAll();
    await initDb();
    expect(await getAll('sessions')).toHaveLength(0);
    await applyImport(parseImport(text), 'replace');
    const sessions = await getAll<Session>('sessions');
    expect(sessions).toHaveLength(1);
    expect(sessions[0].exercises[0].sets[0].weightKg).toBe(60);
  });

  it('rejects invalid files', () => {
    expect(() => parseImport('nope')).toThrow(ImportError);
    expect(() => parseImport('{"app":"other"}')).toThrow(/not a Workout Tracker/);
    expect(() => parseImport('{"app":"workout-tracker-pwa","schemaVersion":99,"data":{}}')).toThrow(/newer version/);
    expect(() => parseImport('{"app":"workout-tracker-pwa","schemaVersion":1,"data":{"sessions":[{"x":1}]}}')).toThrow(/malformed/);
    expect(() => parseImport('{"app":"workout-tracker-pwa","schemaVersion":1}')).toThrow(/no data/);
  });

  it('warns about overwritten and deleted records', async () => {
    await initDb();
    await put('workouts', workout('w1'));
    await put('workouts', workout('w2'));
    const file = await exportData();
    file.data.workouts = [{ ...workout('w1'), name: 'changed' } as any, workout('new') as any];
    const impact = await analyzeImport(file);
    const w = impact.stores.find((s) => s.store === 'workouts')!;
    expect(w).toMatchObject({ existing: 2, incoming: 2, overwritten: 1, deleted: 2 });
    expect(impact.settingsOverwritten).toBe(true);
    expect(impact.totalOverwritten).toBe(2); // 1 workout + settings; untouched built-ins don't count
    expect(impact.totalDeleted).toBeGreaterThan(100);
  });

  it('merge keeps existing records and overwrites same-id ones', async () => {
    await initDb();
    await put('workouts', workout('keep'));
    await put('workouts', workout('same'));
    const file = await exportData();
    file.data.workouts = [{ ...workout('same'), name: 'from file' } as any, workout('added') as any];
    await applyImport(file, 'merge');
    const all = await getAll<Workout>('workouts');
    expect(all.map((w) => w.id).sort()).toEqual(['added', 'keep', 'same']);
    expect(all.find((w) => w.id === 'same')!.name).toBe('from file');
  });

  it('replace removes records that are not in the file', async () => {
    await initDb();
    await put('workouts', workout('old'));
    const file = await exportData();
    file.data.workouts = [workout('only') as any];
    await applyImport(file, 'replace');
    expect((await getAll<Workout>('workouts')).map((w) => w.id)).toEqual(['only']);
    expect((await getAll('exercises')).length).toBeGreaterThan(0);
  });
});

describe('exercise active flag storage', () => {
  it('survives re-seeding and an export/import round trip', async () => {
    await initDb();
    const ex = (await getAll<Exercise>('exercises')).find((e) => e.id === 'plank')!;
    await put('exercises', { ...ex, inactive: true });
    await initDb();
    expect((await getAll<Exercise>('exercises')).find((e) => e.id === 'plank')!.inactive).toBe(true);
    const file = await exportData();
    await put('exercises', { ...ex, inactive: false });
    await applyImport(file, 'replace');
    expect((await getAll<Exercise>('exercises')).find((e) => e.id === 'plank')!.inactive).toBe(true);
  });
});
