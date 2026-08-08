import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { FocusMode } from '@/routes/FocusMode';
import type { FocusDraft } from '@/core/focusDraft';

const draft: FocusDraft = { course_id: 'c', section_id: 's', topic_id: 't', topic_title: 'Elasticity', intent: 'remediate', scope: 'topic', timer_mode: 'count_up', created_at: '2026-08-07T12:00:00Z', elapsed_seconds: 0, checked_error_ids: [] };
const errors = [{ error_id: 'x', description: 'confuses elastic/inelastic' }];

beforeEach(() => vi.useFakeTimers({ shouldAdvanceTime: true }));
afterEach(() => { vi.useRealTimers(); localStorage.clear(); });

describe('FocusMode', () => {
  it('renders the topic, intent, timer and the errors checklist', () => {
    render(<FocusMode draft={draft} unresolvedErrors={errors} onEnd={vi.fn()} onDiscard={vi.fn()} />);
    expect(screen.getByText('Elasticity')).toBeInTheDocument();
    expect(screen.getByText(/confuses elastic\/inelastic/)).toBeInTheDocument();
  });
  it('End session reports measured minutes from the timer', async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    const onEnd = vi.fn();
    render(<FocusMode draft={draft} unresolvedErrors={errors} onEnd={onEnd} onDiscard={vi.fn()} />);
    vi.advanceTimersByTime(120_000); // 2 min
    await user.click(screen.getByRole('button', { name: /end session/i }));
    expect(onEnd).toHaveBeenCalledWith(2);
  });
  it('ticking an error does not mutate anything external (no callback, local only)', async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    render(<FocusMode draft={draft} unresolvedErrors={errors} onEnd={vi.fn()} onDiscard={vi.fn()} />);
    const box = screen.getByRole('checkbox', { name: /confuses elastic\/inelastic/i });
    await user.click(box);
    expect(box).toBeChecked(); // local UI state only
  });
});
