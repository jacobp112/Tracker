import { render, screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { Badge } from '@/components/Badge';
import { BADGE_META, type Badge as BadgeModel, type BadgeId } from '@/engine/metrics';

const make = (id: BadgeId): BadgeModel => ({ id, ...BADGE_META[id] });

describe('Badge — diagnostic pill', () => {
  it('renders the badge label', () => {
    render(<Badge badge={make('slow_growth')} />);
    expect(screen.getByText('Slow growth')).toBeInTheDocument();
  });

  it('carries the tone as a class so the CSS resolves the stop', () => {
    const { container } = render(<Badge badge={make('ready_to_test')} />);
    expect(container.querySelector('.badge')).toHaveClass('ok');
  });

  it('maps each tone to its stop class (ok/warn/bad)', () => {
    for (const id of Object.keys(BADGE_META) as BadgeId[]) {
      const { container } = render(<Badge badge={make(id)} />);
      const pill = container.querySelector('.badge')!;
      expect(pill).toHaveClass(BADGE_META[id].tone);
    }
  });

  it('exposes the full meaning as the title, for the terse label', () => {
    render(<Badge badge={make('brittle_fluency')} />);
    expect(screen.getByText('Brittle fluency').closest('.badge')).toHaveAttribute(
      'title',
      BADGE_META.brittle_fluency.meaning,
    );
  });

  it('marks the glyph decorative — colour is never the only signal (§6)', () => {
    const { container } = render(<Badge badge={make('slow_growth')} />);
    // The glyph is aria-hidden; the label text carries the meaning.
    const glyph = container.querySelector('.badge-glyph')!;
    expect(glyph).toHaveAttribute('aria-hidden', 'true');
    expect(within(container.querySelector('.badge')!).getByText('Slow growth')).toBeInTheDocument();
  });

  it('renders an inline SVG glyph, not imported art', () => {
    const { container } = render(<Badge badge={make('brittle_fluency')} />);
    expect(container.querySelector('.badge-glyph svg')).toBeInTheDocument();
    expect(container.querySelector('img')).not.toBeInTheDocument();
  });
});
