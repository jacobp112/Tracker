import './how.css';
import { setupHowSequence } from './scrub';
import { copyText } from './clipboard';

/* ── How-it-works behaviour ───────────────────────────────────────
 * The pinned, scrubbed four-beat sequence, plus the real Copy button.
 *
 * setupHowSequence unpins and paints the final frame under reduced motion or a
 * narrow viewport (matching the CSS/no-JS fallback), so the story is always
 * readable, scrub or not.
 *
 * The Copy button copies the FULL prompt from the <template>, not the visible
 * excerpt — the excerpt ends mid-schema, so copying it handed the user a prompt
 * their AI cannot satisfy. Note the .content read: a <template>'s parsed
 * children live in its DocumentFragment, so tpl.textContent is empty. The
 * outcome goes in the role="status" region, not the button's own label, so a
 * screen reader hears a result rather than the focused control being renamed. */
export function initHow(reducedMotion: boolean): void {
  const howSection = document.getElementById('how');
  if (howSection) setupHowSequence(howSection, { reducedMotion });

  const copyBtn = document.getElementById('copy-prompt');
  const promptFull = document.getElementById('prompt-full') as HTMLTemplateElement | null;
  const copyStatus = document.getElementById('copy-status');
  if (!copyBtn || !promptFull) return;

  const prompt = promptFull.content.textContent?.trim() ?? '';
  let resetTimer: number | undefined;

  copyBtn.addEventListener('click', async () => {
    const ok = prompt.length > 0 && (await copyText(prompt));
    if (copyStatus) {
      copyStatus.textContent = ok
        ? 'Copied'
        : 'Copy blocked by your browser — select the prompt and copy it manually.';
      copyStatus.classList.toggle('is-error', !ok);
    }
    window.clearTimeout(resetTimer);
    resetTimer = window.setTimeout(() => {
      if (copyStatus) {
        copyStatus.textContent = '';
        copyStatus.classList.remove('is-error');
      }
    }, 4000);
  });
}
