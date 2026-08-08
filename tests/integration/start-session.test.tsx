import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import App from '@/App';
import { AuthProvider } from '@/auth/useAuth';
import { STORE_KEY } from '@/core/storage';
import { emptyStore, type Course, type Store, type Topic } from '@/domain/types';

function seeded(): Store {
  const topic: Topic = { topic_id: 'topic_x', title: 'Elasticity', status: 'practising', conf: 4, strength: 1, k_factor: 8, cards: 0, last_reviewed: '2026-08-01T00:00:00Z', mastered_at: null, drift_history: [], review_history: [], error_log: [] };
  const course: Course = { schema_version: '2.0.0', course_id: 'course_x', title: 'Micro', created_at: '2026-07-01T00:00:00Z', source: 'ai_generated', sections: [{ section_id: 'sec_x', title: 'Elasticity', order: 0, topics: [topic] }] };
  return { ...emptyStore(), courses: [course] };
}
beforeEach(() => { localStorage.clear(); localStorage.setItem(STORE_KEY, JSON.stringify(seeded())); });
afterEach(() => localStorage.clear());

describe('start session flow', () => {
  it('opens the setup modal from the topic drawer', async () => {
    const user = userEvent.setup();
    window.location.hash = '#/course/course_x';
    render(<AuthProvider><App /></AuthProvider>);
    await user.click(screen.getByRole('button', { name: /elasticity/i })); // open topic drawer
    await user.click(screen.getByRole('button', { name: /start session/i }));
    expect(screen.getByRole('dialog', { name: /start session/i })).toBeInTheDocument();
  });
});
