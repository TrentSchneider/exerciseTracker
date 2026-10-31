import { useEffect } from 'react';
import type { Settings } from '../types';

export type ThemeChoice = NonNullable<Settings['theme']>;

const META_COLORS = { light: '#f2f2f7', dark: '#000000' };

/** Applies the chosen appearance to <html>; Auto removes the override so the system preference applies. */
export function applyTheme(choice: ThemeChoice | undefined, systemDark: boolean) {
  const root = document.documentElement;
  if (choice === 'light' || choice === 'dark') root.setAttribute('data-theme', choice);
  else root.removeAttribute('data-theme');
  const effective = choice === 'light' || choice === 'dark' ? choice : systemDark ? 'dark' : 'light';
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', META_COLORS[effective]);
}

export function useTheme(choice: ThemeChoice | undefined) {
  useEffect(() => {
    const mq = typeof window.matchMedia === 'function' ? window.matchMedia('(prefers-color-scheme: dark)') : null;
    const run = () => applyTheme(choice, !!mq?.matches);
    run();
    mq?.addEventListener?.('change', run);
    return () => mq?.removeEventListener?.('change', run);
  }, [choice]);
}
