import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ToastProvider } from '@/components/feedback';
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
    runs: [
      {
        schema_version: '2.0.0',
        activity_id: 'activity_0000001',
        date: '2026-07-15',
        distance_km: 8,
        duration_seconds: 2400,
        pace_sec_per_km: 300,
        type: 'tempo',
      },
    ],
  };
}

function renderSettings(store: Store, clearStore = vi.fn(() => null)) {
  const replaceStore = vi.fn(() => null);
  render(
    <ToastProvider>
      <Settings store={store} replaceStore={replaceStore} clearStore={clearStore} />
    </ToastProvider>,
  );
  return { clearStore, replaceStore };
}

const openDialog = async (user: ReturnType<typeof userEvent.setup>) =>
  user.click(screen.getByRole('button', { name: 'Clear data' }));

afterEach(() => vi.restoreAllMocks());

/*
 * Clearing wipes every session the user has logged, with no undo and no server
 * copy. The friction here is the feature — these tests pin that it cannot be
 * satisfied by a reflex click.
 */
describe('Settings — clearing all data', () => {
  it('offers nothing to clear when the store is empty', () => {
    renderSettings(emptyStore());
    expect(screen.getByRole('button', { name: 'Clear data' })).toBeDisabled();
    expect(screen.getByText(/nothing stored on this device yet/i)).toBeInTheDocument();
  });

  it('names exactly what is about to be destroyed, in the user’s own units', async () => {
    const user = userEvent.setup();
    renderSettings(populated());
    await openDialog(user);

    const dialog = screen.getByRole('dialog', { name: /clear all data/i });
    expect(dialog).toHaveTextContent('2 courses and 1 run');
    // Domains with nothing in them are omitted rather than listed as zero.
    expect(dialog).not.toHaveTextContent(/0 exams|0 lifts/);
  });

  it('will not clear until the word is typed', async () => {
    const user = userEvent.setup();
    const { clearStore } = renderSettings(populated());
    await openDialog(user);

    const confirm = screen.getByRole('button', { name: 'Clear all data' });
    expect(confirm).toBeDisabled();

    await user.click(confirm);
    expect(clearStore).not.toHaveBeenCalled();
  });

  it('stays disarmed for a near-miss', async () => {
    const user = userEvent.setup();
    renderSettings(populated());
    await openDialog(user);

    await user.type(screen.getByLabelText(/type clear to confirm/i), 'clea');
    expect(screen.getByRole('button', { name: 'Clear all data' })).toBeDisabled();
  });

  it('clears once the word is typed', async () => {
    const user = userEvent.setup();
    const { clearStore } = renderSettings(populated());
    await openDialog(user);

    await user.type(screen.getByLabelText(/type clear to confirm/i), 'clear');
    const confirm = screen.getByRole('button', { name: 'Clear all data' });
    expect(confirm).toBeEnabled();

    await user.click(confirm);
    expect(clearStore).toHaveBeenCalledOnce();
  });

  it('does not reopen already armed after a cancel', async () => {
    const user = userEvent.setup();
    renderSettings(populated());

    await openDialog(user);
    await user.type(screen.getByLabelText(/type clear to confirm/i), 'clear');
    await user.click(screen.getByRole('button', { name: /keep my data/i }));

    await openDialog(user);
    expect(screen.getByLabelText(/type clear to confirm/i)).toHaveValue('');
    expect(screen.getByRole('button', { name: 'Clear all data' })).toBeDisabled();
  });

  it('offers the export escape hatch at the moment of danger', async () => {
    const user = userEvent.setup();
    renderSettings(populated());
    await openDialog(user);

    expect(
      screen.getByRole('button', { name: /export data first/i }),
    ).toBeInTheDocument();
  });

  it('closes on Escape without touching the data', async () => {
    const user = userEvent.setup();
    const { clearStore } = renderSettings(populated());
    await openDialog(user);

    await user.keyboard('{Escape}');
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(clearStore).not.toHaveBeenCalled();
  });
});
