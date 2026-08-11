import { replayEvents } from '@/engine/replay';
import { predictRetention, MS_PER_DAY } from '@/engine/retention';
import { CONFIG } from '@/config/constants';
import { allTopics, type ReviewEvent, type Store, type Topic } from '@/domain/types';

const EPS = 1e-6;
const clamp = (r: number) => Math.min(1 - EPS, Math.max(EPS, r));
const isTest = (e: ReviewEvent) => e.kind === 'test_pass' || e.kind === 'test_fail';

export interface Scored { mae: number; logLoss: number; bernoulli: number; n: number; skipped: number; }

/** Predict R for a topic from prior events only, at time `at`. */
export interface Model { name: string; predict: (topic: Topic, prior: ReviewEvent[], at: Date) => number; }

export const engineModel: Model = {
  name: 'engine',
  predict: (topic, prior, at) => predictRetention(replayEvents(topic, prior), at) ?? 1,
};

/** Rough (uncalibrated) FSRS: R = (1 + F·t/S)^-1; S grows on success, drops on lapse. */
export const fsrsModel: Model = {
  name: 'fsrs-rough',
  predict: (_topic, prior, at) => {
    const F = 19 / 81;
    let S = 0; let last: Date | null = null; let started = false;
    for (const e of prior) {
      const d = new Date(e.date);
      if (!started) { S = 1; started = true; last = d; continue; }
      const t = last ? (d.getTime() - last.getTime()) / MS_PER_DAY : 0;
      const r = S > 0 ? 1 / (1 + (F * t) / S) : 0;
      if (e.kind === 'test_fail') S = Math.max(0.1, S * 0.3);
      else S = S * (1 + Math.E * (0.9 - r)); // reward remembering something nearly-forgotten
      last = d;
    }
    if (!started || !last) return 1;
    const t = (at.getTime() - last.getTime()) / MS_PER_DAY;
    return S > 0 ? 1 / (1 + (F * t) / S) : 0;
  },
};

export function constantModel(store: Store): Model {
  const vals: number[] = [];
  for (const { topic } of allTopics(store))
    for (const e of topic.review_history)
      if (isTest(e) && !e.smeared && e.test) vals.push(e.test.actual_retention);
  const mean = vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : 0.5;
  return { name: 'constant', predict: () => mean };
}

export function scoreStore(store: Store, model: Model): Scored {
  let mae = 0, logLoss = 0, bernoulli = 0, n = 0, skipped = 0;
  for (const { topic } of allTopics(store)) {
    const events = [...topic.review_history].sort(
      (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime(),
    );
    const prior: ReviewEvent[] = [];
    for (const e of events) {
      if (isTest(e) && !e.smeared && e.test) {
        if (prior.length === 0) {
          // No prior evidence — a first-event exam. Scoring a fabricated R=1
          // here would hand every model a guaranteed large error. Skip, count it.
          skipped += 1;
        } else {
          const a = e.test.actual_retention;
          const r = clamp(model.predict(topic, prior, new Date(e.date)));
          mae += Math.abs(r - a);
          logLoss += -(a * Math.log(r) + (1 - a) * Math.log(1 - r));
          const o = a >= CONFIG.TEST_PASS_MARK ? 1 : 0;
          bernoulli += -(o * Math.log(r) + (1 - o) * Math.log(1 - r));
          n += 1;
        }
      }
      prior.push(e); // smeared / skipped events still stay in history
    }
  }
  return n === 0 ? { mae: 0, logLoss: 0, bernoulli: 0, n: 0, skipped }
    : { mae: mae / n, logLoss: logLoss / n, bernoulli: bernoulli / n, n, skipped };
}
