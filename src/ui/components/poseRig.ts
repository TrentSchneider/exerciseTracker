import type { PoseKey } from '../../data/guidance';

export type Pt = [number, number];

export const TORSO = 18;
export const THIGH = 12;
export const SHIN = 11.5;
export const UARM = 9.5;
export const FARM = 9.5;
export const FLOOR = 57.5;

/**
 * A pose is described by where the pelvis is, how far the torso leans, and where the feet and
 * wrists should be. Knees and elbows are then solved with two-bone IK so limb lengths stay
 * constant and joints only ever bend in their natural direction.
 */
export interface Spec {
  P?: Pt;
  /** Torso lean in degrees from vertical; positive leans toward +x. */
  a?: number;
  /** Extra neck height (shoulder shrug). */
  lift?: number;
  F?: Pt;
  F2?: Pt;
  W?: Pt;
  W2?: Pt;
  /** Prone body (facing the floor), which mirrors the hinge directions. */
  flip?: boolean;
  /** Seen from the front: knees and elbows bend outward. */
  front?: boolean;
  bar?: boolean;
  /** Explicit foot offset, for a raised heel. */
  toe?: Pt;
}

export interface Solved {
  N: Pt; P: Pt; K: Pt; F: Pt; toe: Pt; E: Pt; W: Pt;
  K2?: Pt; F2?: Pt; toe2?: Pt; E2?: Pt; W2?: Pt;
  head: Pt;
  bar: boolean;
  front: boolean;
  flip: boolean;
}

const RAD = Math.PI / 180;
const add = (p: Pt, q: Pt): Pt => [p[0] + q[0], p[1] + q[1]];
const scale = (p: Pt, s: number): Pt => [p[0] * s, p[1] * s];

/** Angle (degrees from vertical) that points the torso from the pelvis toward a neck position. */
export const lean = (P: Pt, N: Pt) => Math.atan2(N[0] - P[0], P[1] - N[1]) / RAD;

function limb(A: Pt, T: Pt, l1: number, l2: number, sigma: number, front: boolean) {
  const d: Pt = [T[0] - A[0], T[1] - A[1]];
  const raw = Math.hypot(d[0], d[1]) || 1e-6;
  const dist = Math.min(l1 + l2, Math.max(Math.abs(l1 - l2) + 0.01, raw));
  const u: Pt = [d[0] / raw, d[1] / raw];
  const end = add(A, scale(u, dist));
  const along = (l1 * l1 - l2 * l2 + dist * dist) / (2 * dist);
  const h = Math.sqrt(Math.max(0, l1 * l1 - along * along));
  let n: Pt = [-u[1] * sigma, u[0] * sigma];
  if (front) {
    const a = A[0] + u[0] * along + n[0] * h;
    const b = A[0] + u[0] * along - n[0] * h;
    if (Math.abs(b - A[0]) > Math.abs(a - A[0]) + 1e-6) n = [-n[0], -n[1]];
  }
  const joint = add(add(A, scale(u, along)), scale(n, h));
  return { joint, end, n };
}

export function solve(s: Spec): Solved {
  const P = s.P ?? [30, 34];
  const a = (s.a ?? 0) * RAD;
  const c = s.flip ? -1 : 1;
  const front = !!s.front;
  const N = add(P, scale([Math.sin(a), -Math.cos(a)], TORSO + (s.lift ?? 0)));
  const legSigma = -c, armSigma = c;
  const leg = (T: Pt) => {
    const r = limb(P, T, THIGH, SHIN, legSigma, front);
    const t: Pt = s.toe && T === s.F ? s.toe : front ? [0, 0] : scale(r.n, 4);
    return { K: r.joint, F: r.end, toe: add(r.end, t) };
  };
  const arm = (T: Pt) => {
    const r = limb(N, T, UARM, FARM, armSigma, front);
    return { E: r.joint, W: r.end };
  };
  const F = s.F ?? [30, FLOOR];
  const L = leg(F);
  const A = arm(s.W ?? [30, 80]);
  const dx = N[0] - P[0], dy = N[1] - P[1];
  const len = Math.hypot(dx, dy) || 1;
  const out: Solved = {
    N, P, ...L, ...A,
    head: [N[0] + (dx / len) * 5, N[1] + (dy / len) * 5],
    bar: !!s.bar, front, flip: !!s.flip,
  };
  if (s.F2) { const l2 = leg(s.F2); out.K2 = l2.K; out.F2 = l2.F; out.toe2 = l2.toe; }
  if (s.W2) { const a2 = arm(s.W2); out.E2 = a2.E; out.W2 = a2.W; }
  return out;
}

