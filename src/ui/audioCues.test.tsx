import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { useRef } from 'react';
import { go, ownEquipment, renderApp, getAll } from '../test/ui';
import { initDb, put } from '../db/db';
import { DAY, session } from '../test/helpers';
import { Timer } from './components/Timer';

// Controllable countdown: each hook instance stays at "3" until the test completes it.
const cd = vi.hoisted(() => ({ calls: new Map<object, { active: boolean; done: () => void }>(), playTimerEnd: vi.fn() }));
vi.mock('./audio', () => ({
  playTimerEnd: cd.playTimerEnd, playTick: vi.fn(), playGo: vi.fn(),
  useCountdown: (active: boolean, done: () => void) => {
    const key = useRef({}).current;
    cd.calls.set(key, { active, done });
    return active ? 3 : null;
  },
}));
const finishCountdown = () => act(() => { [...cd.calls.values()].filter((c) => c.active).forEach((c) => c.done()); });

beforeEach(() => {
  cd.calls.clear();
  cd.playTimerEnd.mockClear();
  vi.spyOn(window, 'confirm').mockReturnValue(true);
});
afterEach(() => { vi.restoreAllMocks(); vi.useRealTimers(); });

type User = Awaited<ReturnType<typeof renderApp>>;

const endStartCountdown = async () => {
  finishCountdown();
  await waitFor(() => expect(screen.queryByRole('alert', { name: 'Countdown' })).toBeNull());
};

async function startWorkout(user: User) {
  await ownEquipment(user, ['Dumbbells', 'Bench', 'Barbell & Plates', 'Cable', 'Pull-up Bar', 'Resistance Bands', 'Kettlebell']);
  await go(user, 'Workouts');
  await user.click(screen.getByRole('link', { name: 'Suggest a workout' }));
  await user.click(screen.getByRole('button', { name: 'Suggest workout' }));
  await screen.findByRole('heading', { name: 'Workout overview' });
  await user.click(screen.getByRole('button', { name: 'Start workout' }));
  await screen.findByTestId('set-form');
}

describe('timer end audio cue', () => {
  it('plays the end cue once when a timer reaches zero', () => {
    vi.useFakeTimers();
    const onDone = vi.fn();
    render(<Timer label="Rest" seconds={2} autoStart onDone={onDone} />);
    act(() => { vi.advanceTimersByTime(1000); });
    expect(cd.playTimerEnd).not.toHaveBeenCalled();
    act(() => { vi.advanceTimersByTime(1500); });
    expect(cd.playTimerEnd).toHaveBeenCalledTimes(1);
    expect(onDone).toHaveBeenCalledTimes(1);
  });

  it('runs a countdown before a timer with countdown enabled starts', () => {
    vi.useFakeTimers();
    render(<Timer label="Exercise timer" seconds={30} countdown />);
    fireEvent.click(screen.getByRole('button', { name: 'Start' }));
    expect(screen.getByRole('timer')).toHaveTextContent('3');
    expect(screen.getByRole('button', { name: 'Cancel' })).toBeInTheDocument();
    finishCountdown();
    expect(screen.getByRole('timer')).toHaveTextContent('0:30');
    expect(screen.getByRole('button', { name: 'Pause' })).toBeInTheDocument();
  });

  it('does not count down for timers without it (rest)', () => {
    render(<Timer label="Rest" seconds={30} />);
    fireEvent.click(screen.getByRole('button', { name: 'Start' }));
    expect(screen.getByRole('button', { name: 'Pause' })).toBeInTheDocument();
  });
});

