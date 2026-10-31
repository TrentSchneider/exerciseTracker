import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { useTheme } from './theme';
import { ACTIVE_SESSION_KEY, DEFAULT_SETTINGS, deleteSetting, getAll, getSetting, initDb, put, remove, setSetting } from '../db/db';
import { computeMuscleStatus, type MuscleStatus } from '../domain/fatigue';
import { finishSession, type ActiveSession } from '../domain/session';
import type { Equipment, Exercise, MuscleId, PlanEntry, Routine, Session, Settings, Workout } from '../types';
import { uid } from '../domain/units';

export interface AppState {
  ready: boolean;
  settings: Settings;
  equipment: Equipment[];
  exercises: Exercise[];
  workouts: Workout[];
  routines: Routine[];
  plans: PlanEntry[];
  sessions: Session[];
  active: ActiveSession | null;
  draft: Workout | null;
  status: Record<MuscleId, MuscleStatus>;
  owned: Set<string>;
  exerciseById: Map<string, Exercise>;
  updateSettings: (patch: Partial<Settings>) => Promise<void>;
  setEquipmentOwned: (id: string, owned: boolean) => Promise<void>;
  setEquipmentWeightOptions: (id: string, weightOptionsKg: number[]) => Promise<void>;
  addEquipment: (name: string) => Promise<void>;
  saveExercise: (ex: Exercise) => Promise<void>;
  saveWorkout: (w: Workout) => Promise<void>;
  deleteWorkout: (id: string) => Promise<void>;
  saveRoutine: (r: Routine) => Promise<void>;
  deleteRoutine: (id: string) => Promise<void>;
  savePlan: (p: PlanEntry) => Promise<void>;
  deletePlan: (id: string) => Promise<void>;
  deleteSession: (id: string) => Promise<void>;
  setActive: (a: ActiveSession | null) => Promise<void>;
  finishActive: (a: ActiveSession) => Promise<Session>;
  setDraft: (w: Workout | null) => void;
  reload: () => Promise<void>;
}

const Ctx = createContext<AppState | null>(null);

export function useApp(): AppState {
  const v = useContext(Ctx);
  if (!v) throw new Error('useApp must be used inside AppProvider');
  return v;
}

export function AppProvider({ children }: { children: ReactNode }) {
  const [ready, setReady] = useState(false);
  const [settings, setSettings] = useState<Settings>(DEFAULT_SETTINGS);
  const [equipment, setEquipment] = useState<Equipment[]>([]);
  const [exercises, setExercises] = useState<Exercise[]>([]);
  const [workouts, setWorkouts] = useState<Workout[]>([]);
  const [routines, setRoutines] = useState<Routine[]>([]);
  const [plans, setPlans] = useState<PlanEntry[]>([]);
  const [sessions, setSessions] = useState<Session[]>([]);
  const [active, setActiveState] = useState<ActiveSession | null>(null);
  const [draft, setDraft] = useState<Workout | null>(null);
  const [now, setNow] = useState(() => Date.now());
  useTheme(settings.theme);

  const reload = useCallback(async () => {
    await initDb();
    const [s, eq, ex, wo, ro, pl, se, act] = await Promise.all([
      getSetting<Settings>('settings', DEFAULT_SETTINGS),
      getAll<Equipment>('equipment'),
      getAll<Exercise>('exercises'),
      getAll<Workout>('workouts'),
      getAll<Routine>('routines'),
      getAll<PlanEntry>('plans'),
      getAll<Session>('sessions'),
      getSetting<ActiveSession | null>(ACTIVE_SESSION_KEY, null),
    ]);
    setSettings({ ...DEFAULT_SETTINGS, ...s });
    setEquipment(eq);
    setExercises(ex);
    setWorkouts(wo.sort((a, b) => b.createdAt - a.createdAt));
    setRoutines(ro);
    setPlans(pl);
    setSessions(se.sort((a, b) => b.completedAt - a.completedAt));
    setActiveState(act);
    setReady(true);
  }, []);

  useEffect(() => {
    void reload();
    const t = setInterval(() => setNow(Date.now()), 60_000);
    return () => clearInterval(t);
  }, [reload]);

  const status = useMemo(() => computeMuscleStatus(sessions, exercises, Math.max(now, Date.now())), [sessions, exercises, now]);
  const owned = useMemo(() => new Set(equipment.filter((e) => e.owned).map((e) => e.id)), [equipment]);
  const exerciseById = useMemo(() => new Map(exercises.map((e) => [e.id, e])), [exercises]);

  const upsert = <T extends { id: string }>(list: T[], v: T) =>
    list.some((x) => x.id === v.id) ? list.map((x) => (x.id === v.id ? v : x)) : [...list, v];

  const value: AppState = {
    ready, settings, equipment, exercises, workouts, routines, plans, sessions, active, draft, status, owned,
    exerciseById, reload, setDraft,
    updateSettings: async (patch) => {
      const next = { ...settings, ...patch };
      await setSetting('settings', next);
      setSettings(next);
    },
    setEquipmentOwned: async (id, o) => {
      const e = equipment.find((x) => x.id === id);
      if (!e) return;
      const next = { ...e, owned: o };
      await put('equipment', next);
      setEquipment((l) => upsert(l, next));
    },
    setEquipmentWeightOptions: async (id, weightOptionsKg) => {
      const e = equipment.find((x) => x.id === id);
      if (!e) return;
      const next: Equipment = { ...e, weightOptionsKg: [...new Set(weightOptionsKg)].sort((a, b) => a - b) };
      if (!weightOptionsKg.length) delete next.weightOptionsKg;
      await put('equipment', next);
      setEquipment((l) => upsert(l, next));
    },
    addEquipment: async (name) => {
      const e: Equipment = { id: uid('eq'), name: name.trim(), owned: true, custom: true };
      await put('equipment', e);
      setEquipment((l) => [...l, e]);
    },
    saveExercise: async (ex) => {
      await put('exercises', ex);
      setExercises((l) => upsert(l, ex));
    },
    saveWorkout: async (w) => {
      await put('workouts', w);
      setWorkouts((l) => upsert(l, w));
    },
    deleteWorkout: async (id) => {
      await remove('workouts', id);
      setWorkouts((l) => l.filter((w) => w.id !== id));
      for (const p of plans.filter((p) => p.workoutId === id)) await remove('plans', p.id);
      setPlans((l) => l.filter((p) => p.workoutId !== id));
    },
    saveRoutine: async (r) => {
      await put('routines', r);
      setRoutines((l) => upsert(l, r));
    },
    deleteRoutine: async (id) => {
      await remove('routines', id);
      setRoutines((l) => l.filter((r) => r.id !== id));
    },
    savePlan: async (p) => {
      await put('plans', p);
      setPlans((l) => upsert(l, p));
    },
    deletePlan: async (id) => {
      await remove('plans', id);
      setPlans((l) => l.filter((p) => p.id !== id));
    },
    deleteSession: async (id) => {
      await remove('sessions', id);
      setSessions((l) => l.filter((s) => s.id !== id));
    },
    setActive: async (a) => {
      if (a) await setSetting(ACTIVE_SESSION_KEY, a);
      else await deleteSetting(ACTIVE_SESSION_KEY);
      setActiveState(a);
    },
    finishActive: async (a) => {
      const session = finishSession(a);
      await put('sessions', session);
      await deleteSetting(ACTIVE_SESSION_KEY);
      setSessions((l) => [session, ...l]);
      setActiveState(null);
      return session;
    },
  };

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}
