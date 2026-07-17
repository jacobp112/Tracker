import { useEffect, useRef, type RefObject } from 'react';

const FOCUSABLE =
  'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])';

/**
 * The behaviour every modal surface owes the keyboard (Document 3 §6): focus
 * moves in on open, is trapped while open, returns to the opener on close, and
 * Escape dismisses.
 *
 * Extracted from Sheet so the command palette shares one implementation rather
 * than growing a second, subtly different copy — dialog focus handling is easy
 * to get slightly wrong in ways no test notices until a user is stuck.
 */
export function useDialogChrome(
  open: boolean,
  onClose: () => void,
  ref: RefObject<HTMLElement | null>,
): void {
  // Callers pass an inline arrow, so onClose's identity changes every render.
  // Holding it in a ref lets the effects below stay keyed on `open` alone.
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  /*
   * Focus in on open, restore on close.
   *
   * Keyed on `open` only, deliberately. Depending on onClose re-ran this on
   * every render, which re-focused the first element in the dialog — so any
   * dialog whose body re-rendered on keystroke (a typed confirmation, a search
   * field) lost focus after a single character.
   */
  useEffect(() => {
    if (!open) return;

    const restoreTo = document.activeElement as HTMLElement | null;
    ref.current?.querySelector<HTMLElement>(FOCUSABLE)?.focus();

    return () => restoreTo?.focus();
  }, [open, ref]);

  /* Escape to close, plus the Tab cycle. */
  useEffect(() => {
    if (!open) return;

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onCloseRef.current();
        return;
      }

      const node = ref.current;
      if (e.key !== 'Tab' || !node) return;

      // Re-queried per Tab rather than closed over, so controls that appear
      // while the dialog is open join the cycle.
      const items = Array.from(node.querySelectorAll<HTMLElement>(FOCUSABLE)).filter(
        (el) => !el.hasAttribute('disabled'),
      );
      if (items.length === 0) return;
      const first = items[0]!;
      const last = items[items.length - 1]!;

      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    };

    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [open, ref]);
}
