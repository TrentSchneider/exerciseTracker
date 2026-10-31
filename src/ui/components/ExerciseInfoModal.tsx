import { primaryMuscles } from '../../domain/fatigue';
import { MUSCLE_LABELS, type Exercise } from '../../types';
import { ExerciseGuide } from './ExerciseGuide';
import { Modal } from './Modal';

export function ExerciseInfoModal({ ex, onClose }: { ex: Exercise; onClose: () => void }) {
  return (
    <Modal title={ex.name} onClose={onClose}>
      <p className="muted">{primaryMuscles(ex).map((m) => MUSCLE_LABELS[m]).join(', ')}</p>
      <ExerciseGuide ex={ex} />
    </Modal>
  );
}
