import type { Badge as BadgeModel } from '@/engine/metrics';
import { BadgeBadIcon, BadgeOkIcon, BadgeWarnIcon } from '@/shell/icons';

/**
 * A diagnostic badge (Document 2 §8) as a tokenized pill.
 *
 * Tone → semantic stop, which the CSS resolves to a soft-fill background and a
 * matching ink (`.badge.ok` → --success-soft / --success, and so on):
 *   ok → success,  warn → warning,  bad → danger.
 * The glyph is a hand-drawn inline SVG in currentColor, so it inherits the tone
 * ink for free; shape plus colour keeps the tone legible without relying on
 * colour alone (Document 3 §6). The full meaning rides along as the title.
 */
const TONE_GLYPH: Record<BadgeModel['tone'], () => JSX.Element> = {
  ok: BadgeOkIcon,
  warn: BadgeWarnIcon,
  bad: BadgeBadIcon,
};

export function Badge({ badge }: { badge: BadgeModel }) {
  const Glyph = TONE_GLYPH[badge.tone];
  return (
    <span className={`badge ${badge.tone}`} title={badge.meaning}>
      <span className="badge-glyph" aria-hidden="true">
        <Glyph />
      </span>
      <span className="badge-label">{badge.label}</span>
    </span>
  );
}
