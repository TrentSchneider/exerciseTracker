import { describe, expect, it } from 'vitest';
import { FARM, FLOOR, POSES, SHIN, THIGH, TORSO, UARM, solve, type Pt } from './poseRig';

const dist = (a: Pt, b: Pt) => Math.hypot(a[0] - b[0], a[1] - b[1]);
const cross = (o: Pt, a: Pt, b: Pt) => (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]);
const all = Object.entries(POSES).flatMap(([key, frames]) => frames.map((spec, i) => ({ key, i, spec, s: solve(spec) })));

describe('pose rig', () => {
  it('keeps every bone at a constant length', () => {
    for (const { s, key, spec } of all) {
      expect(dist(s.N, s.P), key).toBeCloseTo(TORSO + (spec.lift ?? 0), 5);
      expect(dist(s.P, s.K), key).toBeCloseTo(THIGH, 5);
      expect(dist(s.K, s.F), key).toBeCloseTo(SHIN, 5);
      expect(dist(s.N, s.E), key).toBeCloseTo(UARM, 5);
      expect(dist(s.E, s.W), key).toBeCloseTo(FARM, 5);
    }
  });

  it('bends knees toward the front of the body and elbows toward the back', () => {
    for (const { s, key, i } of all) {
      if (s.front) continue;
      const c = s.flip ? -1 : 1;
      const kneeSide = cross(s.P, s.F, s.K);
      const elbowSide = cross(s.N, s.W, s.E);
      if (Math.abs(kneeSide) > 0.5) expect(Math.sign(kneeSide), `${key}#${i} knee`).toBe(-c);
      if (Math.abs(elbowSide) > 0.5) expect(Math.sign(elbowSide), `${key}#${i} elbow`).toBe(c);
    }
  });

  it('matches known examples', () => {
    const [, squat] = POSES.squat.map(solve);
    expect(squat.K[0]).toBeGreaterThan(squat.P[0]);
    const [, pushup] = POSES.pushup.map(solve);
    expect(pushup.E[0]).toBeGreaterThan(pushup.N[0]);
    const [, curl] = POSES.curl.map(solve);
    expect(curl.E[1]).toBeGreaterThan(curl.N[1]);
    expect(curl.E[0]).toBeLessThanOrEqual(curl.N[0] + 4);
    const [plank] = POSES.plank.map(solve);
    expect(plank.W[0]).toBeLessThan(plank.P[0]);
  });

  it('keeps feet near the floor', () => {
    for (const { s, key } of all) {
      expect(s.F[1], key).toBeLessThanOrEqual(FLOOR + 1);
      expect(s.W[1], key).toBeLessThanOrEqual(FLOOR + 1);
    }
  });
});
