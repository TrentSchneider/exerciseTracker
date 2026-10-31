import { useState } from 'react';
import { EXERCISE_PHOTO_IDS } from '../../data/exerciseImages';
import { guidanceFor } from '../../data/guidance';
import { primaryMuscles } from '../../domain/fatigue';
import { MUSCLES, MUSCLE_LABELS, type Exercise, type MuscleId } from '../../types';
import { BodyDiagram } from './BodyDiagram';
import { FLOOR, POSES, solve, type Pt, type Solved } from './poseRig';

const pts = (...p: Pt[]) => p.map((q) => q.join(',')).join(' ');

function Stick({ f }: { f: Solved }) {
  return (
    <g stroke="currentColor" strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round" fill="none">
      <line x1={0} y1={FLOOR} x2={60} y2={FLOOR} strokeWidth={1} style={{ stroke: 'var(--muted)' }} />
      <g opacity={0.55}>
        {f.K2 && f.F2 && f.toe2 && <polyline points={pts(f.P, f.K2, f.F2, f.toe2)} />}
        {f.E2 && f.W2 && <polyline points={pts(f.N, f.E2, f.W2)} />}
      </g>
      <line x1={f.N[0]} y1={f.N[1]} x2={f.P[0]} y2={f.P[1]} />
      <polyline points={pts(f.P, f.K, f.F, f.toe)} />
      <polyline points={pts(f.N, f.E, f.W)} />
      <circle cx={f.head[0]} cy={f.head[1]} r={3.6} fill="currentColor" stroke="none" />
      {f.bar && <circle cx={f.W[0]} cy={f.W[1]} r={2.6} fill="#f59e0b" stroke="none" />}
    </g>
  );
}

export function ExerciseGuide({ ex }: { ex: Exercise }) {
  const muscleNames = primaryMuscles(ex).map((m) => MUSCLE_LABELS[m]);
  const g = guidanceFor(ex, muscleNames);
  const [start, end] = POSES[g.pose].map(solve) as [Solved, Solved];
  const fatigue = Object.fromEntries(MUSCLES.map((m) => [m, 0])) as Record<MuscleId, number>;
  const fills = Object.fromEntries(MUSCLES.map((m) => {
    const w = ex.muscles[m as MuscleId] ?? 0;
    return [m, w >= 0.6 ? 'var(--muscle-primary)' : w > 0 ? 'var(--muscle-secondary)' : 'var(--neutral-muscle)'];
  })) as Record<MuscleId, string>;
  const secondary = MUSCLES.filter((m) => (ex.muscles[m] ?? 0) > 0 && (ex.muscles[m] ?? 0) < 0.6).map((m) => MUSCLE_LABELS[m]);
  const [photoFailed, setPhotoFailed] = useState(false);
  const photos = EXERCISE_PHOTO_IDS.has(ex.id) && !photoFailed;
  const base = import.meta.env.BASE_URL;
  const frames: [string, Solved][] = [['Start', start], ['Finish', end]];
  return (
    <div className="exercise-guide stack" data-testid="exercise-guide">
      <section aria-label="Description">
        <h3>About this exercise</h3>
        <p>{g.description}</p>
      </section>
      <section aria-label="How to perform">
        <h3>How to perform</h3>
        <ol className="steps">{g.steps.map((s, i) => <li key={i}>{s}</li>)}</ol>
      </section>
      <section aria-label="Visuals">
        <h3>Visuals</h3>
        <div className="visuals">
          {frames.map(([label, f], i) => (
            <figure key={label}>
              {photos ? (
                <img
                  className="photo" src={`${base}exercise-images/${ex.id}/${i}.jpg`} loading="lazy"
                  alt={`${ex.name} ${label.toLowerCase()} position`} onError={() => setPhotoFailed(true)}
                />
              ) : (
                <svg viewBox="-4 -6 68 66" role="img" aria-label={`${ex.name} ${label.toLowerCase()} position`} className="stick">
                  <Stick f={f} />
                </svg>
              )}
              <figcaption>{label}</figcaption>
            </figure>
          ))}
          <figure className="muscle-fig">
            <BodyDiagram fatigue={fatigue} fills={fills} selected={null} onSelect={() => undefined} readOnly />
            <figcaption>
              <span className="swatch primary" /> Primary: {muscleNames.join(', ')}
              {secondary.length > 0 && <><br /><span className="swatch secondary" /> Secondary: {secondary.join(', ')}</>}
            </figcaption>
          </figure>
        </div>
        {photos && <p className="muted small">Photos: Free Exercise DB (public domain).</p>}
      </section>
    </div>
  );
}
