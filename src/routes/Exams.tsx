import { Button, Card } from '@/components/primitives';
import { EmptyState } from '@/components/feedback';
import type { Store } from '@/domain/types';
import { examViews, type ExamEffect } from '@/engine/exams';
import { navigate } from '@/router';
import { ExamsIcon } from '@/shell/icons';

function fmtDate(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

function EffectChip({ effect }: { effect: ExamEffect }) {
  return effect === 'boosted' ? (
    <span className="exam-effect boosted">▲ boosted</span>
  ) : (
    <span className="exam-effect flagged">▼ flagged weak</span>
  );
}

/**
 * Exams screen — Document 3 §5.4, Document 4 E5-S3.
 * Cards show cross-topic reach grouped by parent course, per-topic effect
 * (boosted / flagged) legible, error-type chips in the neutral categorical
 * palette.
 */
export function Exams({ store }: { store: Store }) {
  const views = examViews(store);

  return (
    <div className="content">
      <div className="page-head split">
        <div>
          <h1>Exams</h1>
          <p>Every exam and the effect it had on your topics.</p>
        </div>
        <Button onClick={() => navigate('/exams/add')}>+ Add exam result</Button>
      </div>

      <div className="section">
        {views.length === 0 ? (
          <Card>
            <EmptyState
              icon={<ExamsIcon />}
              title="No exam results yet. Add one to see its effect on your topics."
              action={<Button onClick={() => navigate('/exams/add')}>Add exam result</Button>}
            />
          </Card>
        ) : (
          <div className="stack">
            {views.map((view) => (
              <Card key={view.exam.exam_id} className="exam-card">
                <div className="exam-head">
                  <div className="exam-title">{view.exam.title}</div>
                  <div className="exam-meta">
                    <span>{fmtDate(view.exam.date)}</span>
                    <span className="exam-score mono-num">
                      {view.exam.score}/{view.exam.max_score}
                    </span>
                    <span className="exam-pct mono-num">{view.scorePct}%</span>
                  </div>
                </div>

                {view.groups.map((group) => (
                  <div key={group.courseId ?? group.courseTitle} className="exam-group">
                    <div className="exam-covers">
                      Covers: {group.courseTitle} ({group.topics.length}{' '}
                      {group.topics.length === 1 ? 'topic' : 'topics'})
                    </div>
                    {group.topics.map((t) => (
                      <div className="exam-row" key={t.topicId}>
                        <span className="exam-topic">{t.title}</span>
                        <div className="exam-row-right">
                          {t.earned !== null && t.possible !== null ? (
                            <span className="exam-marks mono-num">
                              {t.earned}/{t.possible}
                            </span>
                          ) : (
                            <span className="exam-marks exam-uniform">applied overall</span>
                          )}
                          {t.errors && t.errors.length > 0 && (
                            <span className="exam-errchips">
                              {t.errors.map((e, i) => (
                                <span key={i} className={`cat-${e.error_type}`}>
                                  {e.error_type.replace('_', ' ')}
                                </span>
                              ))}
                            </span>
                          )}
                          <EffectChip effect={t.effect} />
                        </div>
                      </div>
                    ))}
                  </div>
                ))}
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
