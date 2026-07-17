import { DataTable } from '@/components/controls';
import { RetentionCurve } from '@/components/RetentionCurve';
import { Sheet } from '@/components/Sheet';
import { StatusPill, Tag, type Status } from '@/components/primitives';
import type { Topic, TopicStatus } from '@/domain/types';
import { badges, health, overconfidenceIndex, shouldShowHealth } from '@/engine/metrics';
import { retentionPct } from '@/engine/retention';

const STATUS_LABEL: Record<TopicStatus, Status> = {
  not_started: 'Not Started',
  learning: 'Learning',
  practising: 'Practising',
  mastered: 'Mastered',
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

function Stat({ value, label }: { value: string; label: string }) {
  return (
    <div className="stat-mini stack micro">
      <span className="stat-mini-value mono-num">{value}</span>
      <span className="stat-mini-label">{label}</span>
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
  now = new Date(),
}: {
  topic: Topic | null;
  sectionTitle: string;
  onClose: () => void;
  onResolveError: (topicId: string, errorId: string) => void;
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
          <StatusPill status={STATUS_LABEL[topic.status]} />
          <span>
            {topic.last_reviewed ? `reviewed ${daysAgo(topic.last_reviewed, now)}` : 'not yet reviewed'}
          </span>
        </div>

        <div className="cluster roomy">
          <Stat value={ret === null ? '—' : `${Math.round(ret)}%`} label="retention" />
          {/* Health is only surfaced at Practising/Mastered (Document 2 §6). */}
          <Stat value={showHealth ? String(health(topic, now)) : '—'} label="health" />
          <Stat value={`${oci >= 0 ? '+' : ''}${oci.toFixed(2)}`} label="calibration" />
          <Stat value={topic.strength.toFixed(1)} label="strength" />
          <Stat value={topic.k_factor.toFixed(1)} label="decay k" />
        </div>

        <div>
          <div className="eyebrow block-label">Retention curve</div>
          <RetentionCurve topic={topic} now={now} />
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
