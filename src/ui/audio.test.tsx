import { act, renderHook } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

const real = await vi.importActual<typeof import('./audio')>('./audio');

describe('useCountdown', () => {
  afterEach(() => vi.useRealTimers());

  it('counts 3, 2, 1 then completes', () => {
    vi.useFakeTimers();
    const done = vi.fn();
    const { result } = renderHook(() => real.useCountdown(true, done));
    expect(result.current).toBe(3);
    act(() => { vi.advanceTimersByTime(1000); });
    expect(result.current).toBe(2);
    act(() => { vi.advanceTimersByTime(1000); });
    expect(result.current).toBe(1);
    expect(done).not.toHaveBeenCalled();
    act(() => { vi.advanceTimersByTime(1000); });
    expect(result.current).toBeNull();
    expect(done).toHaveBeenCalledTimes(1);
  });
});
