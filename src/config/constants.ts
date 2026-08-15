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

  /**
   * How far below `DUE_THRESHOLD` retention must fall before a due review is
   * treated as *severely* overdue and escalated from medium/this_week to
   * high/within_48h (V2). Keeps the two review tiers distinguishable instead of
   * collapsing every due topic into the high band.
   */
  OVERDUE_MARGIN: 0.15,

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

  /** Lapse penalty & effective stability (design 2026-08-09 §2.6). Harness-tuned. */
  S_EFF_MIN: 0.25,
  LAPSE_RECOVERY: 1.25,
  PENALTY_FLOOR: 0.4,
  /** Weight on a smeared exam's penalty deviation (1.0 = full penalty). Not
   *  harness-tunable — smeared events are excluded as scoring targets. */
  SMEAR_PENALTY_WEIGHT: 1.0,
  /** Continuous test strength-gain anchors (§2.4). Unchanged at the 0.80 mark. */
  TEST_GAIN_MIN: 0.15,
  TEST_GAIN_AT_PASS_MARK: 1.5,
  TEST_GAIN_MAX: 2.0,

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

  /** Assumed study sessions per day, used to convert a deadline's day-distance
   *  into a session budget (V4) so `sessionsRemaining` is always in sessions. */
  DEFAULT_SESSIONS_PER_DAY: 2,

  /**
   * Adaptive recommendation engine (docs/workflow.md). Introduced by the Phase 1
   * bounded-gating + curriculum-ordering work.
   */
  RECO: {
    /** Direct-prerequisite hard-gate threshold (workflow §6; D3 = prose 0.70,
     *  stricter than the reference impl's 0.50). */
    TAU_CRIT: 0.7,
    /** Transitive attenuation base γ, α(d)=γ^(d-1) (workflow §7). Consumed in Phase 2. */
    GAMMA_DEPTH: 0.5,
    /** Soft-gating aggregation bound (workflow §54.4, D10). */
    SOFT_GATE_TOP_K: 3,
    SOFT_GATE_FLOOR: 0.1,
    /** S_err when either topic has no active error patterns (workflow §54.4, P2-D1):
     *  0 = evidence-driven soft gating (an ancestor dampens only on real misconception
     *  overlap). Raise toward 1 to attenuate on distance + mastery alone. */
    S_ERR_UNEVIDENCED: 0,

    /* ── MAUT continuous arbitration (Phase 3, workflow §13–23) ── */
    /** Memory-urgency target retention R_target (§15). */
    R_TARGET_MEM: 0.9,
    /** λ_vel — weight on the decay-velocity term of u_mem (§15). Tunable. */
    MEM_VELOCITY_LAMBDA: 1.0,
    /** σ_t (minutes) for the asymmetric feasibility fit (D5, §18). */
    FEASIBILITY_SIGMA: 15,
    /** η — preference for unmastered content in u_vel (§17). */
    VELOCITY_ETA: 1.2,
    /**
     * Gentler u_vel mastery exponent for an active, not-yet-mastered topic
     * WITHOUT an unresolved error (objective §2.10 — momentum). Below VELOCITY_ETA
     * so an in-progress topic stays "worth finishing" longer than a fresh one,
     * decaying to 0 only as evidence-mastery reaches full competency (L→1). Lives
     * inside u_vel so it respects the [0,1] bound and can never overpower error
     * urgency (w_vel·1 = 0.20 < w_found·1 = 0.30). */
    MOMENTUM_ETA: 0.3,
    /** Novelty multiplier when a topic was recently studied (§17). */
    VELOCITY_RECENT_NOVELTY: 0.1,
    /** Default per-topic syllabus weight when unauthored (§16). */
    SYLLABUS_WEIGHT_DEFAULT: 1.0,
    /** Own-error urgency mass added to u_found by severity, so an unresolved
     *  misconception raises foundational risk continuously (§8 within §16). A
     *  high-severity error alone saturates u_found toward 1. */
    ERROR_URGENCY: { low: 0.25, medium: 0.5, high: 1.0 } as Record<'low' | 'medium' | 'high', number>,
    /** Default exam horizon (days) for u_found when no exam is linked (§16). */
    DEFAULT_EXAM_HORIZON_DAYS: 30,
    /** Sessions feeding `recentHistory` for u_vel novelty. */
    RECENT_HISTORY_SIZE: 5,
    /** Base MAUT weights (§19); must sum to 1. */
    MAUT_BASE_WEIGHTS: { mem: 0.35, found: 0.3, vel: 0.2, feas: 0.15 },
    /** Exam-horizon context window (days) that raises w_found (§20). */
    EXAM_HORIZON_DAYS: 7,
    /** Session-exhaustion threshold (minutes) that raises w_feas (§22). */
    EXHAUSTION_MINUTES: 15,
    /** Non-negative weight floor before L1 normalization (§54.6). */
    WEIGHT_FLOOR: 0.01,

    /* ── Anti-starvation: aging + domain interleaving (Phase 4, §24–26, §36–37) ── */
    /** α_age as a fraction of max(U): the largest possible aging boost (§24). */
    AGING_MAX_FRACTION: 0.25,
    /** φ per DAY of queue residence; Δt≈14d → ~75% of the max boost (tunable). */
    AGING_ACCELERATION: 0.1,
    /** β interleaving suppression base (§25). */
    INTERLEAVE_BETA: 0.65,
    /** K — recency window; suppression saturates at β^K so a domain is never
     *  permanently excluded (§25, §37). domainId = section_id (D6). */
    INTERLEAVE_WINDOW_K: 5,
    /** Urgent-exemption (P4-D1 = b): a candidate whose predicted retention is
     *  below this is exempt from interleaving suppression, so urgent forgetting
     *  always surfaces (§37 "urgent review must override"). Matches the critical
     *  overdue band (DUE_THRESHOLD − OVERDUE_MARGIN = 0.55). */
    INTERLEAVE_EXEMPT_RETENTION: 0.55,
  },

  /**
   * Per-topic leveling (engine/leveling.ts). Levels are a live view of genuine
   * progress, never stored. This is the one tunable table the banding reads;
   * `topicLevel` inlines no thresholds of its own.
   */
  LEVEL: {
    /**
     * A topic earns at least level `i + 1` once its health() reaches
     * `HEALTH_BANDS[i]`; below the first band it is level 0. The array length
     * defines the maximum level (here, 5), so there is no separate MAX_LEVEL to
     * drift out of sync.
     */
    HEALTH_BANDS: [25, 45, 62, 78, 90],
    /**
     * Cap while the topic has no *passed* test. Health leans partly on
     * self-reported confidence and on calibration that defaults to full without
     * tests, so unvalidated topics must not climb past here — the top bands are
     * earned by validation, not asserted.
     */
    UNVALIDATED_CAP: 3,
  },

  /** Progress surfacing (engine/progress.ts) — all derived, never stored. */
  PROGRESS: {
    /** Days of history shown in the Overview EXP trend sparkline. */
    TREND_DAYS: 7,
    /**
     * Nominal minutes per study session — the honest volume proxy. Session
     * duration is decomposed away on ingestion, so "hours" is a count × this,
     * exact in the count and approximate in the hours (mirrors weeklyVolume).
     */
    SESSION_MINUTES: 30,
  },

  /**
   * Performance layer (engine/performance.ts) — all derived, never stored
   * (design 2026-08-10). Weights are the semantic knobs; thresholds are the
   * min-data guards below which a metric returns null rather than a number.
   */
  PERFORMANCE: {
    /** Min qualifying attempts before a headline metric shows a number. */
    MIN_INDEPENDENT_N: 5,
    MIN_TRANSFER_N: 5,
    MIN_COLD_N: 5,
    MIN_CALIBRATION_N: 5,
    /** Min distinct sub-scores present before Performance Health is defined. */
    MIN_HEALTH_INPUTS: 2,
    /** Min quality observations before Performance Quality shows a number. */
    MIN_QUALITY_N: 5,
    /** Min novel-task observations before Novel-Task Success shows a number. */
    MIN_NOVEL_N: 5,
    /** Novelty at/above this counts as a "novel task" (3 = genuinely unfamiliar). */
    NOVEL_THRESHOLD: 3,
    /** A prerequisite with surfaced health below this is flagged unstable
     *  (design §E — the second health band; diagnostic only, tunable). */
    PREREQ_UNSTABLE_HEALTH: 45,
    /** Dashboard trend windows, in days (design §13). */
    TREND_SHORT_DAYS: 7,
    TREND_LONG_DAYS: 30,
    /** Ordinal maxima, for normalising each dimension to 0–1. */
    DIFFICULTY_MAX: 5,
    NOVELTY_MAX: 4,
    INDEPENDENCE_MAX: 3,
    TRANSFER_MAX: 3,
    QUALITY_MAX: 5,
    /** Performance Health composite weights (design §D, user-approved). */
    HEALTH_WEIGHTS: {
      accuracy: 0.3,
      difficulty: 0.2,
      novelty: 0.15,
      transfer: 0.2,
      quality: 0.15,
    },
    /** Cold Performance composite weights (proposed; tunable). Over cold attempts:
     *  difficulty & novelty are success-gated like Performance Health (§18 — a
     *  failed hard/novel cold attempt banks no difficulty/novelty credit);
     *  correctness/independence/transfer/quality are direct present-value inputs. */
    COLD_WEIGHTS: {
      correctness: 0.3,
      difficulty: 0.15,
      novelty: 0.15,
      independence: 0.15,
      transfer: 0.15,
      quality: 0.1,
    },
  },
} as const;

