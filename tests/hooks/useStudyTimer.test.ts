import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useStudyTimer } from '@/hooks/useStudyTimer';

beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

describe('useStudyTimer', () => {
  it('count-up accrues worked seconds and stops when paused', () => {
    const { result } = renderHook(() => useStudyTimer({ mode: 'count_up' }));
    act(() => { vi.advanceTimersByTime(90_000); });
    expect(result.current.elapsedMinutes).toBe(1);
    act(() => result.current.pause());
    act(() => { vi.advanceTimersByTime(60_000); });
    expect(result.current.elapsedMinutes).toBe(1); // paused → no accrual
  });

  it('pomodoro switches work → break and stops counting worked time on break', () => {
    const { result } = renderHook(() => useStudyTimer({ mode: 'pomodoro', pomodoro: { work_minutes: 1, break_minutes: 1, long_break_minutes: 2 } }));
    act(() => { vi.advanceTimersByTime(60_000); }); // finish 1 work minute
    expect(result.current.phase).toBe('break');
    const worked = result.current.elapsedSeconds;
    act(() => { vi.advanceTimersByTime(30_000); }); // during break
    expect(result.current.elapsedSeconds).toBe(worked); // break doesn't count as worked
  });

  it('restores from initialSeconds', () => {
    const { result } = renderHook(() => useStudyTimer({ mode: 'count_up', initialSeconds: 120 }));
    expect(result.current.elapsedMinutes).toBe(2);
  });
});
