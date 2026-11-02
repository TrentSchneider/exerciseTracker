import { primaryMuscles } from '../../domain/fatigue';
import { MUSCLE_LABELS, type Exercise, type SetLog } from '../../types';
import type { Units } from '../../domain/units';
import { SetsTable } from './SetsTable';
import { ExerciseGuide } from './ExerciseGuide';
import { Modal } from './Modal';

export function ExerciseInfoModal({ ex, onClose, sets, units, onSaveSets }: {
  ex: Exercise; onClose: () => void; sets?: SetLog[]; units?: Units; onSaveSets?: (sets: SetLog[]) => void;
}) {
  return (
    <Modal title={ex.name} onClose={onClose}>
      {sets && units && onSaveSets && <SetsTable ex={ex} sets={sets} units={units} onSave={onSaveSets} />}
      <p className="muted">{primaryMuscles(ex).map((m) => MUSCLE_LABELS[m]).join(', ')}</p>
      <ExerciseGuide ex={ex} />
    </Modal>
  );
}
