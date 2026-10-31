import '@testing-library/jest-dom/vitest';
import 'fake-indexeddb/auto';
import { IDBFactory } from 'fake-indexeddb';
import { cleanup } from '@testing-library/react';
import { afterEach, beforeEach } from 'vitest';
import { closeDb } from '../db/db';

beforeEach(async () => {
  await closeDb();
  // fresh database per test
  (globalThis as any).indexedDB = new IDBFactory();
  window.location.hash = '';
});

afterEach(() => cleanup());