describe('workout start / resume countdown', () => {
  it('counts down when the workout starts, blocking input until it finishes', async () => {
    const user = await renderApp();
    await startWorkout(user);
    expect(screen.getByRole('alert', { name: 'Countdown' })).toHaveTextContent('3');
    expect(screen.getByRole('button', { name: 'Complete set' })).toBeDisabled();
    finishCountdown();
    await waitFor(() => expect(screen.queryByRole('alert', { name: 'Countdown' })).toBeNull());
    expect(screen.getByRole('button', { name: 'Complete set' })).toBeEnabled();
  });

  it('counts down before resuming from pause and stays paused until it ends', async () => {
    const user = await renderApp();
    await startWorkout(user);
    await endStartCountdown();
    await user.click(screen.getByRole('button', { name: 'Pause workout' }));
    await user.click(await screen.findByRole('button', { name: 'Resume workout' }));
    expect(await screen.findByRole('alert', { name: 'Countdown' })).toBeInTheDocument();
    expect(await screen.findByText('Workout paused')).toBeInTheDocument();
    finishCountdown();
    await waitFor(() => expect(screen.queryByText('Workout paused')).toBeNull());
    expect(screen.getByRole('button', { name: 'Complete set' })).toBeEnabled();
  });
});

describe('set values and editing during a workout', () => {
  it('lists logged reps/weight under the exercise name and edits them from the modal', async () => {
    const user = await renderApp();
    await startWorkout(user);
    await endStartCountdown();
    const name = screen.getByRole('heading', { level: 2 }).textContent!;
    await user.click(screen.getByRole('button', { name: 'Complete set' }));
    const line = await screen.findByText(/^Set 1:/);
    expect(line).toHaveTextContent(/reps|lb|Bodyweight|\d+s/);

    // open modal from the exercise list: completed sets are first, with an Edit button
    const link = screen.getAllByRole('button', { name: `About ${name}` }).at(-1)!;
    await user.click(link);
    const dlg = await screen.findByRole('dialog');
    const first = dlg.querySelector('h3, [data-testid="exercise-guide"]')!;
    expect(first.textContent).toBe('Completed sets');
    expect(within(dlg).queryByLabelText('Set 1 effort')).toBeNull();
    await user.click(within(dlg).getByRole('button', { name: 'Edit' }));
    const effort = within(dlg).getByLabelText('Set 1 effort');
    fireEvent.change(effort, { target: { value: '9' } });
    await user.click(within(dlg).getByRole('button', { name: 'Save' }));
    expect(within(dlg).getByText('9/10')).toBeInTheDocument();
    await user.click(within(dlg).getByRole('button', { name: 'Close' }));

    // edit persisted into the active session
    await user.click(screen.getAllByRole('button', { name: `About ${name}` }).at(-1)!);
    expect(within(await screen.findByRole('dialog')).getByText('9/10')).toBeInTheDocument();
  });

  it('keeps the current exercise fields editable while paused', async () => {
    const user = await renderApp();
    await startWorkout(user);
    await endStartCountdown();
    await user.click(screen.getByRole('button', { name: 'Pause workout' }));
    await screen.findByText('Workout paused');
    const form = screen.getByTestId('set-form');
    const effort = within(form).getByLabelText('Effort from 1 to 10');
    expect(effort).toBeEnabled();
    fireEvent.change(effort, { target: { value: '3' } });
    expect(effort).toHaveValue('3');
    expect(screen.getByRole('button', { name: 'Complete set' })).toBeDisabled();
  });
});

describe('history editing', () => {
  it('edits a previous exercise and persists the change', async () => {
    await initDb();
    await put('sessions', session('bench_press', [{ reps: 5, weightKg: 60, effort: 8 }], { at: Date.now() - DAY, id: 's1' }));
    const user = await renderApp('/history/s1');
    await screen.findByRole('link', { name: 'Barbell Bench Press' });
    await user.click(screen.getByRole('button', { name: 'Edit' }));
    const reps = screen.getByLabelText('Set 1 reps');
    await user.clear(reps);
    await user.type(reps, '12');
    await user.click(screen.getByRole('button', { name: 'Save' }));
    expect(screen.getByRole('button', { name: 'Edit' })).toBeInTheDocument();
    await waitFor(async () => expect((await getAll<any>('sessions'))[0].exercises[0].sets[0].reps).toBe(12));
  });
});
