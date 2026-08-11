import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ToastProvider } from '@/components/feedback';
import { AuthProvider } from '@/auth/useAuth';
import { Settings } from '@/routes/Settings';
import { emptyStore, type Course, type Store } from '@/domain/types';

function course(id: string, title: string): Course {
  return {
    schema_version: '2.0.0',
    course_id: id,
    title,
    created_at: '2026-07-01T09:00:00Z',
    source: 'ai_generated',
    sections: [],
  };
}

function populated(): Store {
  return {
    ...emptyStore(),
    courses: [course('course_a', 'Linear Algebra'), course('course_b', 'Organic Chemistry')],
    exams: [
      {
        schema_version: '2.0.0',
        exam_id: 'exam_0000001',
        title: 'Midterm',
        date: '2026-07-15',
        linked_topic_ids: [],
        score: 8,
        max_score: 10,
      },
    ],
  };
}

function renderSettings(store: Store, clearStore = vi.fn(() => null)) {
  const replaceStore = vi.fn(() => null);
  render(
    <AuthProvider>
      <ToastProvider>
        <Settings store={store} replaceStore={replaceStore} clearStore={clearStore} />
      </ToastProvider>
    </AuthProvider>,
  );
  return { clearStore, replaceStore };
}

afterEach(() => vi.restoreAllMocks());

/*
 * Clearing wipes every session the user has logged, with no undo and no server
 * copy. The mockup arms the destructive button inline, only once the word
 * "clear" is typed — these tests pin that it cannot be satisfied by a reflex
 * click.
 */
describe('Settings — clearing all data (inline, type-to-arm)', () => {
  it('offers nothing to clear when the store is empty', () => {
    renderSettings(emptyStore());
    expect(screen.getByText(/nothing stored on this device yet/i)).toBeInTheDocument();
    // No armed control at all when there is nothing to destroy.
    expect(screen.queryByLabelText(/type clear to confirm/i)).not.toBeInTheDocument();
  });

  it('names exactly what is about to be destroyed, in the user’s own units', () => {
    renderSettings(populated());
    expect(screen.getByText(/2 courses and 1 exam/i)).toBeInTheDocument();
  });

  it('will not clear until the word is typed', async () => {
    const user = userEvent.setup();
    const { clearStore } = renderSettings(populated());
    const confirm = screen.getByRole('button', { name: 'Clear all data' });
    expect(confirm).toBeDisabled();
    await user.click(confirm);
    expect(clearStore).not.toHaveBeenCalled();
  });

  it('stays disarmed for a near-miss', async () => {
    const user = userEvent.setup();
    renderSettings(populated());
    await user.type(screen.getByLabelText(/type clear to confirm/i), 'clea');
    expect(screen.getByRole('button', { name: 'Clear all data' })).toBeDisabled();
  });

  it('clears once the word is typed', async () => {
    const user = userEvent.setup();
    const { clearStore } = renderSettings(populated());
    await user.type(screen.getByLabelText(/type clear to confirm/i), 'clear');
    const confirm = screen.getByRole('button', { name: 'Clear all data' });
    expect(confirm).toBeEnabled();
    await user.click(confirm);
    expect(clearStore).toHaveBeenCalledOnce();
  });

  it('offers the export escape hatch on the page', () => {
    renderSettings(populated());
    expect(screen.getByRole('button', { name: /export data/i })).toBeInTheDocument();
  });
});
