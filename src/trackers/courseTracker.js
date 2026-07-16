/**
 * Course Tracker Logic & Heuristics
 * Ports legacy algorithms (forgetting curves, study signals, review strength increments)
 */

export const DECAY_K = 8.4;         // baseline calibrated: strength 1 -> R=0.7 at ~3 days
export const DUE_THRESHOLD = 0.7;   // topic is "due" when predicted R drops below this

/**
 * Returns the current date in YYYY-MM-DD format.
 * @returns {string}
 */
export function getTodayStr() {
  return new Date().toISOString().split('T')[0];
}

/**
 * Calculates days between two date strings (YYYY-MM-DD).
 * @param {string} a 
 * @param {string} b 
 * @returns {number}
 */
export function daysBetween(a, b) {
  const t1 = new Date(a).getTime();
  const t2 = new Date(b).getTime();
  if (isNaN(t1) || isNaN(t2)) return 0;
  return Math.round((t2 - t1) / (1000 * 60 * 60 * 24));
}

/**
 * Predicts the retention probability (0.0 to 1.0) of a topic.
 * @param {object} topic 
 * @returns {number|null} Null if not reviewed or not started
 */
export function predictRetention(topic) {
  if (!topic.reviewed || topic.status === 'Not Started') return null;
  const elapsed = daysBetween(topic.reviewed, getTodayStr());
  if (elapsed <= 0) return 1.0;
  const s = topic.strength || 0;
  if (s <= 0) return 0.0;
  const k = topic.kFactor || DECAY_K;
  return Math.exp(-elapsed / (k * s));
}

/**
 * Calculates strength increment based on review confidence and source.
 * @param {number|string} conf 
 * @param {string} source 
 * @returns {number}
 */
export function strengthIncrement(conf, source) {
  if (source === 'test-pass') return 1.5;
  if (source === 'test-fail') return 0.15;
  const c = parseInt(conf, 10) || 2;
  if (c <= 2) return 0.3;
  if (c === 3) return 0.6;
  return 1.0; // 4-5
}

/**
 * Adds a study review entry and recalculates topic strength and reviewed date.
 * @param {object} topic 
 * @param {number|string} conf 
 * @param {string} source 
 */
export function recordReview(topic, conf, source = 'study') {
  if (!topic.reviewHistory) topic.reviewHistory = [];
  const date = getTodayStr();

  topic.reviewHistory.push({
    date,
    confidence: parseInt(conf, 10) || 2,
    source
  });

  topic.strength = (topic.strength || 0) + strengthIncrement(conf, source);
  topic.reviewed = date;
  topic.conf = String(conf);
}

/**
 * Records a test score for a topic. Triggers a corresponding review record.
 * @param {object} topic 
 * @param {number} score 
 * @param {number} outOf 
 * @param {number|string} conf 
 * @param {string} note 
 */
export function recordTest(topic, score, outOf, conf, note = '') {
  if (!topic.tests) topic.tests = [];
  const date = getTodayStr();

  const scoreVal = Number(score) || 0;
  const outOfVal = Number(outOf) || 1;
  const pct = scoreVal / outOfVal;
  const pass = pct >= 0.8;

  topic.tests.push({
    date,
    score: scoreVal,
    outOf: outOfVal,
    confidence: parseInt(conf, 10) || 2,
    note
  });

  // Trigger a review based on test pass/fail
  recordReview(topic, conf, pass ? 'test-pass' : 'test-fail');

  // Trigger error log entry internally if failed
  if (!pass) {
    if (!topic.errors) topic.errors = [];
    topic.errors.push({
      date,
      type: 'Procedural', // default
      note: note || `Scored ${scoreVal}/${outOfVal} on test.`,
      status: 'active'
    });
  }
}

/**
 * Computes study signals (Friction, Needs retrieval, Brittle, Ready test, Efficient).
 * @param {object} topic 
 * @returns {object|null} { cls, label, detail } or null
 */
export function getTopicStudySignal(topic) {
  if (!topic) return null;
  const seconds = Number(topic.studySeconds) || 0;
  const minutes = seconds / 60;
  const conf = parseInt(topic.conf, 10) || 0;
  const reviews = (topic.reviewHistory || []).length;

  const tests = topic.tests || [];
  const lastTest = tests.length > 0 ? tests[tests.length - 1] : null;
  const lastTestFailed = lastTest ? (lastTest.score / lastTest.outOf) < 0.8 : false;

  if (minutes >= 45 && conf <= 2) {
    return {
      cls: 'friction-zone',
      label: 'Friction',
      detail: 'High time with low fluency. Change method: re-teach, worked examples, then retrieval.'
    };
  }
  if (minutes >= 25 && reviews === 0) {
    return {
      cls: 'needs-retrieval',
      label: 'Needs retrieval',
      detail: 'Time has gone in, but no retrieval review is logged yet.'
    };
  }
  if (minutes <= 12 && conf >= 4 && lastTestFailed) {
    return {
      cls: 'brittle-fluency',
      label: 'Brittle',
      detail: 'Fast confidence, but the latest test missed the 80% threshold.'
    };
  }
  if (minutes >= 20 && conf >= 4 && !lastTestFailed && topic.status !== 'Not Started') {
    return {
      cls: 'ready-test',
      label: 'Ready test',
      detail: 'Good fluency after meaningful time. Validate with a timed question set.'
    };
  }
  if (minutes > 0 && minutes <= 10 && conf >= 4 && !lastTestFailed) {
    return {
      cls: 'efficient',
      label: 'Efficient',
      detail: 'Low time and high fluency. Keep it light unless tests expose weakness.'
    };
  }
  return null;
}

/**
 * Computes a topic's health score (0 to 100) based on Bjork calibration metrics.
 * @param {object} topic 
 * @returns {number}
 */
export function topicHealth(topic) {
  // 1. Retention (30%)
  const R = predictRetention(topic) || 0;
  const retentionScore = R * 100;

  // 2. Error Pressure (25%)
  const activeErrors = (topic.errors || []).filter(e => e.status === 'active').length;
  let errorScore = 0;
  if (activeErrors === 0) errorScore = 100;
  else if (activeErrors === 1) errorScore = 70;
  else if (activeErrors === 2) errorScore = 40;
  else errorScore = 0;

  // 3. Calibration Accuracy (20%)
  // Difference between average confidence (as fraction) and actual test scores
  const tests = topic.tests || [];
  let calibrationScore = 100;
  if (tests.length > 0) {
    let ociSum = 0;
    tests.forEach(t => {
      const actualPct = t.outOf ? (t.score / t.outOf) : 0;
      ociSum += (t.confidence / 5) - actualPct;
    });
    const avgOCI = ociSum / tests.length;
    calibrationScore = Math.max(0, 100 * (1 - Math.abs(avgOCI)));
  }

  // 4. Confidence Score (25%)
  const C = parseInt(topic.conf, 10) || 0;
  const confidenceScore = C ? (C / 5) * 100 : 0;

  const health = (retentionScore * 0.30) + (errorScore * 0.25) + (calibrationScore * 0.20) + (confidenceScore * 0.25);
  return Math.round(health);
}
