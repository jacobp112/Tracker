/**
 * Data scales — Document 3 v0.3 §2.2.
 *
 * Two scales that never mix:
 *   (a) retention / health  → 3-stop semantic traffic light
 *   (b) study activity      → 5-step blue sequential ramp
 *
 * Thresholds are named constants, never inline literals (Document 4 DoD §8).
 * The retention stops are those the approved mockup actually encodes: it reads
 * 92/89/88/85 as `ok`, 81/76/72 as `warn`, and 38/25 as `bad`.
 */

export type Stop = 'success' | 'warning' | 'danger';

/** §2.2(a) — retention stop boundaries (0–100). */
export const RETENTION_SUCCESS_MIN = 85;
export const RETENTION_WARNING_MIN = 40;

/** §2.2(a) — health stop boundaries (0–100). Mirrors Document 2 §6 bands. */
export const HEALTH_SUCCESS_MIN = 70; // Document 2 §6: "> 70 high"
export const HEALTH_WARNING_MIN = 40; // Document 2 §6: "40–70 mid", "< 40 low"

/** §2.2(b) — number of steps in the activity ramp (cell-0 … cell-4). */
export const ACTIVITY_STEPS = 5;

/**
 * Map a live retention percentage (0–100) to its stop.
 * Callers must still render the number in text alongside the colour —
 * a colour-only surface is non-compliant (Document 3 §6).
 */
export function retentionStop(pct: number): Stop {
  if (pct >= RETENTION_SUCCESS_MIN) return 'success';
  if (pct >= RETENTION_WARNING_MIN) return 'warning';
  return 'danger';
}

/** Map a health score (0–100, Document 2 §6) to its stop. */
export function healthStop(score: number): Stop {
  if (score > HEALTH_SUCCESS_MIN) return 'success';
  if (score >= HEALTH_WARNING_MIN) return 'warning';
  return 'danger';
}

/**
 * Map a day's session count to an activity ramp step 0–4 (§2.2(b)).
 * `max` is the busiest day in the rendered window; a flat-zero window maps
 * everything to step 0 rather than dividing by zero.
 */
export function activityStep(count: number, max: number): 0 | 1 | 2 | 3 | 4 {
  if (count <= 0 || max <= 0) return 0;
  const ratio = count / max;
  const step = Math.ceil(ratio * (ACTIVITY_STEPS - 1));
  return Math.min(ACTIVITY_STEPS - 1, Math.max(1, step)) as 1 | 2 | 3 | 4;
}

/** CSS custom-property name carrying the ink colour for a stop. */
export function stopInkVar(stop: Stop): string {
  return `var(--${stop})`;
}

/** CSS custom-property name carrying the soft fill for a stop. */
export function stopSoftVar(stop: Stop): string {
  return `var(--${stop}-soft)`;
}
