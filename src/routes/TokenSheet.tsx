import { Card } from '@/components/primitives';

/**
 * E1-S1 acceptance criterion: "A visible token sheet dev route renders every
 * token for QA." Reads the *computed* value of each token rather than a
 * hardcoded copy, so it stays honest across theme flips — if a token is
 * missing in one theme, it shows up blank here.
 */

const COLOR_TOKENS = [
  '--ink', '--ink-secondary', '--ink-muted',
  '--bg-page', '--bg-sidebar', '--surface', '--surface-sunken',
  '--border', '--border-strong', '--edge', '--edge-strong',
  '--accent', '--accent-2', '--accent-soft', '--accent-ring',
  '--success', '--success-soft', '--warning', '--warning-soft', '--danger', '--danger-soft',
  '--track',
  '--cell-0', '--cell-1', '--cell-2', '--cell-3', '--cell-4',
  '--wash-1', '--wash-2',
];

const TYPE_TOKENS = [
  '--fs-hero', '--fs-title', '--fs-prop', '--fs-section', '--fs-brand', '--fs-body',
  '--fs-row', '--fs-nav', '--fs-secondary', '--fs-sub', '--fs-caption', '--fs-eyebrow',
  '--fs-micro', '--fs-nano',
];

const SPACE_TOKENS = [
  '--space-1', '--space-2', '--space-3', '--space-4', '--space-5', '--space-6', '--space-7',
  '--space-8', '--space-9', '--space-10', '--space-11', '--space-12', '--space-13', '--space-14',
];

const RADIUS_TOKENS = ['--radius-lg', '--radius-md', '--radius-sm', '--radius-chip', '--radius-pill'];
const SHADOW_TOKENS = ['--shadow-card', '--shadow-card-hover', '--shadow-hero'];
const MOTION_TOKENS = [
  '--ease', '--spring', '--dur-micro', '--dur-standard', '--dur-theme', '--dur-reveal',
  '--dur-data', '--dur-draw', '--reveal-step',
];

function value(token: string): string {
  return getComputedStyle(document.documentElement).getPropertyValue(token).trim();
}

function Row({ token, swatch }: { token: string; swatch?: 'color' | 'radius' | 'shadow' | 'space' }) {
  const v = value(token);
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 'var(--space-6)',
        padding: '10px 0',
        borderBottom: '1px solid var(--border)',
      }}
    >
      {swatch === 'color' && (
        <span
          style={{
            width: 34, height: 34, borderRadius: 8, flexShrink: 0,
            background: `var(${token})`,
            border: '1px solid var(--border)',
          }}
        />
      )}
      {swatch === 'radius' && (
        <span
          style={{
            width: 34, height: 34, flexShrink: 0,
            borderRadius: `var(${token})`,
            background: 'var(--accent-soft)',
            border: '1px solid var(--accent)',
          }}
        />
      )}
      {swatch === 'shadow' && (
        <span
          style={{
            width: 34, height: 34, borderRadius: 10, flexShrink: 0,
            background: 'var(--surface)',
            boxShadow: `var(${token})`,
          }}
        />
      )}
      {swatch === 'space' && (
        <span
          style={{
            width: `var(${token})`, height: 16, flexShrink: 0,
            background: 'var(--accent)', borderRadius: 2,
          }}
        />
      )}
      <code style={{ fontFamily: 'var(--font-mono)', fontSize: 'var(--fs-sub)', minWidth: 190 }}>
        {token}
      </code>
      <span
        className="mono-num"
        style={{ fontSize: 'var(--fs-eyebrow)', color: 'var(--ink-secondary)', wordBreak: 'break-all' }}
      >
        {v || '— (unset in this theme)'}
      </span>
    </div>
  );
}

function Group({
  title,
  tokens,
  swatch,
}: {
  title: string;
  tokens: string[];
  swatch?: 'color' | 'radius' | 'shadow' | 'space';
}) {
  return (
    <div className="section">
      <div className="section-title">{title}</div>
      <Card style={{ padding: '4px 22px' }}>
        {tokens.map((t) => (
          <Row key={t} token={t} swatch={swatch} />
        ))}
      </Card>
    </div>
  );
}

export function TokenSheet() {
  return (
    <div className="content">
      <div className="page-head">
        <h1>Token sheet</h1>
        <p>
          Every Document 3 §2 token, read from its computed value. Toggle the theme to verify both
          themes resolve with no gaps.
        </p>
      </div>

      <Group title="Colour" tokens={COLOR_TOKENS} swatch="color" />
      <Group title="Typography" tokens={TYPE_TOKENS} />
      <Group title="Spacing" tokens={SPACE_TOKENS} swatch="space" />
      <Group title="Radius" tokens={RADIUS_TOKENS} swatch="radius" />
      <Group title="Elevation" tokens={SHADOW_TOKENS} swatch="shadow" />
      <Group title="Motion" tokens={MOTION_TOKENS} />

      <div className="section">
        <div className="section-title">Type scale</div>
        <Card style={{ padding: 'var(--space-11)' }}>
          {[
            ['--fs-hero', 'Hero number', 'mono-num'],
            ['--fs-title', 'Page title', ''],
            ['--fs-section', 'Section title', ''],
            ['--fs-prop', 'Prop value', 'mono-num'],
            ['--fs-body', 'Body', ''],
            ['--fs-secondary', 'Secondary', ''],
            ['--fs-caption', 'Caption', ''],
          ].map(([token, label, cls]) => (
            <div
              key={token}
              className={cls}
              style={{
                fontSize: `var(${token})`,
                lineHeight: 1.2,
                padding: '6px 0',
                letterSpacing: token === '--fs-hero' ? '-0.04em' : undefined,
                fontWeight: token === '--fs-hero' || token === '--fs-title' ? 700 : 400,
              }}
            >
              {label} 1234567890
            </div>
          ))}
        </Card>
      </div>
    </div>
  );
}
