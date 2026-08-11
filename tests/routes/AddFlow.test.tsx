import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { AddFlow } from '@/routes/AddFlow';
import { ToastProvider } from '@/components/feedback';
import { coldAssessmentPrompt, examPrompt } from '@/domain/prompts';
import { emptyStore } from '@/domain/types';

function setup() {
  const store = emptyStore();
  render(
    <ToastProvider>
      <AddFlow
        kind="exam"
        store={store}
        commitValue={vi.fn(() => null)}
        undoLast={vi.fn(() => null)}
        onClose={vi.fn()}
      />
    </ToastProvider>,
  );
  const user = userEvent.setup();
  // Spy on the clipboard writeText that userEvent.setup() installs (navigator.clipboard
  // is a getter-only prop by then, so spy on it rather than reassigning).
  const writeText = vi.spyOn(navigator.clipboard, 'writeText').mockResolvedValue();
  return { store, user, writeText };
}

describe('AddFlow — cold-assessment entry point', () => {
  it('defaults the exam flow to the ordinary exam prompt', async () => {
    const { store, user, writeText } = setup();
    expect(screen.getByRole('button', { name: /exam result/i })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('button', { name: /cold check/i })).toHaveAttribute('aria-pressed', 'false');

    await user.click(screen.getByRole('button', { name: /copy the prompt/i }));
    expect(writeText).toHaveBeenCalledWith(examPrompt(store));
  });

  it('copies the cold-assessment prompt once Cold check is selected', async () => {
    const { store, user, writeText } = setup();
    await user.click(screen.getByRole('button', { name: /cold check/i }));

    expect(screen.getByRole('button', { name: /cold check/i })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByText(/run this cold/i)).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /copy the prompt/i }));
    expect(writeText).toHaveBeenCalledWith(coldAssessmentPrompt(store));
    // Sanity: the two prompts really do differ.
    expect(coldAssessmentPrompt(store)).not.toEqual(examPrompt(store));
  });
});
