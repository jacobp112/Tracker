import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { setMedia } from '../setup';
import { ToastProvider } from '@/components/feedback';
import { Sheet } from '@/components/Sheet';
import { SegmentedControl } from '@/components/controls';
import { RetentionRow } from '@/components/RetentionRow';
import { useCountUp } from '@/hooks/useCountUp';
import { renderHook } from '@testing-library/react';

/**
 * E8-S3 — automated coverage of the Document 3 §6 accessibility floor.
 * The full checklist lives in docs/accessibility-audit.md; these pin the parts
 * that can regress silently.
 */

describe('§6 — colour is never the only signal', () => {
  it('retention always carries its number in text', () => {
    render(<RetentionRow title="Promises" retention={25} />);
    expect(screen.getByText(/25%/)).toBeInTheDocument();
  });
});

describe('§6 — keyboard operability', () => {
  it('segmented control moves selection with arrow keys', async () => {
    const onChange = vi.fn();
    render(
      <SegmentedControl
        label="View"
        value="a"
        onChange={onChange}
        options={[
          { value: 'a', label: 'A' },
          { value: 'b', label: 'B' },
        ]}
      />,
    );
    screen.getByRole('tab', { name: 'A' }).focus();
    await userEvent.keyboard('{ArrowRight}');
    expect(onChange).toHaveBeenCalledWith('b');
  });

  it('a selectable retention row is reachable and operable by keyboard', async () => {
    const onSelect = vi.fn();
    render(<RetentionRow title="Closures" retention={72} onSelect={onSelect} />);
    await userEvent.tab();
    expect(screen.getByRole('button', { name: 'Closures' })).toHaveFocus();
    await userEvent.keyboard('{Enter}');
    expect(onSelect).toHaveBeenCalled();
  });
});

describe('§6 — dialogs manage focus', () => {
  it('a sheet is a labelled modal dialog, moves focus in, and closes on Escape', async () => {
    const onClose = vi.fn();
    render(
      <ToastProvider>
        <Sheet open title="Log session" onClose={onClose}>
          <button>Inside</button>
        </Sheet>
      </ToastProvider>,
    );

    const dialog = screen.getByRole('dialog', { name: 'Log session' });
    expect(dialog).toHaveAttribute('aria-modal', 'true');
    // Focus moved into the dialog (the close button is the first focusable).
    expect(dialog.contains(document.activeElement)).toBe(true);

    await userEvent.keyboard('{Escape}');
    expect(onClose).toHaveBeenCalled();
  });
});

describe('§2.6 — prefers-reduced-motion is honoured', () => {
  it('count-up jumps straight to the final value under reduced motion', () => {
    setMedia({ '(prefers-reduced-motion: reduce)': true });
    const { result } = renderHook(() => useCountUp(64));
    // No animation frames: the value is final immediately, not 0.
    expect(result.current).toBe(64);
  });
});
