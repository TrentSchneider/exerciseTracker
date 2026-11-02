import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { SetsTable } from './components/SetsTable';
import type { Exercise, SetLog } from '../types';

const ex = { id: 'x', name: 'Press', kind: 'weighted' } as unknown as Exercise;
const sets: SetLog[] = [{ reps: 10, weightKg: 50, bodyweight: false, durationSec: 0, effort: 7, at: 0 }];

describe('SetsTable', () => {
  it('toggles to editable fields and saves edits', async () => {
    const user = userEvent.setup();
    const onSave = vi.fn();
    render(<SetsTable ex={ex} sets={sets} units="kg" onSave={onSave} />);
    expect(screen.queryByLabelText('Set 1 reps')).toBeNull();
    await user.click(screen.getByRole('button', { name: 'Edit' }));
    const reps = screen.getByLabelText('Set 1 reps');
    await user.clear(reps);
    await user.type(reps, '12');
    await user.click(screen.getByRole('button', { name: 'Save' }));
    expect(onSave).toHaveBeenCalledWith([{ ...sets[0], reps: 12 }]);
    expect(screen.getByRole('button', { name: 'Edit' })).toBeInTheDocument();
  });
});
