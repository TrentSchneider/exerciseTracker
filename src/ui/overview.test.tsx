import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import { go, ownEquipment, renderApp } from '../test/ui';

beforeEach(() => {
  vi.spyOn(window, 'confirm').mockReturnValue(true);
});
afterEach(() => vi.restoreAllMocks());

type User = Awaited<ReturnType<typeof renderApp>>;

async function suggest(user: User, chips: string[], untoggle: string[] = []) {
  await ownEquipment(user, ['Dumbbells', 'Bench', 'Barbell & Plates', 'Cable', 'Pull-up Bar', 'Resistance Bands', 'Kettlebell']);
  await go(user, 'Workouts');
  await user.click(screen.getByRole('link', { name: 'Suggest a workout' }));
  for (const c of chips) await user.click(screen.getByRole('button', { name: c, pressed: false }));
  for (const c of untoggle) await user.click(screen.getByRole('button', { name: c, pressed: true }));
  await user.click(screen.getByRole('button', { name: 'Suggest workout' }));
  await screen.findByRole('heading', { name: 'Workout overview' });
}

describe('Full body target option', () => {
  it('is the first option, selected by default, and exclusive with specific muscles', async () => {
    const user = await renderApp();
    await go(user, 'Workouts');
    await user.click(screen.getByRole('link', { name: 'Suggest a workout' }));
    const group = screen.getAllByRole('group', { name: 'Target muscles' }).find((g) => g.tagName === 'DIV')!;
    const chips = within(group).getAllByRole('button');
    expect(chips[0]).toHaveTextContent('Full body');
    expect(chips[0]).toHaveAttribute('aria-pressed', 'true');

    await user.click(within(group).getByRole('button', { name: 'Chest' }));
    expect(within(group).getByRole('button', { name: 'Full body' })).toHaveAttribute('aria-pressed', 'false');
    expect(within(group).getByRole('button', { name: 'Chest' })).toHaveAttribute('aria-pressed', 'true');

    await user.click(within(group).getByRole('button', { name: 'Full body' }));
    expect(within(group).getByRole('button', { name: 'Full body' })).toHaveAttribute('aria-pressed', 'true');
    expect(within(group).getByRole('button', { name: 'Chest' })).toHaveAttribute('aria-pressed', 'false');
  });

  it('returns to Full body when the last muscle is deselected', async () => {
    const user = await renderApp();
    await go(user, 'Workouts');
    await user.click(screen.getByRole('link', { name: 'Suggest a workout' }));
    const group = screen.getAllByRole('group', { name: 'Target muscles' }).find((g) => g.tagName === 'DIV')!;
    await user.click(within(group).getByRole('button', { name: 'Chest' }));
    await user.click(within(group).getByRole('button', { name: 'Chest' }));
    expect(within(group).getByRole('button', { name: 'Full body' })).toHaveAttribute('aria-pressed', 'true');
  });
});

