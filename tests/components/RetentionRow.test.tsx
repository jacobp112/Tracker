import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { RetentionRow } from '@/components/RetentionRow';

describe('RetentionRow — Document 4 E4-S2', () => {
  it('always renders the % in text, not just as colour (Doc 3 §6)', () => {
    render(<RetentionRow title="Promises" retention={25} />);
    // The colour-independence requirement: the number must be readable text.
    expect(screen.getByText(/25%/)).toBeInTheDocument();
  });

  it('renders a never-reviewed topic as "—", never 0%', () => {
    render(<RetentionRow title="Untouched" retention={null} />);
    expect(screen.getByText('—')).toBeInTheDocument();
    expect(screen.queryByText(/0%/)).not.toBeInTheDocument();
  });

  it('rounds retention for display', () => {
    render(<RetentionRow title="Chain rule" retention={72.4} />);
    expect(screen.getByText(/72%/)).toBeInTheDocument();
  });

  it('renders diagnostic badges alongside the topic', () => {
    render(
      <RetentionRow
        title="Control flow"
        retention={76}
        badges={[{ label: 'Slow growth', tone: 'warn' }]}
      />,
    );
    expect(screen.getByText('Slow growth')).toBeInTheDocument();
  });

  it('exposes the Review action without a pointer', async () => {
    const onReview = vi.fn();
    render(<RetentionRow title="Promises" retention={25} onReview={onReview} />);
    await userEvent.click(screen.getByRole('button', { name: /review/i }));
    expect(onReview).toHaveBeenCalledOnce();
  });

  it('is keyboard-focusable and selectable via Enter', async () => {
    const onSelect = vi.fn();
    render(<RetentionRow title="Promises" retention={25} onSelect={onSelect} />);
    await userEvent.tab();
    expect(screen.getByRole('button', { name: 'Promises' })).toHaveFocus();
    await userEvent.keyboard('{Enter}');
    expect(onSelect).toHaveBeenCalled();
  });

  it('does not fire select when the Review action is used', async () => {
    const onSelect = vi.fn();
    const onReview = vi.fn();
    render(
      <RetentionRow title="Promises" retention={25} onSelect={onSelect} onReview={onReview} />,
    );
    await userEvent.click(screen.getByRole('button', { name: /review →/i }));
    expect(onReview).toHaveBeenCalledOnce();
    expect(onSelect).not.toHaveBeenCalled();
  });

  /**
   * Regression guard: an earlier cut marked the row itself role="button" while
   * nesting the Review button inside it — interactive content inside
   * interactive content, which is invalid ARIA and ambiguous to assistive tech.
   * Select and Review must stay two separate, unambiguous controls.
   */
  it('exposes select and review as two distinct, non-nested controls', () => {
    render(
      <RetentionRow title="Promises" retention={25} onSelect={vi.fn()} onReview={vi.fn()} />,
    );
    const select = screen.getByRole('button', { name: 'Promises' });
    const review = screen.getByRole('button', { name: /review →/i });
    expect(select).not.toContainElement(review);
    expect(review).not.toContainElement(select);
  });
});