/** Health weights must sum to 1, or `health` is no longer a 0–100 score. */
const WEIGHT_SUM = CONFIG.W_RET + CONFIG.W_ERR + CONFIG.W_CAL + CONFIG.W_CONF + CONFIG.W_CARD;
if (Math.abs(WEIGHT_SUM - 1) > 1e-9) {
  throw new Error(`Document 2 §6 health weights must sum to 1, got ${WEIGHT_SUM}`);
}

/** Performance-layer weight tables must each sum to 1 (0–100 composites). */
for (const [name, table] of [
  ['HEALTH_WEIGHTS', CONFIG.PERFORMANCE.HEALTH_WEIGHTS],
  ['COLD_WEIGHTS', CONFIG.PERFORMANCE.COLD_WEIGHTS],
] as const) {
  const sum = Object.values(table).reduce((a, b) => a + b, 0);
  if (Math.abs(sum - 1) > 1e-9) {
    throw new Error(`CONFIG.PERFORMANCE.${name} must sum to 1, got ${sum}`);
  }
}

/** MAUT base weights must sum to 1, or the composite is no longer 0–1 (§19). */
{
  const w = CONFIG.RECO.MAUT_BASE_WEIGHTS;
  const sum = w.mem + w.found + w.vel + w.feas;
  if (Math.abs(sum - 1) > 1e-9) {
    throw new Error(`CONFIG.RECO.MAUT_BASE_WEIGHTS must sum to 1, got ${sum}`);
  }
}