const FRONT_FEET = { F: [28, FLOOR] as Pt, F2: [32, FLOOR] as Pt };
const HINGE_END: Spec = { P: [19, 37], a: 75, W: [37, 60], bar: true };
const PUSHUP_TOP: Spec = { flip: true, P: [36, 47], a: -63, F: [58, FLOOR], W: [20, 70] };

export const POSES: Record<PoseKey, [Spec, Spec]> = {
  press: [{ W: [35, 15], bar: true }, { W: [31, -6], bar: true }],
  curl: [{ bar: true }, { W: [38, 17], bar: true }],
  pushdown: [{ W: [37, 17], bar: true }, { W: [33, 40], bar: true }],
  overhead: [{ W: [23, 13], bar: true }, { W: [31, -6], bar: true }],
  lateral: [
    { front: true, ...FRONT_FEET, W: [26, 70], W2: [34, 70], bar: true },
    { front: true, ...FRONT_FEET, W: [8, 18], W2: [52, 18], bar: true },
  ],
  frontRaise: [{ bar: true }, { W: [50, 16], bar: true }],
  fly: [
    { front: true, ...FRONT_FEET, W: [10, 22], W2: [50, 22], bar: true },
    { front: true, ...FRONT_FEET, W: [26, 26], W2: [34, 26], bar: true },
  ],
  shrug: [{ bar: true }, { lift: 2.5, bar: true }],
  carry: [{ bar: true }, { bar: true, F: [27, FLOOR], F2: [34, FLOOR] }],
  calf: [{}, { P: [30, 30.5], F: [30, 54], toe: [4, 3.5] }],
  chop: [{ a: -8, W: [42, 2], bar: true }, { a: 28, P: [28, 35], W: [20, 44], bar: true }],
  squat: [{ W: [38, 22] }, { P: [17, 41], a: 38, W: [36, 26] }],
  lunge: [
    { F: [36, FLOOR], F2: [24, FLOOR] },
    { P: [30, 44], F: [40, FLOOR], F2: [17, 56] },
  ],
  hinge: [{ bar: true }, HINGE_END],
  row: [HINGE_END, { ...HINGE_END, W: [34, 38] }],
  pullup: [
    { P: [30, 38], F: [27, 56], W: [30, 1], bar: true },
    { P: [30, 29], F: [28, 50], W: [32, -1], bar: true },
  ],
  bench: [
    { P: [34, 54], a: -90, F: [46, FLOOR], W: [16, 36], bar: true },
    { P: [34, 54], a: -90, F: [46, FLOOR], W: [22, 44], bar: true },
  ],
  pushup: [
    PUSHUP_TOP,
    { flip: true, P: [35, 53.4], a: -80, F: [58, FLOOR], W: [20, FLOOR] },
  ],
  plank: [PUSHUP_TOP, { ...PUSHUP_TOP, F2: [58, 44] }],
  hold: [
    { flip: true, P: [32, 54], a: -90, F: [56, 56], W: [-6, 54] },
    { flip: true, P: [32, 54], a: -80, F: [56, 47], W: [-6, 48] },
  ],
  crunch: [
    { P: [34, 54], a: -90, F: [46, FLOOR], W: [12, 50] },
    { P: [34, 54], a: -58, F: [46, FLOOR], W: [15, 40] },
  ],
  legRaise: [
    { P: [34, 54], a: -90, F: [58, 56], W: [26, 56] },
    { P: [34, 54], a: -90, F: [34, 26], W: [26, 56] },
  ],
  bridge: [
    { P: [32, 54], a: -90, F: [46, FLOOR], W: [24, 56] },
    { P: [30, 42], a: -132, F: [44, FLOOR], W: [24, 56] },
  ],
  run: [
    { a: 8, F: [38, 50], F2: [18, 53], W: [40, 22], W2: [21, 24] },
    { a: 8, F: [18, 53], F2: [38, 50], W: [21, 24], W2: [40, 22] },
  ],
  jack: [
    { front: true, ...FRONT_FEET, W: [24, 70], W2: [36, 70] },
    { front: true, F: [19, FLOOR], F2: [41, FLOOR], W: [14, 0], W2: [46, 0] },
  ],
  burpee: [{ P: [22, 46], a: 40, F: [28, FLOOR], W: [38, 60] }, PUSHUP_TOP],
};
