import type { CSSProperties } from 'react';
import { Button, Card } from '@/components/primitives';
import { EmptyState } from '@/components/feedback';
import type { Store } from '@/domain/types';
import { examViews, type ExamEffect } from '@/engine/exams';
import { navigate } from '@/router';
import { ExamsIcon } from '@/shell/icons';

// 1. Infer types from the engine function so we can cleanly type our extracted components
type ExamView = ReturnType<typeof examViews>[number];
type ExamGroup = ExamView['groups'][number];
type ExamTopic = ExamGroup['topics'][number];

export interface ExamsProps {
  store: Store;
}

// 2. Extracted formatter for cleaner usage
const dateFormatter = new Intl.DateTimeFormat(undefined, { 
  month: 'short', 
  day: 'numeric' 
});

function fmtDate(iso: string): string {
  return dateFormatter.format(new Date(iso));
}

/**
 * Exams screen — Document 3 §5.4, Document 4 E5-S3.
 */
export function Exams({ store }: ExamsProps) {
  const views = examViews(store);

  return (
    <div className="content">
      <div 
        className="page-head split reveal" 
        style={{ '--i': 0 } as CSSProperties}
      >
        <div>
          <h1>Exams</h1>
          <p>Every exam and the effect it had on your topics.</p>
        </div>
        <Button onClick={() => navigate('/exams/add')}>+ Add exam result</Button>
      </div>

      <div 
        className="section reveal" 
        style={{ '--i': 1 } as CSSProperties}
      >
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
              <ExamResultCard key={view.exam.exam_id} view={view} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// --- Extracted Sub-Components ---

function ExamResultCard({ view }: { view: ExamView }) {
  const { exam, scorePct, groups } = view;

  return (
    <Card className="exam-card">
      <div className="exam-head">
        <div className="exam-title">{exam.title}</div>
        <div className="exam-meta">
          <time dateTime={exam.date}>{fmtDate(exam.date)}</time>
          <span className="exam-score mono-num">
            {exam.score}/{exam.max_score}
          </span>
          <span className="exam-pct mono-num">{scorePct}%</span>
        </div>
      </div>

      {groups.map((group) => (
        <ExamCourseGroup 
          key={group.courseId ?? group.courseTitle} 
          group={group} 
        />
      ))}
    </Card>
  );
}

function ExamCourseGroup({ group }: { group: ExamGroup }) {
  const topicCount = group.topics.length;
  const topicLabel = topicCount === 1 ? 'topic' : 'topics';

  return (
    <div className="exam-group">
      <div className="exam-covers">
        Covers: {group.courseTitle} ({topicCount} {topicLabel})
      </div>
      {group.topics.map((topic) => (
        <ExamTopicRow key={topic.topicId} topic={topic} />
      ))}
    </div>
  );
}

function ExamTopicRow({ topic }: { topic: ExamTopic }) {
  const hasSpecificMarks = topic.earned !== null && topic.possible !== null;

  return (
    <div className="exam-row">
      <span className="exam-topic">{topic.title}</span>
      <div className="exam-row-right">
        
        {hasSpecificMarks ? (
          <span className="exam-marks mono-num">
            {topic.earned}/{topic.possible}
          </span>
        ) : (
          <span className="exam-marks exam-uniform">applied overall</span>
        )}

        {topic.errors && topic.errors.length > 0 && (
          <span className="exam-errchips">
            {topic.errors.map((e, i) => (
              <span key={`${e.error_type}-${i}`} className={`cat-${e.error_type}`}>
                {e.error_type.replace('_', ' ')}
              </span>
            ))}
          </span>
        )}

        <EffectChip effect={topic.effect} />
      </div>
    </div>
  );
}

function EffectChip({ effect }: { effect: ExamEffect }) {
  const isBoosted = effect === 'boosted';
  
  return (
    <span className={`exam-effect ${isBoosted ? 'boosted' : 'flagged'}`}>
      {/* aria-hidden prevents screen readers from reading out "Black up-pointing triangle" */}
      <span aria-hidden="true">{isBoosted ? '▲ ' : '▼ '}</span>
      <span>{isBoosted ? 'boosted' : 'flagged weak'}</span>
    </span>
  );
}