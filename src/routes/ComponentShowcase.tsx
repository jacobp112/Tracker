import { useState } from 'react';
import { ActivityCalendar, toLocalDateKey, type ActivityDay } from '@/components/ActivityCalendar';
import { Badge } from '@/components/Badge';
import { CalibrationIndicator, DataTable, ProgressRing, SegmentedControl } from '@/components/controls';
import { EmptyState, useToast } from '@/components/feedback';
import { HeroRing } from '@/components/HeroRing';
import { HeroStat } from '@/components/HeroStat';
import { Prop, PropsRow } from '@/components/PropsRow';
import {
  Button,
  Card,
  DangerButton,
  DeltaChip,
  Dot,
  Eyebrow,
  HealthChip,
  IconButton,
  SecondaryButton,
  StatusPill,
  Tag,
  type Status,
} from '@/components/primitives';
import { BADGE_META, type BadgeId } from '@/engine/metrics';
import { RetentionRow } from '@/components/RetentionRow';
import { Sheet } from '@/components/Sheet';
import { Sparkline, type SparkPoint } from '@/components/Sparkline';
import { AddIcon, DueIcon, HealthIcon } from '@/shell/icons';

/** Deterministic demo data — a showcase that reshuffles on every render is
 *  useless for spotting visual regressions. */
function demoSpark(): SparkPoint[] {
  const today = new Date();
  let s = 7;
  const rnd = () => {
    s = (s * 1103515245 + 12345) % 2147483648;
    return s / 2147483648;
  };
  const out: SparkPoint[] = [];
  let val = 58;
  for (let i = 0; i < 30; i++) {
    val += (rnd() - 0.42) * 2.4 + 0.22;
    val = Math.max(52, Math.min(70, val));
    const d = new Date(today);
    d.setDate(d.getDate() - (29 - i));
    out.push({ value: Math.round(val), date: d });
  }
  out[out.length - 1]!.value = 64;
  return out;
}

function demoActivity(): ActivityDay[] {
  const today = new Date();
  let seed = 42;
  const rand = () => {
    seed = (seed * 9301 + 49297) % 233280;
    return seed / 233280;
  };
  const out: ActivityDay[] = [];
  for (let i = 0; i < 91; i++) {
    const d = new Date(today);
    d.setDate(d.getDate() - (90 - i));
    out.push({ date: toLocalDateKey(d), count: Math.floor(rand() * 5) });
  }
  return out;
}

const STATUSES: Status[] = ['Not Started', 'Learning', 'Practising', 'Mastered'];

function Demo({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="section">
      <div className="section-title">{title}</div>
      <Card className="panel">
        <div className="cluster" style={{ gap: 'var(--space-6)' }}>
          {children}
        </div>
      </Card>
    </div>
  );
}

/**
 * E1-S2 acceptance criterion: "Each has a dev-route showcase with all its
 * states (default/hover/active/disabled/loading/empty/error)."
 */