describe('target tiers and ordering', () => {
  it('orders time, set types and warm-up before the targets, and enforces the tier rules', async () => {
    const user = await renderApp();
    await go(user, 'Workouts');
    await user.click(screen.getByRole('link', { name: 'Suggest a workout' }));
    const time = screen.getByLabelText('Time available');
    const setTypes = screen.getAllByRole('group', { name: 'Set types' })[0];
    const targets = screen.getAllByRole('group', { name: 'Target muscles' })[0];
    expect(time.compareDocumentPosition(setTypes) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(setTypes.compareDocumentPosition(screen.getByLabelText('Cardio warm-up')) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(screen.getByLabelText('Cardio warm-up').compareDocumentPosition(targets) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();

    const group = screen.getAllByRole('group', { name: 'Target muscles' }).find((g) => g.tagName === 'DIV')!;
    const pressed = (n: string) => within(group).getByRole('button', { name: n }).getAttribute('aria-pressed');
    await user.click(within(group).getByRole('button', { name: 'Calves' }));
    await user.click(within(group).getByRole('button', { name: 'Lower body' }));
    expect(pressed('Lower body')).toBe('true');
    expect(pressed('Calves')).toBe('false');
    await user.click(within(group).getByRole('button', { name: 'Core' }));
    expect(pressed('Full body')).toBe('false');
    await user.click(within(group).getByRole('button', { name: 'Glutes' }));
    expect(pressed('Lower body')).toBe('false');
    expect(pressed('Core')).toBe('true');
    expect(pressed('Glutes')).toBe('true');
    await user.click(within(group).getByRole('button', { name: 'Full body' }));
    expect(pressed('Core')).toBe('false');
    expect(pressed('Glutes')).toBe('false');
  });

  it('disables targets that no longer fit the time allotment', async () => {
    const user = await renderApp();
    await go(user, 'Workouts');
    await user.click(screen.getByRole('link', { name: 'Suggest a workout' }));
    await user.selectOptions(screen.getByLabelText('Time available'), '15');
    await user.click(screen.getByLabelText('Cardio warm-up'));
    const group = screen.getAllByRole('group', { name: 'Target muscles' }).find((g) => g.tagName === 'DIV')!;
    await user.click(within(group).getByRole('button', { name: 'Chest' }));
    expect(within(group).getByRole('button', { name: 'Triceps' })).toBeDisabled();
  });
});

describe('workout overview rests', () => {
  it('shows set rest to the right of each card and an editable rest between exercises', async () => {
    const user = await renderApp();
    await suggest(user, ['Supersets', 'HIIT']);

    const rows = screen.getAllByTestId('set-rest');
    expect(rows.length).toBeGreaterThan(1);
    // rest column is the sibling after the card in the same row
    for (const col of rows) {
      const prev = col.previousElementSibling as HTMLElement;
      expect(prev.classList.contains('card')).toBe(true);
    }
    const brackets = screen.getAllByTestId('bracket');
    expect(brackets.length).toBeGreaterThan(0);
    // exactly one rest control per block, none per exercise inside a bracket
    for (const b of brackets) {
      const inputs = within(b).queryAllByRole('spinbutton');
      // only a HIIT block has an input in its card: the shared work time
      expect(inputs.length).toBe(within(b).queryAllByTestId('hiit-work').length);
    }

    const between = screen.getAllByTestId('exercise-rest');
    expect(between.length).toBe(screen.getAllByTestId('set-rest').length - 1);
    const input = within(between[0]).getByRole('spinbutton');
    await user.tripleClick(input);
    await user.keyboard('75');
    expect(input).toHaveValue(75);

    const setRest = within(rows[0]).getByRole('spinbutton');
    await user.tripleClick(setRest);
    await user.keyboard('45');
    expect(setRest).toHaveValue(45);
  });

  it('shows description, how-to steps and visuals when an exercise is opened', async () => {
    const user = await renderApp();
    await suggest(user, []);
    await user.click(screen.getAllByRole('button', { name: /^Edit / })[0]);
    const dlg = await screen.findByRole('dialog');
    const guide = within(dlg).getByTestId('exercise-guide');
    expect(within(guide).getByRole('heading', { name: 'About this exercise' })).toBeInTheDocument();
    expect(within(guide).getByRole('heading', { name: 'How to perform' })).toBeInTheDocument();
    expect(within(guide).getAllByRole('listitem').length).toBeGreaterThanOrEqual(3);
    expect(within(guide).getAllByRole('img', { name: /(start|finish) position/ })).toHaveLength(2);
    expect(within(guide).getAllByRole('img', { name: /muscle diagram/ }).length).toBe(2);
    expect(within(dlg).queryByLabelText('Rest (seconds)')).toBeNull();
  });
});

describe('active workout grouping', () => {
  it('brackets superset exercises and rests only between rounds', async () => {
    const user = await renderApp();
    await suggest(user, ['Supersets'], ['Regular sets']);
    expect(screen.getAllByTestId('bracket').length).toBeGreaterThan(0);
    await user.click(screen.getByRole('button', { name: 'Start workout' }));
    await screen.findByTestId('set-form');
    expect(screen.getAllByTestId('bracket').length).toBeGreaterThan(0);

    // first set of a superset round goes straight to the partner exercise (no rest timer)
    const first = screen.getByRole('heading', { level: 2 }).textContent;
    await user.click(screen.getByRole('button', { name: 'Complete set' }));
    await waitFor(() => expect(screen.getByRole('heading', { level: 2 }).textContent).not.toBe(first));
    expect(screen.queryByRole('timer', { name: 'Rest' })).toBeNull();

    // end of the round triggers the rest between rounds
    await user.click(screen.getByRole('button', { name: 'Complete set' }));
    expect(await screen.findByRole('timer', { name: 'Rest' })).toBeInTheDocument();
    expect(screen.getByText('Rest between sets/rounds')).toBeInTheDocument();
  });
});

describe('HIIT is time based', () => {
  it('uses one editable work time for every exercise and no reps', async () => {
    const user = await renderApp();
    await suggest(user, ['HIIT'], ['Regular sets']);
    const work = screen.getAllByTestId('hiit-work')[0];
    const input = within(work).getByRole('spinbutton');
    await user.tripleClick(input);
    await user.keyboard('50');
    const card = work.closest('[data-testid="bracket"]') as HTMLElement;
    const lines = within(card).getAllByText(/rounds × \d+s work/);
    expect(lines.length).toBeGreaterThan(1);
    for (const l of lines) expect(l).toHaveTextContent('× 50s work');
    expect(within(card).queryByText(/reps/)).toBeNull();

    await user.click(screen.getByRole('button', { name: 'Start workout' }));
    await screen.findByTestId('set-form');
    expect(screen.getByRole('timer', { name: 'Work interval' })).toBeInTheDocument();
    expect(screen.queryByLabelText('Reps done')).toBeNull();
    expect(screen.getByLabelText('Time done (s)')).toHaveValue(50);
  });
});

describe('active workout extras', () => {
  it('opens the exercise guide from the exercise name and can pause and resume', async () => {
    const user = await renderApp();
    await suggest(user, []);
    await user.click(screen.getByRole('button', { name: 'Start workout' }));
    await screen.findByTestId('set-form');

    await user.click(screen.getAllByRole('button', { name: /^About / })[0]);
    const dlg = await screen.findByRole('dialog');
    expect(within(dlg).getByTestId('exercise-guide')).toBeInTheDocument();
    expect(within(dlg).getByRole('button', { name: 'Close' })).toBeInTheDocument();
    await user.click(within(dlg).getByRole('button', { name: 'Close' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());

    await user.click(screen.getByRole('button', { name: 'Pause workout' }));
    expect(screen.getByText('Workout paused')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Complete set' })).toBeDisabled();
    await user.click(screen.getByRole('button', { name: 'Resume workout' }));
    expect(screen.getByRole('button', { name: 'Complete set' })).toBeEnabled();
  });

  it('keeps the info modal available while paused', async () => {
    const user = await renderApp();
    await suggest(user, []);
    await user.click(screen.getByRole('button', { name: 'Start workout' }));
    await screen.findByTestId('set-form');
    await user.click(screen.getByRole('button', { name: 'Pause workout' }));
    // user-event treats everything inside a disabled fieldset as disabled; browsers don't for non-controls
    fireEvent.click(screen.getAllByRole('button', { name: /^About / })[0]);
    const dlg = await screen.findByRole('dialog');
    expect(within(dlg).getByTestId('exercise-guide')).toBeInTheDocument();
    fireEvent.click(within(dlg).getByRole('button', { name: 'Close' }));
    expect(screen.getByRole('button', { name: 'Complete set' })).toBeDisabled();
  });
});

describe('custom workout builder', () => {
  const open = async () => {
    const user = await renderApp();
    await go(user, 'Workouts');
    await user.click(screen.getByRole('button', { name: 'Build custom workout' }));
    return user;
  };
  const addAs = async (user: User, type: string, name: string, group?: string) => {
    await user.click(screen.getByRole('button', { name: 'Add exercise' }));
    const dlg = await screen.findByRole('dialog');
    await user.click(within(dlg).getByRole('button', { name: type }));
    if (group) await user.selectOptions(within(dlg).getByLabelText('Add to group'), group);
    await user.clear(within(dlg).getByLabelText('Search exercises'));
    await user.type(within(dlg).getByLabelText('Search exercises'), name);
    await user.click(await within(dlg).findByRole('button', { name: new RegExp(`^${name}`) }));
  };

  it('offers a maximum time including no maximum, and shows the estimate', async () => {
    const user = await open();
    const select = screen.getByLabelText('Maximum time') as HTMLSelectElement;
    expect(select.value).toBe('45');
    expect(within(select).getByRole('option', { name: 'No maximum' })).toBeInTheDocument();
    await user.selectOptions(select, '');
    expect(screen.getByTestId('build-time')).toHaveTextContent('no maximum');
  });

  it('builds supersets and HIIT groups', async () => {
    const user = await open();
    await user.selectOptions(screen.getByLabelText('Maximum time'), '');
    await addAs(user, 'Supersets', 'Push-up');
    await addAs(user, 'Supersets', 'Bodyweight Squat', 'A');
    expect(screen.getByLabelText('Set type for Push-up')).toHaveValue('superset');
    expect(screen.getByLabelText('Group for Bodyweight Squat')).toHaveValue('A');
    expect(screen.queryByText(/need at least two exercises/)).toBeNull();
    await addAs(user, 'HIIT', 'Jump Squat');
    expect(screen.getByLabelText('Set type for Jump Squat')).toHaveValue('hiit');
    expect(screen.getByText(/need at least two exercises/)).toBeInTheDocument();
  });

  it('greys out exercises and set types that exceed the time limit', async () => {
    const user = await open();
    await user.selectOptions(screen.getByLabelText('Maximum time'), '15');
    await addAs(user, 'Regular sets', 'Push-up');
    await addAs(user, 'Regular sets', 'Bodyweight Squat');
    await user.click(screen.getByRole('button', { name: 'Add exercise' }));
    const dlg = await screen.findByRole('dialog');
    await user.click(within(dlg).getByRole('button', { name: 'HIIT' }));
    const items = within(dlg).getAllByRole('button').filter((b) => b.classList.contains('list-btn'));
    expect(items.length).toBeGreaterThan(0);
    for (let i = 0; i < 12; i++) {
      const btn = within(dlg).queryAllByRole('button').find((b) => b.classList.contains('list-btn') && !(b as HTMLButtonElement).disabled);
      if (!btn) break;
      await user.click(btn);
      await user.click(screen.getByRole('button', { name: 'Add exercise' }));
      await within(await screen.findByRole('dialog')).findAllByRole('button');
    }
    expect(screen.getByTestId('build-time').textContent).not.toMatch(/over the limit/);
  });
});
