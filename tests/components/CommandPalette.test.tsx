import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import App from '@/App';
import { STORE_KEY } from '@/core/storage';
import { SHORTCUT_LABEL } from '@/hooks/useCommandShortcut';
import { emptyStore, type Course, type Store, type Topic } from '@/domain/types';

function topic(id: string, title: string): Topic {
  return {
    topic_id: id,
    title,
    status: 'practising',
    conf: 3,
    strength: 1.2,
    k_factor: 7.5,
    cards: 1,
    last_reviewed: '2026-07-14T12:00:00Z',
    mastered_at: null,
    drift_history: [],
    review_history: [],
    error_log: [],
  };
}

function populated(): Store {
  const course: Course = {
    schema_version: '2.0.0',
    course_id: 'course_alg0001',
    title: 'Linear Algebra',
    created_at: '2026-07-01T09:00:00Z',
    source: 'ai_generated',
    sections: [
      {
        section_id: 'section_vec001',
        title: 'Vectors',
        order: 0,
        topics: [topic('topic_eig00001', 'Eigenvalues'), topic('topic_dot00001', 'Dot product')],
      },
    ],
  };
  return { ...emptyStore(), courses: [course] };
}

beforeEach(() => {
  localStorage.clear();
  localStorage.setItem(STORE_KEY, JSON.stringify(populated()));
  window.location.hash = '#/overview';
});
afterEach(() => localStorage.clear());

const open = async (user: ReturnType<typeof userEvent.setup>) => {
  await user.keyboard('{Control>}k{/Control}');
  return screen.getByRole('dialog', { name: /command palette/i });
};

/*
 * The palette replaced a search box that rendered a ⌘K keycap and did nothing.
 * These pin that the control now does what it advertises.
 */
describe('CommandPalette — opening', () => {
  it('opens on the keyboard shortcut', async () => {
    const user = userEvent.setup();
    render(<App />);
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();

    await open(user);
    expect(screen.getByRole('dialog', { name: /command palette/i })).toBeInTheDocument();
  });

  it('opens from the sidebar search row', async () => {
    const user = userEvent.setup();
    render(<App />);

    // Name composed from the visible label + keycap, so it is platform-specific.
    await user.click(screen.getByRole('button', { name: `Search ${SHORTCUT_LABEL}` }));
    expect(screen.getByRole('dialog', { name: /command palette/i })).toBeInTheDocument();
  });

  it('opens from the topbar, which is the only entry point that survives on mobile', async () => {
    const user = userEvent.setup();
    render(<App />);

    await user.click(screen.getByRole('button', { name: `Search (${SHORTCUT_LABEL})` }));
    expect(screen.getByRole('dialog', { name: /command palette/i })).toBeInTheDocument();
  });

  it('advertises a keycap that matches the key that actually works', async () => {
    const user = userEvent.setup();
    render(<App />);

    // The old shell drew "⌘K" on every platform, including Windows.
    expect(screen.getByRole('button', { name: `Search ${SHORTCUT_LABEL}` })).toBeInTheDocument();

    await open(user);
    expect(screen.getByRole('dialog', { name: /command palette/i })).toBeInTheDocument();
  });

  it('puts the caret straight in the field — no click needed', async () => {
    const user = userEvent.setup();
    render(<App />);
    await open(user);

    expect(screen.getByRole('combobox')).toHaveFocus();
  });

  it('closes on Escape', async () => {
    const user = userEvent.setup();
    render(<App />);
    await open(user);

    await user.keyboard('{Escape}');
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });
});

describe('CommandPalette — before you type', () => {
  it('suggests actions rather than an empty box', async () => {
    const user = userEvent.setup();
    render(<App />);
    const dialog = await open(user);

    expect(within(dialog).getByRole('option', { name: /add a course/i })).toBeInTheDocument();
  });
});

describe('CommandPalette — searching', () => {
  it('filters to a matching topic as you type', async () => {
    const user = userEvent.setup();
    render(<App />);
    const dialog = await open(user);

    await user.type(screen.getByRole('combobox'), 'eig');

    expect(within(dialog).getByRole('option', { name: /eigenvalues/i })).toBeInTheDocument();
    expect(within(dialog).queryByRole('option', { name: /add a course/i })).not.toBeInTheDocument();
  });

  it('keeps every keystroke — the field does not lose focus mid-word', async () => {
    const user = userEvent.setup();
    render(<App />);
    await open(user);

    const input = screen.getByRole('combobox');
    await user.type(input, 'eigen');
    expect(input).toHaveValue('eigen');
    expect(input).toHaveFocus();
  });

  it('says so when nothing matches, instead of showing a silent empty list', async () => {
    const user = userEvent.setup();
    render(<App />);
    const dialog = await open(user);

    await user.type(screen.getByRole('combobox'), 'zzzznope');

    expect(within(dialog).getByText(/no matches for/i)).toBeInTheDocument();
    expect(within(dialog).queryAllByRole('option')).toHaveLength(0);
  });
});

describe('CommandPalette — running a result', () => {
  it('navigates to the topic’s course on Enter', async () => {
    const user = userEvent.setup();
    render(<App />);
    await open(user);

    await user.type(screen.getByRole('combobox'), 'eig');
    await user.keyboard('{Enter}');

    expect(window.location.hash).toBe('#/course/course_alg0001');
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('navigates on click', async () => {
    const user = userEvent.setup();
    render(<App />);
    const dialog = await open(user);

    await user.type(screen.getByRole('combobox'), 'add a course');
    await user.click(within(dialog).getByRole('option', { name: /add a course/i }));

    expect(window.location.hash).toBe('#/study/add');
  });

  it('moves the selection with the arrow keys without leaving the field', async () => {
    const user = userEvent.setup();
    render(<App />);
    const dialog = await open(user);

    const first = within(dialog).getAllByRole('option')[0]!;
    expect(first).toHaveAttribute('aria-selected', 'true');

    await user.keyboard('{ArrowDown}');

    const options = within(dialog).getAllByRole('option');
    expect(options[0]).toHaveAttribute('aria-selected', 'false');
    expect(options[1]).toHaveAttribute('aria-selected', 'true');
    // Selection is aria-activedescendant, so focus must stay put.
    expect(screen.getByRole('combobox')).toHaveFocus();
  });

  it('points aria-activedescendant at the selected row', async () => {
    const user = userEvent.setup();
    render(<App />);
    const dialog = await open(user);

    const input = screen.getByRole('combobox');
    const selectedId = within(dialog)
      .getAllByRole('option')
      .find((o) => o.getAttribute('aria-selected') === 'true')!.id;

    expect(input).toHaveAttribute('aria-activedescendant', selectedId);
  });

  it('starts each open fresh rather than remembering the last query', async () => {
    const user = userEvent.setup();
    render(<App />);
    await open(user);
    await user.type(screen.getByRole('combobox'), 'eig');
    await user.keyboard('{Escape}');

    await open(user);
    expect(screen.getByRole('combobox')).toHaveValue('');
  });
});
