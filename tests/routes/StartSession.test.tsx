import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { ToastProvider } from '@/components/feedback';
import { StartSession } from '@/routes/StartSession';
import type { Course, Section, Topic } from '@/domain/types';

const topic: Topic = { topic_id: 't', title: 'Elasticity', status: 'practising', conf: 4, strength: 1, k_factor: 8, cards: 0, last_reviewed: null, mastered_at: null, drift_history: [], review_history: [], error_log: [] };
const section: Section = { section_id: 's', title: 'Elasticity', order: 0, topics: [topic] };
const course: Course = { schema_version: '2.0.0', course_id: 'c', title: 'Micro', created_at: '', source: 'ai_generated', sections: [section] };

function setup(onBegin = vi.fn()) {
  render(<ToastProvider><StartSession course={course} section={section} topic={topic} onBegin={onBegin} onClose={vi.fn()} /></ToastProvider>);
  return onBegin;
}

describe('StartSession', () => {
  it('shows intent + scope choices and a briefing preview for the topic', () => {
    setup();
    expect(screen.getByRole('dialog', { name: /start session/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /remediate/i })).toBeInTheDocument();
    expect(screen.getByText(/Elasticity/)).toBeInTheDocument();
  });
  it('Begin focus reports the chosen intent + scope + timer', async () => {
    const user = userEvent.setup();
    const onBegin = setup();
    await user.click(screen.getByRole('button', { name: /retention/i }));
    await user.click(screen.getByRole('button', { name: /this topic/i }));
    await user.click(screen.getByRole('button', { name: /begin focus/i }));
    expect(onBegin).toHaveBeenCalledWith(expect.objectContaining({ intent: 'retention', scope: 'topic', timer_mode: expect.any(String) }));
  });
});
