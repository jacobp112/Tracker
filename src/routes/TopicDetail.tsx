import { DataTable, SegmentedControl } from '@/components/controls';
import { RetentionCurve } from '@/components/RetentionCurve';
import { Sheet } from '@/components/Sheet';
import { Hint, Tag } from '@/components/primitives';
import type { Confidence, Topic, TopicStatus } from '@/domain/types';
import { badges, health, overconfidenceIndex, shouldShowHealth } from '@/engine/metrics';
import { retentionPct } from '@/engine/retention';

const STATUS_OPTIONS: ReadonlyArray<{ value: TopicStatus; label: string }> = [
  { value: 'not_started', label: 'Not started' },
  { value: 'learning', label: 'Learning' },
  { value: 'practising', label: 'Practising' },
  { value: 'mastered', label: 'Mastered' },
];

const CONFIDENCES: Confidence[] = [1, 2, 3, 4, 5];

/** Word the number, so a 1–5 tap is a statement, not a score guess. */
const CONFIDENCE_HINT: Record<Confidence, string> = {
  1: "Couldn't recall it",
  2: 'Big gaps',
  3: 'Shaky but there',
  4: 'Mostly solid',
  5: 'Fluent',
};

const KIND_LABEL: Record<string, string> = {
  study_review: 'Study review',
  test_pass: 'Test passed',
  test_fail: 'Test failed',
};

function fmt(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
}

function daysAgo(iso: string, now: Date): string {
  const d = Math.floor((now.getTime() - new Date(iso).getTime()) / 86_400_000);
  if (d <= 0) return 'today';
  if (d === 1) return 'yesterday';
  return `${d} days ago`;
}

function Stat({ value, label, hint }: { value: string; label: string; hint?: string }) {
  return (
    <div className="stat-mini stack micro">
      <span className="stat-mini-value mono-num">{value}</span>
      <span className="stat-mini-label">
        {label}
        {hint && <Hint text={hint} label={`About ${label}`} />}
      </span>
    </div>
  );
}

/**
 * Topic detail — Document 3 §5.3, Document 4 E4-S5.
 *
 * The five header stats (retention, health, calibration, strength, decay k) are
 * surfaced deliberately: they make the self-tuning model legible rather than a
 * black box (§5.3).
 */
