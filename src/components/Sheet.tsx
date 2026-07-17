import { useRef, type ReactNode } from 'react';
import { useDialogChrome } from '@/hooks/useDialogChrome';
import { IconButton } from './primitives';

export interface SheetProps {
  open: boolean;
  title: string;
  onClose: () => void;
  children: ReactNode;
  footer?: ReactNode;
}

/**
 * Bottom-sheet on mobile, centered modal on desktop (Document 3 §3).
 * The responsive switch is CSS-only (see components.css); the dialog's keyboard
 * contract — focus in, trapped, restored, Escape to close — lives in
 * useDialogChrome, shared with the command palette.
 */
export function Sheet({ open, title, onClose, children, footer }: SheetProps) {
  const ref = useRef<HTMLDivElement>(null);
  useDialogChrome(open, onClose, ref);

  if (!open) return null;

  return (
    <div
      className="sheet-backdrop"
      onMouseDown={(e) => {
        // Only a click that both starts and ends on the backdrop dismisses —
        // a drag that ends outside a textarea shouldn't discard the user's input.
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="sheet" role="dialog" aria-modal="true" aria-label={title} ref={ref}>
        <div className="sheet-head">
          <h2>{title}</h2>
          <IconButton label="Close" onClick={onClose}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
              <path d="M6 6l12 12M18 6L6 18" />
            </svg>
          </IconButton>
        </div>
        <div className="sheet-body">{children}</div>
        {footer}
      </div>
    </div>
  );
}
