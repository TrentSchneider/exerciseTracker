import { screen, waitFor, within } from '@testing-library/react';
import { renderApp } from '../../test/ui';
import { getSetting } from '../../db/db';

describe('home dashboard', () => {
  it('shows dashboard cards and a welcome card that can be dismissed, persisted, and restored', async () => {
    const user = await renderApp('/');
    expect(await screen.findByRole('heading', { name: 'Dashboard' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: "Today's workouts" })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Start a workout' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Recovery' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Build a custom workout' })).toHaveAttribute('href', '#/build');
    expect(screen.getByText('A workout tracker that adapts to you')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Getting Started' }));
    const dialog = screen.getByRole('dialog', { name: 'Getting Started' });
    expect(within(dialog).getByRole('heading', { name: 'How it works' })).toBeInTheDocument();
    expect(within(dialog).getByText(/Your workouts stay on this device/)).toBeInTheDocument();
    await user.click(within(dialog).getByRole('button', { name: 'Close' }));

    await user.click(screen.getByRole('button', { name: 'Close welcome card' }));
    expect(screen.queryByText('A workout tracker that adapts to you')).not.toBeInTheDocument();
    await waitFor(async () => expect((await getSetting<any>('settings', {})).welcomeDismissed).toBe(true));

    await user.click(screen.getByRole('link', { name: 'Settings' }));
    await user.click(await screen.findByRole('checkbox', { name: /Show the welcome card/ }));
    await user.click(screen.getByRole('link', { name: 'Home' }));
    expect(await screen.findByText('A workout tracker that adapts to you')).toBeInTheDocument();
  });

  it('keeps the recovery map on its own page', async () => {
    const user = await renderApp('/');
    await user.click(await screen.findByRole('link', { name: 'Recovery' }));
    expect(await screen.findByRole('heading', { name: 'Muscle recovery' })).toBeInTheDocument();
  });
});
