/* ── Clipboard ─────────────────────────────────────────────────────
 * Copy text with the async Clipboard API where it exists, and fall back to the
 * legacy execCommand path where it doesn't (or where it exists but throws —
 * a denied permission, an insecure context, or a document that isn't focused
 * all reject rather than returning false).
 *
 * `nav` and `doc` are injectable so both paths can be exercised in tests
 * without a real browser; they default to the globals, so callers pass neither.
 */
export async function copyText(
  text: string,
  nav: Pick<Navigator, 'clipboard'> = navigator,
  doc: Document = document,
): Promise<boolean> {
  try {
    if (nav.clipboard?.writeText) {
      await nav.clipboard.writeText(text);
      return true;
    }
  } catch {
    // fall through to the legacy path
  }
  return legacyCopy(text, doc);
}

function legacyCopy(text: string, doc: Document): boolean {
  // Nothing to fall back TO if the deprecated command isn't implemented (jsdom,
  // and eventually browsers). Checked before we touch the DOM, so the failure
  // costs nothing and can't leave an element behind.
  if (typeof doc.execCommand !== 'function') return false;

  // select() moves focus into the textarea, and removing the element then drops
  // focus to <body>. A keyboard user who pressed Enter on the Copy button lost
  // their place in the document entirely; restored in the finally block.
  const previouslyFocused = doc.activeElement as HTMLElement | null;

  // Declared out here so the finally can always remove it. Previously ta.remove()
  // sat on the success path only, so a throw from execCommand left the 1px
  // readonly textarea in the DOM permanently.
  let ta: HTMLTextAreaElement | undefined;

  try {
    ta = doc.createElement('textarea');
    ta.value = text;

    // readOnly keeps iOS from raising the software keyboard for a field the
    // user never asked to edit. aria-hidden keeps the throwaway element out of
    // the accessibility tree for the frame it exists.
    ta.readOnly = true;
    ta.setAttribute('aria-hidden', 'true');
    ta.tabIndex = -1;

    // A real 1px box at a fixed origin, not a zero-height one: select() on a
    // collapsed off-screen element can scroll the page or silently no-op on
    // iOS Safari.
    ta.style.position = 'fixed';
    ta.style.top = '0';
    ta.style.left = '0';
    ta.style.width = '1px';
    ta.style.height = '1px';
    ta.style.padding = '0';
    ta.style.border = 'none';
    ta.style.opacity = '0';

    doc.body.appendChild(ta);
    ta.select();
    // iOS ignores select() on a readOnly field; an explicit range works.
    ta.setSelectionRange(0, text.length);
    return doc.execCommand('copy');
  } catch {
    return false;
  } finally {
    ta?.remove();
    // preventScroll: the textarea is fixed at the viewport origin, so restoring
    // focus without it can yank a reader back to the top of the page — the same
    // jump the whole 1px-box dance exists to avoid.
    previouslyFocused?.focus?.({ preventScroll: true });
  }
}
