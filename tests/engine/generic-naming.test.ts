import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const MODULES = [
  'src/engine/performance.ts',
  'src/engine/performance-view.ts',
  'src/engine/prerequisites.ts',
  'src/routes/Performance.tsx',
];

// Whole-subject nouns that would signal a leaked assumption. NOT "difficulty"/
// "novelty"/"quality" (generic) — those are the whole point.
const FORBIDDEN = /\b(mathematics|mathematical|algebra|calculus|physics|chemistry|biology|geometry|arithmetic|trigonometry)\b/i;

/** Strip block and line comments so disclaimers like "NOT mathematics-specific"
 *  don't false-positive; we're checking code + string literals, not prose. */
function stripComments(src: string): string {
  return src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');
}

// Vitest runs from the repo root, so cwd resolves the src/ paths portably.
describe('generic-naming — no subject-specific assumption in the new modules', () => {
  it.each(MODULES)('%s contains no subject-specific vocabulary in its code', (rel) => {
    const src = stripComments(readFileSync(join(process.cwd(), rel), 'utf8'));
    const match = FORBIDDEN.exec(src);
    expect(match, match ? `found subject term "${match[0]}" in ${rel}` : '').toBeNull();
  });
});
