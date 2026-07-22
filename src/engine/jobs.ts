import type { JobApplication, JobStage, Store } from '@/domain/types';
import { currentStage } from '@/domain/types';

/**
 * Job-application derivations. Everything derives from `stage_history` — the
 * append-only spine — so the board, time-in-stage and funnel can't disagree
 * with the history that explains them.
 */

/** Pipeline columns, in board order. Terminal states render separately. */
export const PIPELINE_STAGES: JobStage[] = ['saved', 'applied', 'screen', 'interview', 'offer'];

export const TERMINAL_STAGES: JobStage[] = ['accepted', 'rejected'];

export const STAGE_LABEL: Record<JobStage, string> = {
  saved: 'Saved',
  applied: 'Applied',
  screen: 'Screen',
  interview: 'Interview',
  offer: 'Offer',
  rejected: 'Rejected',
  accepted: 'Accepted',
};

/** Stages an application can legally move to from where it is now. Any
 *  pipeline stage can jump to a terminal one; terminal stages can reopen
 *  (a rejection reversed, an offer un-accepted) back into the pipeline. */
export function nextStages(stage: JobStage): JobStage[] {
  const all: JobStage[] = [...PIPELINE_STAGES, ...TERMINAL_STAGES];
  return all.filter((s) => s !== stage);
}

/** Whole days the application has sat in its current stage. */
export function daysInStage(app: JobApplication, now = new Date()): number {
  const last = app.stage_history[app.stage_history.length - 1];
  if (!last) return 0;
  return Math.max(0, Math.floor((now.getTime() - new Date(last.date).getTime()) / 86_400_000));
}

export interface BoardColumn {
  stage: JobStage;
  applications: JobApplication[];
}

/**
 * Active (non-archived) applications grouped into pipeline columns, newest
 * stage-move first within each column. Terminal-stage applications are
 * excluded — they live in the closed list, not on the board.
 */
export function boardColumns(store: Store): BoardColumn[] {
  const columns = PIPELINE_STAGES.map((stage) => ({ stage, applications: [] as JobApplication[] }));
  const byStage = new Map(columns.map((c) => [c.stage, c]));

  for (const app of store.applications) {
    if (app.archived) continue;
    byStage.get(currentStage(app))?.applications.push(app);
  }

  for (const col of columns) {
    col.applications.sort((a, b) => {
      const ad = a.stage_history[a.stage_history.length - 1]?.date ?? a.created_at;
      const bd = b.stage_history[b.stage_history.length - 1]?.date ?? b.created_at;
      return bd.localeCompare(ad);
    });
  }
  return columns;
}

/** Non-archived applications in a terminal stage, most recent first. */
export function closedApplications(store: Store): JobApplication[] {
  return store.applications
    .filter((a) => !a.archived && TERMINAL_STAGES.includes(currentStage(a)))
    .sort((a, b) => {
      const ad = a.stage_history[a.stage_history.length - 1]?.date ?? a.created_at;
      const bd = b.stage_history[b.stage_history.length - 1]?.date ?? b.created_at;
      return bd.localeCompare(ad);
    });
}

export interface FunnelStats {
  active: number;
  applied: number;
  /** Reached screen or beyond, as a share of those that applied (0–100). */
  responseRate: number | null;
  /** Reached interview or beyond, as a share of those that applied (0–100). */
  interviewRate: number | null;
  offers: number;
}

const STAGE_ORDER: Record<JobStage, number> = {
  saved: 0,
  applied: 1,
  screen: 2,
  interview: 3,
  offer: 4,
  accepted: 5,
  rejected: -1, // rejection isn't progress; furthest-reached uses history
};

/** The furthest pipeline stage this application has ever reached. */
export function furthestStage(app: JobApplication): JobStage {
  let best: JobStage = 'saved';
  for (const e of app.stage_history) {
    if (STAGE_ORDER[e.stage] > STAGE_ORDER[best]) best = e.stage;
  }
  return best;
}

/**
 * Funnel across ALL applications (archived included — archiving is tidying,
 * not erasing history; excluding them would quietly inflate the rates).
 */
export function funnelStats(store: Store): FunnelStats {
  const apps = store.applications;
  const reached = (min: number) => apps.filter((a) => STAGE_ORDER[furthestStage(a)] >= min).length;

  const applied = reached(STAGE_ORDER.applied);
  const screened = reached(STAGE_ORDER.screen);
  const interviewed = reached(STAGE_ORDER.interview);
  const offers = reached(STAGE_ORDER.offer);
  const active = apps.filter(
    (a) => !a.archived && !TERMINAL_STAGES.includes(currentStage(a)),
  ).length;

  return {
    active,
    applied,
    responseRate: applied === 0 ? null : Math.round((screened / applied) * 100),
    interviewRate: applied === 0 ? null : Math.round((interviewed / applied) * 100),
    offers,
  };
}

/** Applications with a next_action_date, soonest first — overdue included. */
export function upcomingActions(store: Store): JobApplication[] {
  return store.applications
    .filter((a) => !a.archived && a.next_action_date && !TERMINAL_STAGES.includes(currentStage(a)))
    .sort((a, b) => a.next_action_date!.localeCompare(b.next_action_date!));
}