export function TopicDetail({
  topic,
  sectionTitle,
  onClose,
  onResolveError,
  onPromote,
  onQuickReview,
  now = new Date(),
}: {
  topic: Topic | null;
  sectionTitle: string;
  onClose: () => void;
  onResolveError: (topicId: string, errorId: string) => void;
  /** Learner-set status ladder (Document 2 §7). */
  onPromote: (topicId: string, status: TopicStatus) => void;
  /** One-tap manual review — logs a `manual_review` event at this confidence. */
  onQuickReview: (topicId: string, confidence: Confidence) => void;
  now?: Date;
}) {
  if (!topic) return null;

  const ret = retentionPct(topic, now);
  const oci = overconfidenceIndex(topic);
  const showHealth = shouldShowHealth(topic);

  return (
    <Sheet open title={topic.title} onClose={onClose}>
      <div className="stack">
        <div className="cluster topic-meta">
          <span>{sectionTitle}</span>
          <span>
            {topic.last_reviewed ? `reviewed ${daysAgo(topic.last_reviewed, now)}` : 'not yet reviewed'}
          </span>
        </div>

        {/* The status pill, made interactive — the learner owns this ladder
          * (Document 2 §7); the math never moves it. Mastery %, velocity and
          * the finish projection all read from what is set here. */}
        <div>
          <div className="eyebrow block-label">Status</div>
          <SegmentedControl<TopicStatus>
            label="Topic status"
            value={topic.status}
            onChange={(status) => onPromote(topic.topic_id, status)}
            options={STATUS_OPTIONS}
          />
        </div>

        <div className="cluster roomy">
          <Stat
            value={ret === null ? '—' : `${Math.round(ret)}%`}
            label="retention"
            hint="How much of this topic you'd likely recall right now, from the forgetting curve. Falls between reviews, recovers when you review."
          />
          {/* Health is only surfaced at Practising/Mastered (Document 2 §6). */}
          <Stat
            value={showHealth ? String(health(topic, now)) : '—'}
            label="health"
            hint="A 0-100 blend of retention, calibration, unresolved mistakes, confidence and flashcard coverage. Only measured once a topic is Practising or beyond."
          />
          <Stat
            value={`${oci >= 0 ? '+' : ''}${oci.toFixed(2)}`}
            label="calibration"
            hint="Your confidence vs. your actual test scores. Positive means overconfident, negative means underconfident, 0.00 means spot on."
          />
          <Stat
            value={topic.strength.toFixed(1)}
            label="strength"
            hint="Grows with every review and never falls. The stronger a topic, the slower it decays."
          />
          <Stat
            value={topic.k_factor.toFixed(1)}
            label="decay k"
            hint="The decay constant, self-tuned from your test results. Higher means the model has learned you forget this topic more slowly."
          />
        </div>

        <div>
          <div className="eyebrow block-label">Retention curve</div>
          <RetentionCurve topic={topic} now={now} />
        </div>

        {/* One tap closes the review loop in-app — no AI round-trip for "I
          * just re-read my notes". Same recalculation path as a session; only
          * the provenance (`manual_review`) differs. */}
        <div>
          <div className="eyebrow block-label">Log a quick review</div>
          <p className="muted-note">How well could you recall this just now?</p>
          <div className="quick-review" role="group" aria-label="Log a quick review by confidence">
            {CONFIDENCES.map((c) => (
              <button
                key={c}
                type="button"
                className="quick-review-btn"
                onClick={() => onQuickReview(topic.topic_id, c)}
              >
                <span className="quick-review-num mono-num">{c}</span>
                <span className="quick-review-hint">{CONFIDENCE_HINT[c]}</span>
              </button>
            ))}
          </div>
        </div>

        {badges(topic).length > 0 && (
          <div className="cluster">
            {badges(topic).map((b) => (
              <Tag key={b.id} tone={b.tone}>
                {b.label}
              </Tag>
            ))}
          </div>
        )}

        <div>
          <div className="eyebrow block-label">Review history ({topic.review_history.length})</div>
          {topic.review_history.length === 0 ? (
            <p className="muted-note">Nothing logged yet. Log a session to start the curve.</p>
          ) : (
            <DataTable
              caption="Review history"
              getRowKey={(e) => e.event_id}
              rows={[...topic.review_history].reverse()}
              columns={[
                { key: 'date', header: 'Date', render: (e) => fmt(e.date) },
                { key: 'kind', header: 'Event', render: (e) => KIND_LABEL[e.kind] ?? e.kind },
                {
                  key: 'score',
                  header: 'Score',
                  numeric: true,
                  render: (e) => (e.test ? `${e.test.score}/${e.test.out_of}` : '—'),
                },
                {
                  key: 'conf',
                  header: 'Conf',
                  numeric: true,
                  render: (e) => `${e.confidence_reported}/5`,
                },
              ]}
            />
          )}
        </div>

        <div>
          <div className="eyebrow block-label">
            Error log ({topic.error_log.filter((e) => !e.resolved).length} active)
          </div>
          {topic.error_log.length === 0 ? (
            <p className="muted-note">No mistakes logged. Nothing to work through.</p>
          ) : (
            <DataTable
              caption="Error log"
              getRowKey={(e) => e.error_id}
              rows={[...topic.error_log].reverse()}
              columns={[
                { key: 'date', header: 'Date', render: (e) => fmt(e.date) },
                {
                  key: 'type',
                  header: 'Type',
                  render: (e) => <span className={`cat-${e.error_type}`}>{e.error_type.replace('_', ' ')}</span>,
                },
                { key: 'desc', header: 'What happened', render: (e) => e.description },
                {
                  key: 'resolved',
                  header: 'Resolved',
                  render: (e) => (
                    <label className="check-cell">
                      <input
                        type="checkbox"
                        checked={e.resolved}
                        onChange={() => onResolveError(topic.topic_id, e.error_id)}
                      />
                      <span className="sr-only">
                        Mark "{e.description}" as {e.resolved ? 'unresolved' : 'resolved'}
                      </span>
                    </label>
                  ),
                },
              ]}
            />
          )}
        </div>
      </div>
    </Sheet>
  );
}
