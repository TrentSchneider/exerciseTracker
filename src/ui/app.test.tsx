import { screen, waitFor, within } from '@testing-library/react';
import { getAll, initDb, put, getSetting } from '../db/db';
import { exportData } from '../db/exportImport';
import { DAY, session } from '../test/helpers';
import { go, ownEquipment, renderApp } from '../test/ui';
import type { Equipment, Session } from '../types';
import { displayToKg } from '../domain/units';

beforeEach(() => {
  vi.spyOn(window, 'confirm').mockReturnValue(true);
});
afterEach(() => vi.restoreAllMocks());

const clickChip = async (user: Awaited<ReturnType<typeof renderApp>>, name: string) =>
  user.click(screen.getByRole('button', { name, pressed: false }));

async function runWorkout(user: Awaited<ReturnType<typeof renderApp>>, maxSets = 40) {
  for (let i = 0; i < maxSets; i++) {
    const complete = screen.queryByRole('button', { name: 'Complete set' });
    if (!complete) break;
    await user.click(complete);
    const skipRest = screen.queryByRole('button', { name: 'Skip rest' });
    if (skipRest) await user.click(skipRest);
  }
}

describe('recovery dashboard', () => {
  it('shows all muscles fully recovered with no history, and details on click', async () => {
    const user = await renderApp();
    expect(screen.getByRole('heading', { name: 'Muscle recovery' })).toBeInTheDocument();
    expect(screen.getByRole('group', { name: 'Front muscle diagram' })).toBeInTheDocument();
    await user.click(document.querySelector('[data-muscle="chest"]')!);
    const panel = await screen.findByLabelText('Chest stats');
    expect(within(panel).getByText('100%', { selector: 'dd' })).toBeInTheDocument();
    expect(within(panel).getByText('Never')).toBeInTheDocument();
  });

  it('reflects past workouts as fatigue and lets you open a muscle from the list', async () => {
    await initDb();
    await put('sessions', session('bench_press', [{ effort: 9 }, { effort: 9 }, { effort: 9 }, { effort: 9 }], { at: Date.now() - 3_600_000 }));
    const user = await renderApp();
    await user.click(await screen.findByRole('button', { name: /^Chest\b.*recovered/ }).catch(() => document.querySelector('[data-muscle="chest"]') as Element));
    const panel = await screen.findByLabelText('Chest stats');
    const recovery = within(panel).getAllByText(/%$/, { selector: 'dd' })[0].textContent!;
    expect(parseInt(recovery)).toBeLessThan(60);
    expect(within(panel).getByText(/4 regular/)).toBeInTheDocument();
    expect(within(panel).getByRole('link', { name: 'Barbell Bench Press' })).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Close muscle stats' }));
    expect(screen.getAllByRole('button', { name: /Chest/ }).length).toBeGreaterThan(0);
  });
});

describe('equipment', () => {
  it('registers equipment and persists it in IndexedDB', async () => {
    const user = await renderApp();
    await ownEquipment(user, ['Dumbbells']);
    await waitFor(async () => {
      const eq = (await getAll<Equipment>('equipment')).find((e) => e.id === 'dumbbell');
      expect(eq?.owned).toBe(true);
    });
    await user.type(screen.getByLabelText('New equipment name'), 'Sandbag');
    await user.click(screen.getByRole('button', { name: 'Add' }));
    expect(await screen.findByText(/Sandbag \(custom\)/)).toBeInTheDocument();
    expect((await getAll<Equipment>('equipment')).some((e) => e.name === 'Sandbag')).toBe(true);

    const dumbbellRow = screen.getByRole('checkbox', { name: /Dumbbells/ }).closest('li')!;
    await user.click(within(dumbbellRow).getByText('Available weights (optional)'));
    const weights = within(dumbbellRow).getByLabelText('Dumbbells available weights');
    await user.type(weights, '5, 10, 15');
    await user.click(within(dumbbellRow).getByRole('button', { name: 'Save weights' }));
    await waitFor(async () => {
      const dumbbells = (await getAll<Equipment>('equipment')).find((e) => e.id === 'dumbbell');
      expect(dumbbells?.weightOptionsKg).toEqual([5, 10, 15].map((value) => displayToKg(value, 'lb')));
    });

    await user.clear(weights);
    await user.type(weights, 'not a weight');
    await user.click(within(dumbbellRow).getByRole('button', { name: 'Save weights' }));
    expect(await within(dumbbellRow).findByRole('alert')).toHaveTextContent(/positive weights/);
    expect((await getAll<Equipment>('equipment')).find((e) => e.id === 'dumbbell')?.weightOptionsKg)
      .toEqual([5, 10, 15].map((value) => displayToKg(value, 'lb')));
  });
});

