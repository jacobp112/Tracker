import { useEffect, useRef, useState } from 'react';

export interface PomodoroConfig {
  work_minutes: number;
  break_minutes: number;
  long_break_minutes: number;
}

export type TimerMode = 'count_up' | 'pomodoro';

export interface StudyTimer {
  elapsedSeconds: number; // total worked seconds (excludes break time)
  elapsedMinutes: number; // Math.floor(elapsedSeconds / 60)
  phase: 'work' | 'break' | 'long_break';
  running: boolean;
  pause(): void;
  resume(): void;
  // The same worked-seconds count as elapsedSeconds, mutated in the same tick
  // that calls setElapsed — a synchronous read for callers (e.g. FocusMode's
  // "End session") that need the authoritative value the instant they're
  // invoked, without waiting on a React re-render to land first.
  elapsedSecondsRef: { current: number };
}

export function useStudyTimer(opts: {
  mode: TimerMode;
  pomodoro?: PomodoroConfig;
  initialSeconds?: number;
}): StudyTimer {
  const [elapsedSeconds, setElapsed] = useState(opts.initialSeconds ?? 0);
  const [phase, setPhase] = useState<'work' | 'break' | 'long_break'>('work');
  const [running, setRunning] = useState(true);
  const phaseRef = useRef<'work' | 'break' | 'long_break'>('work');
  const phaseSecRef = useRef(0);
  const cyclesRef = useRef(0);
  const elapsedRef = useRef(opts.initialSeconds ?? 0);

  const workMinutes = opts.pomodoro?.work_minutes;
  const breakMinutes = opts.pomodoro?.break_minutes;
  const longBreakMinutes = opts.pomodoro?.long_break_minutes;

  useEffect(() => {
    if (!running) return;
    const id = setInterval(() => {
      // Two independent, side-effect-free state updates per tick — no
      // side effects (setElapsed calls, ref mutations) may live inside a
      // setState updater, since StrictMode double-invokes updaters in dev.
      if (phaseRef.current === 'work') {
        elapsedRef.current += 1;
        setElapsed((s) => s + 1);
      }
      if (opts.mode === 'count_up') return;
      phaseSecRef.current += 1;
      const cur = phaseRef.current;
      const budgetMinutes =
        cur === 'work' ? workMinutes : cur === 'break' ? breakMinutes : longBreakMinutes;
      const budget = (budgetMinutes ?? 0) * 60;
      if (phaseSecRef.current >= budget) {
        phaseSecRef.current = 0;
        const next: 'work' | 'break' | 'long_break' =
          cur === 'work' ? (++cyclesRef.current % 4 === 0 ? 'long_break' : 'break') : 'work';
        phaseRef.current = next;
        setPhase(next);
      }
    }, 1000);
    return () => clearInterval(id);
  }, [running, opts.mode, workMinutes, breakMinutes, longBreakMinutes]);

  return {
    elapsedSeconds,
    elapsedMinutes: Math.floor(elapsedSeconds / 60),
    phase,
    running,
    pause: () => setRunning(false),
    resume: () => setRunning(true),
    elapsedSecondsRef: elapsedRef,
  };
}
