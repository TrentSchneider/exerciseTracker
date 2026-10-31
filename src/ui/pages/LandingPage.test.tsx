import { screen } from '@testing-library/react';
import { renderApp } from '../../test/ui';

describe('landing page', () => {
  it('presents the main value, benefits, steps, privacy note, and app actions', async () => {
    const user = await renderApp('/');

    expect(await screen.findByRole('heading', { name: 'Your training, your equipment, your progress.' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'A better fit for every workout' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'How it works' })).toBeInTheDocument();
    expect(screen.getByText(/Your workouts stay on this device/)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Start a workout' })).toHaveAttribute('href', '#/workouts');
    expect(screen.getByRole('link', { name: 'Build a custom workout' })).toHaveAttribute('href', '#/build');
    expect(screen.getByRole('link', { name: 'Set up your equipment' })).toHaveAttribute('href', '#/equipment');

    await user.click(screen.getByRole('link', { name: 'Recovery' }));
    expect(await screen.findByRole('heading', { name: 'Muscle recovery' })).toBeInTheDocument();
  });
});