export function ComponentShowcase() {
  const [seg, setSeg] = useState<'heatmap' | 'list'>('heatmap');
  const [sheetOpen, setSheetOpen] = useState(false);
  const { toast } = useToast();

  return (
    <div className="content">
      <div className="page-head">
        <h1>Component showcase</h1>
        <p>Every Document 3 §3 primitive, in every state. Toggle the theme to check both.</p>
      </div>

      <Demo title="Buttons">
        <Button>Start review</Button>
        <Button disabled>Disabled</Button>
        <SecondaryButton>Secondary</SecondaryButton>
        <SecondaryButton disabled>Disabled</SecondaryButton>
        <DangerButton>Clear everything</DangerButton>
        <DangerButton disabled>Disabled</DangerButton>
        <IconButton label="Add tracker">
          <AddIcon />
        </IconButton>
      </Demo>


      <Demo title="Status pill — Doc 2 §7 ladder">
        {STATUSES.map((s) => (
          <StatusPill key={s} status={s} />
        ))}
      </Demo>

      <Demo title="Health chip — Doc 2 §6 bands">
        <HealthChip score={92} />
        <HealthChip score={71} />
        <HealthChip score={50} />
        <HealthChip score={39} />
        <HealthChip score={0} />
      </Demo>

      <Demo title="Diagnostic badges — Doc 2 §8">
        <Tag tone="warn">Slow growth</Tag>
        <Tag tone="warn">Under-carded</Tag>
        <Tag tone="bad">Brittle fluency</Tag>
        <Tag tone="neutral">Boredom zone</Tag>
        <Tag tone="ok">Ready to test</Tag>
        <Tag tone="accent">Next</Tag>
      </Demo>

      <Demo title="Diagnostic badge pills — Doc 2 §8">
        {Object.entries(BADGE_META).map(([id, meta]) => (
          <Badge key={id} badge={{ id: id as BadgeId, ...meta }} />
        ))}
      </Demo>

      <Demo title="Delta chip">
        <DeltaChip delta={4} />
        <DeltaChip delta={-6} />
        <DeltaChip delta={0} />
      </Demo>

      <Demo title="Status dots">
        <Dot retention={92} />
        <Dot retention={70} />
        <Dot retention={25} />
        <Dot retention={null} />
        <span style={{ fontSize: 'var(--fs-caption)', color: 'var(--ink-secondary)' }}>
          success · warning · danger · not started
        </span>
      </Demo>

      <Demo title="Segmented control">
        <SegmentedControl
          label="View"
          value={seg}
          onChange={setSeg}
          options={[
            { value: 'heatmap', label: 'Heatmap' },
            { value: 'list', label: 'List' },
          ]}
        />
        <span style={{ fontSize: 'var(--fs-caption)', color: 'var(--ink-secondary)' }}>
          selected: {seg} (arrow keys work)
        </span>
      </Demo>

      <Demo title="Progress ring">
        <ProgressRing value={92} />
        <ProgressRing value={55} />
        <ProgressRing value={22} />
      </Demo>

      <Demo title="Calibration indicator — Doc 2 §5">
        <div className="prop" style={{ borderRight: 'none' }}>
          <CalibrationIndicator oci={0.25} />
        </div>
        <div className="prop" style={{ borderRight: 'none' }}>
          <CalibrationIndicator oci={0.08} />
        </div>
        <div className="prop" style={{ borderRight: 'none' }}>
          <CalibrationIndicator oci={-0.3} />
        </div>
      </Demo>

      <div className="section">
        <div className="section-title">Retention row</div>
        <div className="section-sub">
          The `%` is always in text beside the bar — colour never carries the value alone (Doc 3 §6).
        </div>
        <Card className="list-card">
          <RetentionRow title="Basic syntax" retention={92} onReview={() => toast('Review started', 'info')} />
          <RetentionRow
            title="Control flow"
            retention={76}
            badges={[{ label: 'Slow growth', tone: 'warn' }]}
            onReview={() => toast('Review started', 'info')}
          />
          <RetentionRow
            title="Promises"
            retention={25}
            badges={[{ label: 'Brittle', tone: 'bad' }]}
            onReview={() => toast('Review started', 'info')}
          />
          <RetentionRow title="Never reviewed" retention={null} />
        </Card>
      </div>

      <div className="section">
        <div className="section-title">Hero ring — the §5.1 Overview hero</div>
        <div className="hero-row">
          <HeroRing eyebrow="Course health" value={92} caption="Across all active topics" />
          <HeroRing eyebrow="Course health" value={34} caption="Across all active topics" />
        </div>
      </div>

      <div className="section">
        <div className="section-title">Props row — column count follows the children</div>
        <p className="muted-note">
          Three props means three columns. The old fixed 4-column grid rendered a dead cell here.
        </p>
        <PropsRow>
          <Prop label="Study streak" value={6} caption="consecutive days" />
          <Prop label="This week" value={4} caption="sessions · ~3.5 hrs" />
          <Prop label="Mastery" value="41%" caption="7/17 topics mastered" />
        </PropsRow>
        <PropsRow>
          <Prop icon={<HealthIcon />} label="Health" value={92} caption="Optimal" />
          <Prop label="Calibration" value="+0.08" caption="Stable" />
          <Prop
            icon={<DueIcon />}
            label="Due review"
            accent
            after={<span className="live-dot live-pulse" />}
            value={12}
            caption="Due today"
          />
          <Prop label="Projected finish" value="—" caption="Not enough data yet" />
        </PropsRow>
      </div>

      <div className="section">
        <div className="section-title">Hero stat + sparkline</div>
        <div className="hero-row">
          <HeroStat eyebrow="Avg retention" value={64} caption="Past 30 days" delta={4}>
            <Sparkline data={demoSpark()} goal={80} />
          </HeroStat>
          <Card className="activity-card">
            <div className="activity-head">
              <Eyebrow>Study activity</Eyebrow>
              <div className="range">Last 90 days</div>
            </div>
            <ActivityCalendar days={demoActivity()} />
          </Card>
        </div>
      </div>

      <div className="section">
        <div className="section-title">Props row</div>
        <Card className="props-card">
          <div className="prop">
            <div className="prop-top">
              <HealthIcon />
              <span>Health</span>
            </div>
            <div className="prop-value mono-num">92</div>
            <div className="prop-caption">Optimal</div>
          </div>
          <div className="prop">
            <div className="prop-top">
              <HealthIcon />
              <span>Calibration</span>
            </div>
            <CalibrationIndicator oci={0.08} />
          </div>
          <div className="prop prop-due">
            <div className="prop-top">
              <DueIcon />
              <span>Due review</span>
              <span className="live-dot live-pulse" />
            </div>
            <div className="prop-value mono-num">12</div>
            <div className="prop-caption">
              Due today <span className="prop-sep">·</span>{' '}
              <a className="prop-action" href="#/study">
                Review now →
              </a>
            </div>
          </div>
          <div className="prop">
            <div className="prop-top">
              <DueIcon />
              <span>Projected finish</span>
            </div>
            <div className="prop-value mono-num">14–21</div>
            <div className="prop-caption">Oct window</div>
          </div>
        </Card>
      </div>

      <div className="section">
        <div className="section-title">Data table</div>
        <Card style={{ overflow: 'hidden' }}>
          <DataTable
            caption="Review history"
            getRowKey={(r) => r.date}
            columns={[
              { key: 'date', header: 'Date', render: (r) => r.date },
              { key: 'source', header: 'Source', render: (r) => r.source },
              { key: 'conf', header: 'Conf', numeric: true, render: (r) => r.conf },
              { key: 'strength', header: 'Strength', numeric: true, render: (r) => r.strength },
            ]}
            rows={[
              { date: '2026-07-14', source: 'session', conf: 4, strength: '1.30' },
              { date: '2026-07-09', source: 'test-pass', conf: 3, strength: '0.90' },
              { date: '2026-07-02', source: 'session', conf: 2, strength: '0.30' },
            ]}
          />
        </Card>
      </div>

      <Demo title="Toast">
        <SecondaryButton onClick={() => toast('Session logged')}>Success</SecondaryButton>
        <SecondaryButton onClick={() => toast("That JSON didn't validate", 'error')}>Error</SecondaryButton>
        <SecondaryButton onClick={() => toast('Review started', 'info')}>Info</SecondaryButton>
      </Demo>

      <Demo title="Sheet / modal">
        <SecondaryButton onClick={() => setSheetOpen(true)}>Open sheet</SecondaryButton>
        <span style={{ fontSize: 'var(--fs-caption)', color: 'var(--ink-secondary)' }}>
          Esc closes · focus is trapped · returns focus on close
        </span>
        <Sheet open={sheetOpen} title="Log session" onClose={() => setSheetOpen(false)}>
          <p style={{ fontSize: 'var(--fs-secondary)', color: 'var(--ink-secondary)' }}>
            Bottom sheet on mobile, centered modal on desktop. Resize to check.
          </p>
        </Sheet>
      </Demo>

      <div className="section">
        <div className="section-title">Empty state</div>
        <Card>
          <EmptyState
            icon={<AddIcon />}
            title="No courses yet. Add one to start tracking retention."
            action={<Button>Add tracker</Button>}
          />
        </Card>
      </div>
    </div>
  );
}
