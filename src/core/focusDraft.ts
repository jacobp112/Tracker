import type { SessionIntent, SessionScope, SessionPlan } from '@/domain/types';
import type { PomodoroConfig, TimerMode } from '@/hooks/useStudyTimer';

export const FOCUS_DRAFT_KEY = 'cairn-focus-session';
export interface FocusDraft {
  course_id: string; section_id: string; topic_id: string; topic_title: string;
  intent: SessionIntent; scope: SessionScope;
  timer_mode: TimerMode; pomodoro?: PomodoroConfig;
  created_at: string; elapsed_seconds: number; checked_error_ids: string[];
  plan?: SessionPlan;
}

export function loadFocusDraft(): FocusDraft | null {
  try {
    const raw = localStorage.getItem(FOCUS_DRAFT_KEY);
    return raw ? (JSON.parse(raw) as FocusDraft) : null;
  } catch { return null; }
}
export function saveFocusDraft(d: FocusDraft): void {
  try { localStorage.setItem(FOCUS_DRAFT_KEY, JSON.stringify(d)); } catch { /* quota — non-fatal */ }
}
export function clearFocusDraft(): void {
  try { localStorage.removeItem(FOCUS_DRAFT_KEY); } catch { /* non-fatal */ }
}
