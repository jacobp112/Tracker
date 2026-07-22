import { useMemo, useState } from 'react';
import { SegmentedControl } from '@/components/controls';
import { EmptyState } from '@/components/feedback';
import { LineChart } from '@/components/LineChart';
import { Button, Card, Eyebrow, SecondaryButton, Tag } from '@/components/primitives';
import { usePreferences } from '@/hooks/usePreferences';
import type { Store } from '@/domain/types';
import {
  displayWeight,
  exerciseNames,
  formatPace,
  kgToLb,
  liftSeries,
  RUN_TYPES,
  runSeries,
  type RunType,
} from '@/engine/fitness';
import { navigate } from '@/router';
import { FitnessIcon } from '@/shell/icons';

function shortDate(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

function Running({ store }: { store: Store }) {
  const [filter, setFilter] = useState<RunType | 'all'>('all');
  const points = useMemo(
    () => runSeries(store, filter === 'all' ? undefined : filter),
    [store, filter],
  );

  const chartPoints = points.map((p) => ({ label: shortDate(p.date), value: p.paceSecPerKm }));
  const recent = [...store.runs].sort((a, b) => b.date.localeCompare(a.date));

  return (
    <>
      <Card className="panel panel-gap">
        <div className="activity-head">
          <Eyebrow>Pace trend</Eyebrow>
          <SegmentedControl<RunType | 'all'>
            label="Filter runs by type"
            value={filter}
            onChange={setFilter}
            options={[
              { value: 'all', label: 'All' },
              ...RUN_TYPES.map((t) => ({ value: t, label: t[0]!.toUpperCase() + t.slice(1) })),
            ]}
          />
        </div>
        {/* Faster is a smaller pace, so invert so up = improvement. */}
        <LineChart
          points={chartPoints}
          invertBetter
          formatValue={(v) => `${formatPace(v)}/km`}
          ariaLabel="Running pace over time, faster is higher"
        />
      </Card>

      <div className="group-label">Recent runs</div>
      <Card className="list-card">
        {recent.map((r) => (
          <div className="row" key={r.activity_id}>
            <div className="row-left">
              <Tag tone="neutral">{r.type}</Tag>
              <span className="topic">{shortDate(r.date)}</span>
            </div>
            <div className="row-right">
              <span className="pct auto">
                {r.distance_km} km
              </span>
              <span className="pct auto mono-num">
                {formatPace(r.pace_sec_per_km)}/km
              </span>
            </div>
          </div>
        ))}
      </Card>
    </>
  );
}

function Lifting({ store }: { store: Store }) {
  const { prefs, setWeightUnit } = usePreferences();
  const names = useMemo(() => exerciseNames(store), [store]);
  const [selected, setSelected] = useState<string | null>(names[0] ?? null);

  const active = selected && names.includes(selected) ? selected : (names[0] ?? null);
  const series = useMemo(() => (active ? liftSeries(store, active) : []), [store, active]);

  if (names.length === 0) {
    return (
      <Card>
        <EmptyState icon={<FitnessIcon />} title="No lifts logged yet. Log a session to see progression." />
      </Card>
    );
  }

  const toDisplay = (kg: number) => (prefs.weightUnit === 'kg' ? kg : kgToLb(kg));

  return (
    <>
      <Card className="panel panel-gap">
        <div className="activity-head">
          <Eyebrow>Estimated 1RM · {active}</Eyebrow>
          <SegmentedControl<'kg' | 'lb'>
            label="Weight unit"
            value={prefs.weightUnit}
            onChange={setWeightUnit}
            options={[
              { value: 'kg', label: 'kg' },
              { value: 'lb', label: 'lb' },
            ]}
          />
        </div>
        {/* Per-set est-1RM, not a flat total (Document 1 §5.2). */}
        <LineChart
          points={series.map((p) => ({ label: shortDate(p.date), value: toDisplay(p.est1RmKg) }))}
          formatValue={(v) => `${Math.round(v)} ${prefs.weightUnit}`}
          ariaLabel={`Estimated one-rep max for ${active} over time`}
        />
      </Card>

      <div className="group-label">Exercises</div>
      <Card className="list-card">
        {names.map((name) => {
          const points = liftSeries(store, name);
          const latest = points[points.length - 1];
          return (
            <div className="row" key={name}>
              <div className="row-left">
                <button
                  className={`topic topic-btn ${name === active ? '' : ''}`}
                  onClick={() => setSelected(name)}
                  style={name === active ? { color: 'var(--accent)', fontWeight: 600 } : undefined}
                >
                  {name}
                </button>
              </div>
              <div className="row-right">
                {latest && (
                  <span className="pct auto mono-num">
                    top {displayWeight(latest.topSetKg, prefs.weightUnit)}
                  </span>
                )}
              </div>
            </div>
          );
        })}
      </Card>
    </>
  );
}

/**
 * Fitness screen — Document 3 §5.5, Document 4 E6.
 * Running and Lifting, each progression trends only (fitness has no decay
 * model, Document 2). Visually lighter than the study dashboard by design.
 */
export function Fitness({ store }: { store: Store }) {
  const [tab, setTab] = useState<'running' | 'lifting'>('running');
  const empty = store.runs.length === 0 && store.lifts.length === 0;

  return (
    <div className="content">
      <div className="page-head split reveal" style={{ ['--i' as string]: 0 }}>
        <div>
          <h1>Fitness</h1>
          <p>Running and lifting progression.</p>
        </div>
        <div className="cluster">
          <SecondaryButton onClick={() => navigate('/fitness/add-run')}>+ Log run</SecondaryButton>
          <Button onClick={() => navigate('/fitness/add-lift')}>+ Log lift</Button>
        </div>
      </div>

      {empty ? (
        <div className="section reveal" style={{ ['--i' as string]: 1 }}>
          <Card>
            <EmptyState
              icon={<FitnessIcon />}
              title="No activities yet. Log a run or a lift to see trends."
              action={<Button onClick={() => navigate('/fitness/add-run')}>Log a run</Button>}
            />
          </Card>
        </div>
      ) : (
        <div className="section reveal" style={{ ['--i' as string]: 1 }}>
          <div className="panel-gap">
            <SegmentedControl
              label="Fitness view"
              value={tab}
              onChange={setTab}
              options={[
                { value: 'running', label: 'Running' },
                { value: 'lifting', label: 'Lifting' },
              ]}
            />
          </div>
          {tab === 'running' ? <Running store={store} /> : <Lifting store={store} />}
        </div>
      )}
    </div>
  );
}
