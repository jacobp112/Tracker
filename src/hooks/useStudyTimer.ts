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
}

export function useStudyTimer(opts: {
  mode: TimerMode;
  pomodoro?: PomodoroConfig;
  initialSeconds?: number;
}): StudyTimer {
  const [elapsedSeconds, setElapsed] = useState(opts.initialSeconds ?? 0);
  const [phase, setPhase] = useState<'work' | 'break' | 'long_break'>('work');
  const [running, setRunning] = useState(true);
  const phaseSecRef = useRef(0);
  const cyclesRef = useRef(0);

  const workMinutes = opts.pomodoro?.work_minutes;
  const breakMinutes = opts.pomodoro?.break_minutes;
  const longBreakMinutes = opts.pomodoro?.long_break_minutes;

  useEffect(() => {
    if (!running) return;
    const id = setInterval(() => {
      setPhase((ph) => {
        if (ph === 'work') setElapsed((s) => s + 1);
        if (opts.mode === 'count_up') return ph;
        phaseSecRef.current += 1;
        const budgetMinutes =
          ph === 'work' ? workMinutes : ph === 'break' ? breakMinutes : longBreakMinutes;
        const budget = (budgetMinutes ?? 0) * 60;
        if (phaseSecRef.current >= budget) {
          phaseSecRef.current = 0;
          if (ph === 'work') {
            cyclesRef.current += 1;
            return cyclesRef.current % 4 === 0 ? 'long_break' : 'break';
          }
          return 'work';
        }
        return ph;
      });
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
  };
}
