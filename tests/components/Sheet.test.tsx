import { useState } from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { Sheet } from '@/components/Sheet';

/**
 * A caller shaped like a real one: onClose is an inline arrow (so its identity
 * changes every render) and the body holds state that re-renders the sheet on
 * every keystroke. This is the combination that broke focus.
 */
function TypingSheet({ onClose = () => {} }: { onClose?: () => void }) {
  const [value, setValue] = useState('');
  return (
    <Sheet open title="Confirm" onClose={() => onClose()}>
      <label htmlFor="f">Field</label>
      <input id="f" value={value} onChange={(e) => setValue(e.target.value)} />
    </Sheet>
  );
}

describe('Sheet — focus management', () => {
  /*
   * Regression: the focus effect used to depend on onClose. With an inline
   * arrow that identity changes each render, so the first keystroke re-ran the
   * effect and yanked focus to the Close button — every character after the
   * first was silently dropped.
   */
  it('keeps focus in the field while typing, across re-renders', async () => {
    const user = userEvent.setup();
    render(<TypingSheet />);

    const input = screen.getByLabelText('Field');
    await user.type(input, 'clear');

    expect(input).toHaveValue('clear');
    expect(input).toHaveFocus();
  });

  it('moves focus into the sheet when it opens', () => {
    render(<TypingSheet />);
    expect(document.activeElement).not.toBe(document.body);
    expect(screen.getByRole('dialog')).toContainElement(document.activeElement as HTMLElement);
  });

  it('closes on Escape', async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    render(<TypingSheet onClose={onClose} />);

    await user.keyboard('{Escape}');
    expect(onClose).toHaveBeenCalledOnce();
  });

  it('still reports the current onClose after a re-render', async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    render(<TypingSheet onClose={onClose} />);

    // Re-render first, then Escape — the listener must not be holding a stale
    // closure from the initial mount.
    await user.type(screen.getByLabelText('Field'), 'ab');
    await user.keyboard('{Escape}');

    expect(onClose).toHaveBeenCalledOnce();
  });
});