describe('suggest → preview → workout → history', () => {
  it('runs the full flow including swap, adjust, skip and recovery update', async () => {
    const user = await renderApp();
    await ownEquipment(user, ['Dumbbells', 'Bench', 'Barbell & Plates', 'Cable']);

    await go(user, 'Workouts');
    await user.click(screen.getByRole('link', { name: 'Suggest a workout' }));
    await clickChip(user, 'Chest');
    await user.click(screen.getByRole('button', { name: 'Suggest workout' }));

    // preview
    expect(await screen.findByRole('heading', { name: 'Workout overview' })).toBeInTheDocument();
    const editButtons = screen.getAllByRole('button', { name: /^Edit / });
    expect(editButtons.length).toBeGreaterThan(1);
    expect(screen.getAllByText('Regular sets').length).toBeGreaterThan(0);
    expect(screen.getAllByText(/× \d+ reps/).length).toBeGreaterThan(0);

    // adjust first exercise
    await user.click(editButtons[0]);
    const dlg = await screen.findByRole('dialog');
    const reps = within(dlg).getByLabelText('Reps');
    await user.tripleClick(reps);
    await user.keyboard('15');
    await user.click(within(dlg).getByRole('button', { name: 'Apply' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    expect(screen.getAllByText('3 × 15 reps').length).toBeGreaterThan(0);

    // swap second exercise
    const before = screen.getAllByRole('button', { name: /^Edit / }).map((b) => b.getAttribute('aria-label'));
    await user.click(screen.getAllByRole('button', { name: /^Edit / })[1]);
    const dlg2 = await screen.findByRole('dialog');
    const cands = within(dlg2).getByRole('list', { name: 'Swap candidates' });
    const first = within(cands).getAllByRole('button')[0];
    const newName = within(first).getByText(/./, { selector: 'strong' }).textContent!;
    await user.click(first);
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    const after = screen.getAllByRole('button', { name: /^Edit / }).map((b) => b.getAttribute('aria-label'));
    expect(after[1]).toBe(`Edit ${newName}`);
    expect(after[1]).not.toBe(before[1]);

    // save + start
    await user.click(screen.getByRole('button', { name: 'Save workout' }));
    expect(await screen.findByText('Workout saved.')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Start workout' }));
    expect(await screen.findByTestId('set-form')).toBeInTheDocument();

    // log a first set, skip the second exercise, finish the rest
    await user.click(screen.getByRole('button', { name: 'Complete set' }));
    expect(await screen.findByRole('timer', { name: 'Rest' })).toBeInTheDocument(); // rest timer between sets
    await user.click(screen.getByRole('button', { name: 'Skip rest' }));
    const skippedName = after[1]!.replace('Edit ', '');
    await user.click(screen.getByRole('button', { name: `Skip ${skippedName}` }));
    await runWorkout(user);
    await user.click(screen.getByRole('button', { name: 'Finish workout' }));

    // history summary
    expect(await screen.findByText('Skipped', {}, { timeout: 5000 })).toBeInTheDocument();
    const sessions = await getAll<Session>('sessions');
    expect(sessions).toHaveLength(1);
    const skippedEx = sessions[0].exercises.find((e) => e.skipped)!;
    expect(skippedEx.sets).toHaveLength(0);
    expect(sessions[0].exercises.filter((e) => !e.skipped).length).toBeGreaterThan(0);
    expect(await getSetting('activeSession', null)).toBeNull();

    // history search
    await go(user, 'History');
    expect(await screen.findByText(/Targeted workout/)).toBeInTheDocument();
    await user.type(screen.getByLabelText('Search history'), 'zzzz-nothing');
    expect(screen.getByText('No workouts match your search.')).toBeInTheDocument();
    await user.clear(screen.getByLabelText('Search history'));
    await user.type(screen.getByLabelText('Search history'), 'targeted');
    expect(screen.getByText(/Targeted workout/)).toBeInTheDocument();

    // recovery reflects the workout
    await go(user, 'Recovery');
    await user.click(document.querySelector('[data-muscle="chest"]')!);
    const panel = await screen.findByLabelText('Chest stats');
    expect(within(panel).queryByText('Never')).toBeNull();
  });

  it('survives a reload with a workout in progress', async () => {
    const user = await renderApp();
    await go(user, 'Workouts');
    await user.click(screen.getByRole('link', { name: 'Suggest a workout' }));
    await user.click(screen.getByRole('button', { name: 'Suggest workout' }));
    await user.click(await screen.findByRole('button', { name: 'Start workout' }));
    await user.click(await screen.findByRole('button', { name: 'Complete set' }));
    await waitFor(async () => expect(await getSetting('activeSession', null)).not.toBeNull());
    document.body.innerHTML = '';
    window.location.hash = '';
    const user2 = await renderApp();
    expect(await screen.findByText(/Workout in progress/)).toBeInTheDocument();
    await user2.click(screen.getByRole('link', { name: 'Resume' }));
    expect(await screen.findByText(/1 of \d+ sets complete/)).toBeInTheDocument();
  });

  it('discarding a workout saves nothing', async () => {
    const user = await renderApp();
    await go(user, 'Workouts');
    await user.click(screen.getByRole('link', { name: 'Suggest a workout' }));
    await user.click(screen.getByRole('button', { name: 'Suggest workout' }));
    await user.click(await screen.findByRole('button', { name: 'Start workout' }));
    await user.click(await screen.findByRole('button', { name: 'Complete set' }));
    await user.click(screen.getByRole('button', { name: 'Skip rest' }));
    await user.click(screen.getByRole('button', { name: 'Discard' }));
    expect(await getAll('sessions')).toHaveLength(0);
  });

  it('timed exercises show an editable exercise timer', async () => {
    await initDb();
    const user = await renderApp();
    await go(user, 'Workouts');
    await user.click(screen.getByRole('button', { name: 'Build custom workout' }));
    await user.click(screen.getByRole('button', { name: 'Add exercise' }));
    await user.type(screen.getByLabelText('Search exercises'), 'Plank');
    await user.click(await screen.findByRole('button', { name: /^Plank/ }));
    await user.click(screen.getByRole('button', { name: 'Review workout' }));
    await user.click(await screen.findByRole('button', { name: 'Start workout' }));
    const timer = await screen.findByRole('timer', { name: 'Exercise timer' });
    expect(within(timer).getByLabelText('Duration in seconds')).toHaveValue(45);
    await user.click(within(timer).getByRole('button', { name: 'Add 15 seconds' }));
    expect(within(timer).getByLabelText('Duration in seconds')).toHaveValue(60);
  });
});

describe('history', () => {
  it('lists, searches by exercise and opens a summary with set stats', async () => {
    await initDb();
    await put('sessions', session('bench_press', [{ reps: 5, weightKg: 60, effort: 8 }, { reps: 4, weightKg: 62.5, effort: 9 }], { at: Date.now() - DAY, id: 's1' }));
    await put('sessions', { ...session('squat', [{ reps: 5, weightKg: 80 }], { at: Date.now() - 2 * DAY, id: 's2' }), name: 'Leg day' });
    const user = await renderApp('/history');
    expect(await screen.findByText('Leg day')).toBeInTheDocument();
    await user.type(screen.getByLabelText('Search history'), 'bench');
    expect(screen.queryByText('Leg day')).toBeNull();
    await user.click(screen.getByRole('link', { name: /Test workout/ }));
    expect(await screen.findByRole('link', { name: 'Barbell Bench Press' })).toBeInTheDocument();
    expect(screen.getByText('4')).toBeInTheDocument(); // reps of set 2
    expect(screen.getByText(/Top weight/)).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Delete workout' }));
    await waitFor(async () => expect(await getAll('sessions')).toHaveLength(1));
  });
});

describe('settings', () => {
  it('switches units and persists them', async () => {
    const user = await renderApp('/settings');
    await user.selectOptions(await screen.findByLabelText('Weight units'), 'kg');
    await waitFor(async () => expect((await getSetting<any>('settings', {})).units).toBe('kg'));
  });

  it('shows body weight in the selected unit without changing the stored value', async () => {
    const user = await renderApp('/settings');
    const field = (await screen.findByLabelText(/Body weight/)) as HTMLInputElement;
    expect(field.value).toBe('165.3');
    await user.selectOptions(screen.getByLabelText('Weight units'), 'kg');
    await waitFor(() => expect((screen.getByLabelText(/Body weight/) as HTMLInputElement).value).toBe('75'));
    await user.selectOptions(screen.getByLabelText('Weight units'), 'lb');
    await waitFor(() => expect((screen.getByLabelText(/Body weight/) as HTMLInputElement).value).toBe('165.3'));
    await user.tripleClick(screen.getByLabelText(/Body weight/));
    await user.keyboard('180');
    await waitFor(async () => expect((await getSetting<any>('settings', {})).bodyweightKg).toBeCloseTo(81.65, 1));
  });

  it('exports data as a download', async () => {
    const createUrl = vi.fn(() => 'blob:x');
    (URL as any).createObjectURL = createUrl;
    (URL as any).revokeObjectURL = vi.fn();
    const click = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});
    const user = await renderApp('/settings');
    await user.click(await screen.findByRole('button', { name: 'Export data' }));
    expect(createUrl).toHaveBeenCalled();
    expect(click).toHaveBeenCalled();
    expect(await screen.findByText('Export downloaded.')).toBeInTheDocument();
  });

  async function importFile(user: Awaited<ReturnType<typeof renderApp>>, content: string) {
    const file = new File([content], 'backup.json', { type: 'application/json' });
    (file as any).text = async () => content;
    await user.upload(screen.getByLabelText('Import file'), file);
  }

  it('warns before overwriting and requires confirmation', async () => {
    await initDb();
    await put('workouts', { id: 'w1', name: 'Original', items: [], createdAt: 1 });
    const backup = await exportData();
    backup.data.workouts = [{ id: 'w1', name: 'From backup', items: [], createdAt: 1 }] as any;
    const user = await renderApp('/settings');
    await importFile(user, JSON.stringify(backup));

    const dlg = await screen.findByRole('dialog', { name: 'Import data' });
    expect(within(dlg).getByRole('alert')).toHaveTextContent(/2 existing records.*overwritten/);
    const confirm = within(dlg).getByRole('checkbox', { name: /understand/ });
    const importBtn = within(dlg).getByRole('button', { name: 'Import' });
    expect(importBtn).toBeDisabled();
    await user.click(confirm);
    expect(importBtn).toBeEnabled();

    await user.click(within(dlg).getByRole('radio', { name: /Replace everything/ }));
    expect(within(dlg).getByRole('alert')).toHaveTextContent(/permanently deletes/);
    expect(within(dlg).getByRole('button', { name: 'Import' })).toBeDisabled(); // must re-confirm
    await user.click(within(dlg).getByRole('checkbox', { name: /understand/ }));
    await user.click(within(dlg).getByRole('button', { name: 'Import' }));
    expect(await screen.findByText(/Import complete/)).toBeInTheDocument();
    expect((await getAll<any>('workouts'))[0].name).toBe('From backup');
  });

  it('rejects invalid import files with a message', async () => {
    const user = await renderApp('/settings');
    await importFile(user, '{"hello": 1}');
    expect(await screen.findByRole('alert')).toHaveTextContent(/not a Workout Tracker export/);
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('shows no warning when nothing will be overwritten', async () => {
    const user = await renderApp('/settings');
    const backup = await exportData();
    backup.data.settings = null;
    backup.data.workouts = [{ id: 'fresh', name: 'Fresh', items: [], createdAt: 1 }] as any;
    await importFile(user, JSON.stringify(backup));
    const dlg = await screen.findByRole('dialog', { name: 'Import data' });
    expect(within(dlg).getByText('No existing records will be overwritten.')).toBeInTheDocument();
    expect(within(dlg).getByRole('button', { name: 'Import' })).toBeEnabled();
  });
});

describe('planner views', () => {
  it('saves the calendar view and lets a date be picked', async () => {
    const user = await renderApp('/plan');
    expect(await screen.findByRole('list', { name: 'Agenda' })).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Calendar' }));
    expect(await screen.findByTestId('calendar')).toBeInTheDocument();
    expect(screen.queryByRole('list', { name: 'Agenda' })).toBeNull();
    await waitFor(async () => expect((await getSetting<any>('settings', {})).plannerView).toBe('calendar'));
    const cells = screen.getAllByRole('gridcell').filter((c) => c.tagName === 'BUTTON');
    await user.click(cells[0]);
    expect(within(screen.getByTestId('calendar-day')).getByText(/No workouts planned/)).toBeInTheDocument();
  });

  it('edits recurrence in the routine editor', async () => {
    const user = await renderApp('/plan');
    await user.click(await screen.findByRole('button', { name: /New routine/i }));
    const rec = await screen.findByTestId('recurrence');
    await user.selectOptions(within(rec).getByLabelText('Repeats'), 'daily');
    const end = within(rec).getByLabelText('End date');
    expect(end).toBeDisabled();
    await user.click(within(rec).getByLabelText('No end date'));
    expect(end).toBeEnabled();
  });
});

describe('exercise active flag', () => {
  it('toggles active, persists it, and filters the list', async () => {
    const user = await renderApp('/exercises');
    const box = await screen.findByRole('checkbox', { name: 'Active: Push-up' });
    expect(box).toBeChecked();
    await user.click(box);
    await waitFor(async () => expect((await getAll<any>('exercises')).find((e) => e.name === 'Push-up').inactive).toBe(true));
    await user.selectOptions(screen.getByLabelText('Filter by status'), 'inactive');
    expect(screen.getByRole('checkbox', { name: 'Active: Push-up' })).not.toBeChecked();
    expect(screen.queryByRole('checkbox', { name: 'Active: Squat' })).toBeNull();
    await user.selectOptions(screen.getByLabelText('Filter by status'), 'active');
    expect(screen.queryByRole('checkbox', { name: 'Active: Push-up' })).toBeNull();
  });
});

describe('appearance setting', () => {
  it('defaults to automatic, applies and persists light/dark', async () => {
    const user = await renderApp('/settings');
    const radio = (n: string) => screen.findByRole('radio', { name: n });
    expect(await radio('Automatic')).toHaveAttribute('aria-checked', 'true');
    expect(document.documentElement.hasAttribute('data-theme')).toBe(false);
    await user.click(await radio('Dark'));
    await waitFor(() => expect(document.documentElement.getAttribute('data-theme')).toBe('dark'));
    await waitFor(async () => expect((await getSetting<any>('settings', {})).theme).toBe('dark'));
    await user.click(await radio('Light'));
    await waitFor(() => expect(document.documentElement.getAttribute('data-theme')).toBe('light'));
    await user.click(await radio('Automatic'));
    await waitFor(() => expect(document.documentElement.hasAttribute('data-theme')).toBe(false));
  });
});
