import type { RunningActivity, Store } from '@/domain/types';

/**
 * Fitness derivations — Document 3 §5.5, Document 4 E6.
 * Fitness has no decay model (Document 2) — these are progression trends only.
 */

export type RunType = RunningActivity['type'];

export const RUN_TYPES: RunType[] = ['easy', 'tempo', 'long', 'interval', 'race'];

export interface RunPoint {
  date: string;
  paceSecPerKm: number;
  distanceKm: number;
  type: RunType;
}

/** Runs oldest→newest, optionally filtered by type. Pace means different
 *  things per type, so the trend line can be filtered (Document 1 §5.1). */
export function runSeries(store: Store, type?: RunType): RunPoint[] {
  return store.runs
    .filter((r) => (type ? r.type === type : true))
    .slice()
    .sort((a, b) => a.date.localeCompare(b.date))
    .map((r) => ({
      date: r.date,
      paceSecPerKm: r.pace_sec_per_km,
      distanceKm: r.distance_km,
      type: r.type,
    }));
}

/** `mm:ss` from seconds-per-km. */
export function formatPace(secPerKm: number): string {
  const s = Math.round(secPerKm);
  const m = Math.floor(s / 60);
  const rem = s % 60;
  return `${m}:${String(rem).padStart(2, '0')}`;
}

/* ── Lifting ─────────────────────────────────────────────────────── */

export interface LiftPoint {
  date: string;
  /** Heaviest single set that day. */
  topSetKg: number;
  /** Estimated 1RM from the top set (Epley). */
  est1RmKg: number;
}

/**
 * Estimated one-rep max — Epley: `w × (1 + reps/30)`.
 *
 * Document 1 §5.2 requires per-set data precisely so the chart can plot top-set
 * or estimated-1RM rather than a flat total. A 5×100 and a 1×120 are different
 * stories; the flat total would hide that.
 */
export function epley1Rm(weightKg: number, reps: number): number {
  return weightKg * (1 + reps / 30);
}

/** Canonical exercise names present in the log, in first-seen order. */
export function exerciseNames(store: Store): string[] {
  const seen: string[] = [];
  for (const session of store.lifts) {
    for (const ex of session.exercises) {
      // Fuzzy-match client-side (Document 1 §5.2): trim + case-fold for grouping.
      const canonical = canonicalName(ex.exercise_name);
      if (!seen.some((n) => canonicalName(n) === canonical)) seen.push(ex.exercise_name);
    }
  }
  return seen;
}

function canonicalName(name: string): string {
  return name.trim().toLowerCase();
}

/**
 * Per-exercise progression: for each session that trained the exercise, the
 * day's heaviest set and its estimated 1RM (Document 3 §5.5).
 */
export function liftSeries(store: Store, exerciseName: string): LiftPoint[] {
  const target = canonicalName(exerciseName);
  const points: LiftPoint[] = [];

  for (const session of store.lifts) {
    const sets = session.exercises
      .filter((e) => canonicalName(e.exercise_name) === target)
      .flatMap((e) => e.sets);
    if (sets.length === 0) continue;

    const topSet = sets.reduce((best, s) => (s.weight_kg > best.weight_kg ? s : best));
    const est1Rm = sets.reduce((max, s) => Math.max(max, epley1Rm(s.weight_kg, s.reps)), 0);

    points.push({
      date: session.date,
      topSetKg: topSet.weight_kg,
      est1RmKg: Math.round(est1Rm * 10) / 10,
    });
  }

  return points.sort((a, b) => a.date.localeCompare(b.date));
}

/* ── Units — Document 3 §5.5, storage stays kg ───────────────────── */

const KG_PER_LB = 0.45359237;

export function kgToLb(kg: number): number {
  return kg / KG_PER_LB;
}

export function displayWeight(kg: number, unit: 'kg' | 'lb'): string {
  const value = unit === 'kg' ? kg : kgToLb(kg);
  return `${Math.round(value * 10) / 10} ${unit}`;
}
