import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { App } from '../App';
import { getAll, getSetting } from '../db/db';

export async function renderApp(route = '/recovery') {
  window.location.hash = route;
  const user = userEvent.setup();
  render(<App />);
  await screen.findByRole('navigation', { name: 'Main' });
  return user;
}

export async function go(user: ReturnType<typeof userEvent.setup>, name: string) {
  await user.click(within_nav(name));
}

function within_nav(name: string) {
  return within(screen.getByRole('navigation', { name: 'Main' })).getByRole('link', { name: new RegExp(name, 'i') });
}

export async function ownEquipment(user: ReturnType<typeof userEvent.setup>, names: string[]) {
  await go(user, 'Equipment');
  for (const n of names) await user.click(await screen.findByRole('checkbox', { name: new RegExp(n, 'i') }));
}

export { getAll, getSetting, waitFor };
