/**
 * Constants & parameters — Document 2 §1, the single reference table.
 *
 * Document 2 §0: "if a value is listed as a constant, it is implemented as a
 * named, configurable constant (not a magic number inline in code)". Document 4
 * DoD §8 restates it. Nothing in the engine may inline any of these.
 *
 * Defaults are the calibrated production values.
 */
export const CONFIG = {
  /** Baseline decay constant — calibrated so strength 1 → retention ≈ 0.70 at ~3 days. */
  DECAY_K: 8.4,

  /** A topic is "due for review" when predicted retention drops below this. */
  DUE_THRESHOLD: 0.7,

  /** kFactor clamps — slowest / fastest a topic's decay constant may be tuned. */
  K_MIN: 8.4 * 0.5, // 4.2
  K_MAX: 8.4 * 2.0, // 16.8

  /** Proportional kFactor adjustment per tuning event (±10%). */
  K_STEP: 0.1,

  /** Average drift beyond ±this triggers a kFactor adjustment. */
  DRIFT_BAND: 0.1,

  /** Most recent drift samples retained per topic. */
  DRIFT_WINDOW: 5,

  /** Tuning only begins once this many drift samples exist. */
  DRIFT_MIN: 3,

  /** Only persist a tuned kFactor if it moved by more than this. */
  K_EPSILON: 0.001,

  /** Strength increments (Document 2 §3). */
  STRENGTH_GAIN: {
    TEST_PASS: 1.5,
    TEST_FAIL: 0.15,
    /** Study review, confidence ≤ 2. */
    CONF_LOW: 0.3,
    /** Study review, confidence = 3. */
    CONF_MID: 0.6,
    /** Study review, confidence 4–5. */
    CONF_HIGH: 1.0,
  },

  /** Strength seeded on first promotion out of Not Started (§7). */
  SEED_STRENGTH: 1.0,

  /** strength-per-review below this (with ≥3 reviews) flags Slow Growth. */
  SLOW_V: 0.5,

  /** Health weights (Document 2 §6) — must sum to 1. */
  W_RET: 0.3,
  W_ERR: 0.25,
  W_CAL: 0.2,
  W_CONF: 0.15,
  W_CARD: 0.1,

  /** Fraction of `out_of` at/above which a test counts as a pass. */
  TEST_PASS_MARK: 0.8,

  /** Rolling window for study velocity, in weeks. */
  VELOCITY_WINDOW_WEEKS: 4,

  /** Multipliers giving the projected-finish range. */
  PROJECTION_OPTIMISM: 1.25,
  PROJECTION_PESSIMISM: 0.75,

  /** Minimum topics ever mastered before velocity is defined (§10 low-data guard). */
  VELOCITY_MIN_MASTERED: 2,

  /** Confidence scale bounds (Document 1 v0.2 §1.3a) — 1–5, not a percentage. */
  CONF_MIN: 1,
  CONF_MAX: 5,

  /** Error-count → errorScore steps (Document 2 §6). */
  ERROR_SCORE: [100, 70, 40, 0] as const,

  /** cardScore reaches 100 at this many cards (min(100, cards × 20)). */
  CARD_SCORE_PER_CARD: 20,

  /** Default number of topics in the review queue (§11). */
  REVIEW_QUEUE_SIZE: 5,
} as const;

/** Health weights must sum to 1, or `health` is no longer a 0–100 score. */
const WEIGHT_SUM = CONFIG.W_RET + CONFIG.W_ERR + CONFIG.W_CAL + CONFIG.W_CONF + CONFIG.W_CARD;
if (Math.abs(WEIGHT_SUM - 1) > 1e-9) {
  throw new Error(`Document 2 §6 health weights must sum to 1, got ${WEIGHT_SUM}`);
}
