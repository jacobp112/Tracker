import { useState } from 'react';
import { DataTable } from '@/components/controls';
import { EmptyState, useToast } from '@/components/feedback';
import { Button, Card, SecondaryButton, Tag, type TagTone } from '@/components/primitives';
import { Prop, PropsRow } from '@/components/PropsRow';
import { Sheet } from '@/components/Sheet';
import type { JobApplication, JobStage, Store } from '@/domain/types';
import { currentStage } from '@/domain/types';
import {
  boardColumns,
  closedApplications,
  daysInStage,
  funnelStats,
  nextStages,
  STAGE_LABEL,
} from '@/engine/jobs';
import { navigate } from '@/router';
import { JobsIcon } from '@/shell/icons';

/** Tone per stage, so colour carries state alongside the label. */
const STAGE_TONE: Record<JobStage, TagTone> = {
  saved: 'neutral',
  applied: 'neutral',
  screen: 'accent',
  interview: 'accent',
  offer: 'ok',
  accepted: 'ok',
  rejected: 'bad',
};

function fmtDate(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

function AppCard({ app, now, onOpen }: { app: JobApplication; now: Date; onOpen: () => void }) {
  const days = daysInStage(app, now);
  return (
    <button type="button" className="job-card" onClick={onOpen}>
      <span className="job-card-company">{app.company}</span>
      <span className="job-card-role">{app.role}</span>
      <span className="job-card-meta">
        <span className="mono-num">{days === 0 ? 'today' : `${days}d`}</span>
        {app.next_action_date && (
          <span className="job-card-next">→ {fmtDate(app.next_action_date)}</span>
        )}
      </span>
    </button>
  );
}

/**
 * Application detail — the hybrid record made visible: editable descriptive
 * fields up top, the append-only stage history below. Stage moves append a
 * StageEvent; nothing here rewrites history.
 */
function ApplicationDetail({
  app,
  onClose,
  onMoveStage,
  onEdit,
  onArchive,
  now,
}: {
  app: JobApplication | null;
  onClose: () => void;
  onMoveStage: (id: string, stage: JobStage) => void;
  onEdit: (id: string, patch: Partial<JobApplication>) => void;
  onArchive: (id: string) => void;
  now: Date;
}) {
  if (!app) return null;

  const stage = currentStage(app);
  const days = daysInStage(app, now);

  return (
    <Sheet open title={`${app.company} — ${app.role}`} onClose={onClose}>
      <div className="stack">
        <div className="cluster topic-meta">
          <Tag tone={STAGE_TONE[stage]}>{STAGE_LABEL[stage]}</Tag>
          <span>{days === 0 ? 'moved today' : `${days} day${days === 1 ? '' : 's'} in stage`}</span>
          {app.location && <span>{app.location}</span>}
          {app.salary_range && <span className="mono-num">{app.salary_range}</span>}
        </div>

        {(app.url || app.source) && (
          <p className="muted-note">
            {app.source && <>Found via {app.source}. </>}
            {app.url && (
              <a href={app.url} target="_blank" rel="noreferrer">
                View posting ↗
              </a>
            )}
          </p>
        )}

        {app.description && <p className="job-description">{app.description}</p>}

        <div>
          <div className="eyebrow block-label">Move to</div>
          <div className="job-stage-actions">
            {nextStages(stage).map((s) => (
              <SecondaryButton key={s} onClick={() => onMoveStage(app.application_id, s)}>
                {STAGE_LABEL[s]}
              </SecondaryButton>
            ))}
          </div>
        </div>

        <div>
          <div className="eyebrow block-label">Next action</div>
          <input
            type="date"
            className="job-date-input"
            aria-label="Next action date"
            value={app.next_action_date ?? ''}
            onChange={(e) =>
              onEdit(app.application_id, {
                next_action_date: e.target.value || undefined,
              })
            }
          />
        </div>

        {app.contacts && app.contacts.length > 0 && (
          <div>
            <div className="eyebrow block-label">Contacts</div>
            {app.contacts.map((c, i) => (
              <p key={i} className="muted-note">
                {c.name}
                {c.role && ` · ${c.role}`}
                {c.email && ` · ${c.email}`}
              </p>
            ))}
          </div>
        )}

        <div>
          <div className="eyebrow block-label">Stage history ({app.stage_history.length})</div>
          <DataTable
            caption="Stage history"
            getRowKey={(e) => e.event_id}
            rows={[...app.stage_history].reverse()}
            columns={[
              { key: 'date', header: 'Date', render: (e) => fmtDate(e.date) },
              {
                key: 'stage',
                header: 'Stage',
                render: (e) => <Tag tone={STAGE_TONE[e.stage]}>{STAGE_LABEL[e.stage]}</Tag>,
              },
              { key: 'notes', header: 'Notes', render: (e) => e.notes ?? '—' },
            ]}
          />
        </div>

        <div className="cluster">
          <SecondaryButton onClick={() => onArchive(app.application_id)}>
            {app.archived ? 'Unarchive' : 'Archive'}
          </SecondaryButton>
        </div>
      </div>
    </Sheet>
  );
}

/**
 * Jobs screen — the pipeline board. Columns per pipeline stage, closed
 * (accepted/rejected) applications listed below. Everything derives from the
 * live store, so a stage move re-renders every number with no manual refresh.
 */
export function Jobs({
  store,
  moveStage,
  editApplication,
  archiveApplication,
  now = new Date(),
}: {
  store: Store;
  moveStage: (id: string, stage: JobStage) => string | null;
  editApplication: (id: string, patch: Partial<JobApplication>) => string | null;
  archiveApplication: (id: string, archived?: boolean) => string | null;
  now?: Date;
}) {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const { toast } = useToast();

  // Resolve from the live store each render — a held copy would show
  // pre-move state (same rule as CourseScreen).
  const selected = selectedId
    ? store.applications.find((a) => a.application_id === selectedId) ?? null
    : null;

  const columns = boardColumns(store);
  const closed = closedApplications(store);
  const stats = funnelStats(store);
  const hasAny = store.applications.length > 0;

  const run = (result: string | null) => {
    if (result) toast(result, 'error');
  };

  return (
    <div className="content">
      <div className="page-head split">
        <div>
          <h1>Jobs</h1>
          <p>Every application and where it stands.</p>
        </div>
        <Button onClick={() => navigate('/jobs/add')}>+ Add application</Button>
      </div>

      {!hasAny ? (
        <div className="section">
          <Card>
            <EmptyState
              icon={<JobsIcon />}
              title="No applications yet. Add one to start tracking your pipeline."
              action={<Button onClick={() => navigate('/jobs/add')}>Add application</Button>}
            />
          </Card>
        </div>
      ) : (
        <>
          {/* The shared props-row (Document 3 §3) — one card, internal dividers,
            * responsive collapse. Not a one-off stat cluster. */}
          <PropsRow>
            <Prop label="Active" value={stats.active} caption="in the pipeline" />
            <Prop label="Applied" value={stats.applied} caption="applications sent" />
            <Prop
              label="Response rate"
              hint="Share of applications that reached a screen or beyond. Uses the furthest stage each application ever reached, so later rejections still count."
              value={stats.responseRate === null ? '—' : `${stats.responseRate}%`}
              caption={stats.responseRate === null ? 'Nothing applied yet' : 'reached screen+'}
            />
            <Prop
              label="Interview rate"
              hint="Share of applications that reached an interview or beyond."
              value={stats.interviewRate === null ? '—' : `${stats.interviewRate}%`}
              caption={stats.interviewRate === null ? 'Nothing applied yet' : 'reached interview+'}
            />
            <Prop label="Offers" value={stats.offers} caption={stats.offers === 1 ? 'offer' : 'offers'} />
          </PropsRow>

          <div className="section">
            <div className="job-board" role="list" aria-label="Application pipeline">
              {columns.map((col) => (
                <div key={col.stage} className="job-column" role="listitem">
                  <div className="job-column-head">
                    <span className="job-column-title">{STAGE_LABEL[col.stage]}</span>
                    <span className="job-column-count mono-num">{col.applications.length}</span>
                  </div>
                  <div className="job-column-cards">
                    {col.applications.length === 0 ? (
                      /* An empty column still explains itself — a bare gap
                       * reads as a rendering failure, not an empty stage. */
                      <div className="job-column-empty">None yet</div>
                    ) : (
                      col.applications.map((app) => (
                        <AppCard
                          key={app.application_id}
                          app={app}
                          now={now}
                          onOpen={() => setSelectedId(app.application_id)}
                        />
                      ))
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {closed.length > 0 && (
            <div className="section">
              <div className="eyebrow block-label">Closed ({closed.length})</div>
              <Card className="list-card">
                {closed.map((app) => {
                  const stage = currentStage(app);
                  return (
                    <div className="row" key={app.application_id}>
                      <div className="row-left">
                        <button
                          type="button"
                          className="topic topic-btn"
                          onClick={() => setSelectedId(app.application_id)}
                        >
                          {app.company} — {app.role}
                        </button>
                      </div>
                      <div className="row-right">
                        <Tag tone={STAGE_TONE[stage]}>{STAGE_LABEL[stage]}</Tag>
                      </div>
                    </div>
                  );
                })}
              </Card>
            </div>
          )}
        </>
      )}

      <ApplicationDetail
        app={selected}
        now={now}
        onClose={() => setSelectedId(null)}
        onMoveStage={(id, stage) => run(moveStage(id, stage))}
        onEdit={(id, patch) => run(editApplication(id, patch))}
        onArchive={(id) => {
          run(archiveApplication(id, !selected?.archived));
          setSelectedId(null);
        }}
      />
    </div>
  );
}
