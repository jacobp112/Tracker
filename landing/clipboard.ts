export async function copyText(
  text: string,
  nav: Pick<Navigator, 'clipboard'> = navigator,
): Promise<boolean> {
  try {
    if (nav.clipboard?.writeText) {
      await nav.clipboard.writeText(text);
      return true;
    }
  } catch {
    // fall through to the legacy path
  }
  return legacyCopy(text);
}

function legacyCopy(text: string): boolean {
  // select() moves focus into the textarea, and removing the element then drops
  // focus to <body>. A keyboard user who pressed Enter on the Copy button lost
  // their place in the document entirely; restored in the finally block.
  const previouslyFocused = document.activeElement as HTMLElement | null;

  try {
    const ta = document.createElement('textarea');
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

    document.body.appendChild(ta);
    ta.select();
    // iOS ignores select() on a readOnly field; an explicit range works.
    ta.setSelectionRange(0, text.length);
    const ok = document.execCommand('copy');
    ta.remove();
    return ok;
  } catch {
    return false;
  } finally {
    previouslyFocused?.focus?.();
  }
}
