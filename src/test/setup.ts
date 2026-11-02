import '@testing-library/jest-dom/vitest';
import 'fake-indexeddb/auto';
import { IDBFactory } from 'fake-indexeddb';
import { cleanup } from '@testing-library/react';
import { afterEach, beforeEach, vi } from 'vitest';
import { useEffect } from 'react';
import { closeDb } from '../db/db';

beforeEach(async () => {
  await closeDb();
  // fresh database per test
  (globalThis as any).indexedDB = new IDBFactory();
  window.location.hash = '';
});

afterEach(() => cleanup());

// Skip the real 3-second countdown (and audio) in UI tests; audio.test.tsx covers the real hook.
vi.mock('../ui/audio', async (orig) => ({
  ...(await orig<typeof import('../ui/audio')>()),
  useCountdown: (active: boolean, onComplete: () => void) => {
    useEffect(() => { if (active) onComplete(); }, [active]); // eslint-disable-line react-hooks/exhaustive-deps
    return null;
  },
}));
