import { computeMuscleStatus, fatigueColor, HALF_LIFE_HOURS, setLoad } from './fatigue';
import { byId, DAY, exercises, HOUR, log, session } from '../test/helpers';

const NOW = 1_800_000_000_000;

describe('fatigue', () => {
  it('starts every muscle at 0% fatigue / 100% recovery', () => {
    const s = computeMuscleStatus([], exercises, NOW);
    for (const st of Object.values(s)) {
      expect(st.fatigue).toBe(0);
      expect(st.recovery).toBe(100);
      expect(st.lastTrained).toBeNull();
    }
  });

  it('adds fatigue mostly to primary muscles and some to secondary', () => {
    const s = computeMuscleStatus([session('bench_press', [{}, {}, {}], { at: NOW })], exercises, NOW);
    expect(s.chest.fatigue).toBeGreaterThan(s.triceps.fatigue);
    expect(s.triceps.fatigue).toBeGreaterThan(0);
    expect(s.quads.fatigue).toBe(0);
    expect(s.chest.recovery).toBeCloseTo(100 - s.chest.fatigue, 1);
  });

  it('scales with effort', () => {
    const easy = setLoad(byId.get('bench_press')!, log({ effort: 3 }), 'regular').chest!;
    const hard = setLoad(byId.get('bench_press')!, log({ effort: 10 }), 'regular').chest!;
    expect(hard).toBeGreaterThan(easy);
  });

  it('tracks set types differently (regular < superset < hiit)', () => {
    const ex = byId.get('pushup')!;
    const r = setLoad(ex, log(), 'regular').chest!;
    const s = setLoad(ex, log(), 'superset').chest!;
    const h = setLoad(ex, log(), 'hiit').chest!;
    expect(r).toBeLessThan(s);
    expect(s).toBeLessThan(h);
  });

  it('decays by half after the muscle half-life', () => {
    const at = NOW - HALF_LIFE_HOURS.chest * HOUR;
    const fresh = computeMuscleStatus([session('db_fly', [{}], { at: NOW })], exercises, NOW).chest.fatigue;
    const aged = computeMuscleStatus([session('db_fly', [{}], { at })], exercises, NOW).chest.fatigue;
    expect(aged).toBeCloseTo(fresh / 2, 0);
  });

  it('recovers to near 100% after several days', () => {
    const s = computeMuscleStatus([session('squat', [{}, {}, {}, {}], { at: NOW - 6 * DAY })], exercises, NOW);
    expect(s.quads.recovery).toBeGreaterThan(95);
  });

  it('caps fatigue at 100%', () => {
    const sets = Array.from({ length: 30 }, () => ({ effort: 10 }));
    const s = computeMuscleStatus([session('bench_press', sets, { at: NOW })], exercises, NOW);
    expect(s.chest.fatigue).toBe(100);
    expect(s.chest.recovery).toBe(0);
  });

  it('ignores skipped exercises', () => {
    const s = computeMuscleStatus([session('bench_press', [{}], { at: NOW, skipped: true })], exercises, NOW);
    expect(s.chest.fatigue).toBe(0);
    expect(s.chest.lastTrained).toBeNull();
  });

  it('reports stats: last trained, sets per type, top exercises', () => {
    const sessions = [
      session('bench_press', [{}, {}], { at: NOW - HOUR }),
      session('pushup', [{}], { at: NOW - 2 * HOUR, setType: 'hiit' }),
    ];
    const c = computeMuscleStatus(sessions, exercises, NOW).chest;
    expect(c.lastTrained).toBe(NOW - HOUR);
    expect(c.sets7d).toEqual({ regular: 2, superset: 0, hiit: 1 });
    expect(c.topExercises[0]).toEqual({ exerciseId: 'bench_press', sets: 2 });
    expect(c.hoursToRecovered).toBeGreaterThan(0);
  });

  it('maps fatigue to a blue → red colour scale', () => {
    const parse = (c: string) => c.match(/\d+/g)!.map(Number);
    const [r0, , b0] = parse(fatigueColor(0));
    const [r1, , b1] = parse(fatigueColor(100));
    expect(b0).toBeGreaterThan(r0); // blue
    expect(r1).toBeGreaterThan(b1); // red
    expect(fatigueColor(-5)).toBe(fatigueColor(0));
    expect(fatigueColor(500)).toBe(fatigueColor(100));
  });
});
