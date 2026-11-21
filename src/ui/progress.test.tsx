import { screen, waitFor, within } from '@testing-library/react';
import { DEFAULT_SETTINGS, initDb, put, setSetting } from '../db/db';
import { DAY, session } from '../test/helpers';
import { renderApp } from '../test/ui';

it('links recovery and exercise details to their selected progress views', async () => {
  await initDb();
  await put('sessions', session('bench_press', [{ reps: 10, weightKg: 20 }], { at: Date.now() - DAY }));
  const user = await renderApp('/recovery');
  await user.click(screen.getAllByRole('button', { name: /^Chest\b.*recovered/ })[0]);
  await user.click(within(screen.getByLabelText('Chest stats')).getByRole('link', { name: 'View muscle progress' }));
  expect(screen.getByLabelText('Muscle')).toHaveValue('chest');
  expect(screen.getByText('1 set in range', { exact: false })).toBeInTheDocument();
  await user.click(screen.getByRole('link', { name: 'Barbell Bench Press' }));
  await user.click(screen.getByRole('link', { name: 'View exercise progress' }));
  expect(screen.getByLabelText('Exercise')).toHaveValue('bench_press');
  expect(screen.getByRole('list', { name: 'Exercise recorded values' })).toBeInTheDocument();
});

it('filters data and recalculates after a history edit and deletion', async () => {
  await initDb();
  await setSetting('settings', { ...DEFAULT_SETTINGS, units: 'kg' });
  await put('sessions', session('bench_press', [{ reps: 10, weightKg: 20 }], { at: Date.now() - DAY, id: 'recent' }));
  await put('sessions', session('bench_press', [{ reps: 8, weightKg: 10 }], { at: Date.now() - 40 * DAY, id: 'older', setType: 'superset' }));
  vi.spyOn(window, 'confirm').mockReturnValue(true);
  const user = await renderApp('/progress?view=exercise&exercise=bench_press');
  await user.selectOptions(screen.getByLabelText('Metric'), 'volume');
  expect(screen.getByRole('list', { name: 'Exercise recorded values' })).toHaveTextContent('200 kg');
  await user.selectOptions(screen.getByLabelText('Time range'), '4w');
  expect(within(screen.getByRole('list', { name: 'Exercise recorded values' })).getAllByRole('listitem')).toHaveLength(1);
  await user.selectOptions(screen.getByLabelText('Set type'), 'superset');
  expect(screen.getByText('No recorded values.')).toBeInTheDocument();
  await user.selectOptions(screen.getByLabelText('Time range'), 'all');
  expect(screen.getByRole('list', { name: 'Exercise recorded values' })).toHaveTextContent('80 kg');

  window.location.hash = '/history/recent';
  await user.click(await screen.findByRole('button', { name: 'Edit' }));
  const reps = screen.getByLabelText('Set 1 reps');
  await user.clear(reps);
  await user.type(reps, '5');
  await user.click(screen.getByRole('button', { name: 'Save' }));
  await waitFor(() => expect(screen.getByText(/Volume 100 kg/)).toBeInTheDocument());
  window.location.hash = '/progress?view=exercise&exercise=bench_press';
  await screen.findByRole('heading', { name: 'Progress' });
  await user.selectOptions(screen.getByLabelText('Metric'), 'volume');
  expect(screen.getByRole('list', { name: 'Exercise recorded values' })).toHaveTextContent('100 kg');
  window.location.hash = '/history/recent';
  await user.click(await screen.findByRole('button', { name: 'Delete workout' }));
  await screen.findByRole('heading', { name: 'History' });
  window.location.hash = '/progress?view=exercise&exercise=bench_press';
  await screen.findByRole('heading', { name: 'Progress' });
  await user.selectOptions(screen.getByLabelText('Metric'), 'volume');
  expect(screen.getByRole('list', { name: 'Exercise recorded values' })).not.toHaveTextContent('100 kg');
  vi.restoreAllMocks();
});
