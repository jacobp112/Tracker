import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { PasteValidateInput } from '@/components/PasteValidateInput';
import { COURSE_PROMPT } from '@/domain/prompts';
import { emptyStore } from '@/domain/types';

const VALID_COURSE = JSON.stringify({
  schema_version: '2.0.0',
  course_id: 'course_01J8ZX3K',
  title: 'Calculus I',
  created_at: '2026-07-01T09:00:00Z',
  source: 'ai_generated',
  sections: [
    {
      section_id: 'section_01J8ZX9P',
      title: 'Limits',
      order: 0,
      topics: [
        {
          topic_id: 'topic_01J8ZXA1',
          title: 'Chain rule',
          status: 'not_started',
          conf: 1,
          strength: 0,
          k_factor: 8.4,
          cards: 0,
          last_reviewed: null,
          drift_history: [],
          review_history: [],
          error_log: [],
        },
      ],
    },
  ],
});

function setup(onCommit = vi.fn()) {
  render(
    <PasteValidateInput
      schemaName="course"
      store={emptyStore()}
      prompt={COURSE_PROMPT}
      confirmLabel="Add course"
      onCommit={onCommit}
    />,
  );
  return { onCommit, user: userEvent.setup() };
}

async function paste(user: ReturnType<typeof userEvent.setup>, json: string) {
  const area = screen.getByLabelText(/paste the json/i);
  await user.click(area);
  await user.paste(json);
}

describe('PasteValidateInput — Document 3 §5.6 / E2-S4', () => {
  it('cannot check anything until something is pasted', () => {
    setup();
    expect(screen.getByRole('button', { name: /preview/i })).toBeDisabled();
  });

  it('previews before committing — never commits silently (§5.6 step 5)', async () => {
    const { onCommit, user } = setup();
    await paste(user, VALID_COURSE);
    await user.click(screen.getByRole('button', { name: /preview/i }));

    // Preview appears, and nothing has been committed yet.
    expect(screen.getByText('Calculus I — 1 section, 1 topic')).toBeInTheDocument();
    expect(onCommit).not.toHaveBeenCalled();

    await user.click(screen.getByRole('button', { name: /add course/i }));
    expect(onCommit).toHaveBeenCalledOnce();
  });

  it('shows structured plain-English errors on failure (§5.6 step 6)', async () => {
    const { onCommit, user } = setup();
    const bad = JSON.parse(VALID_COURSE);
    bad.sections[0].topics[0].conf = 105;
    await paste(user, JSON.stringify(bad));
    await user.click(screen.getByRole('button', { name: /preview/i }));

    expect(await screen.findByRole('alert')).toBeInTheDocument();
    expect(
      screen.getByText(
        "Topic 'Chain rule' has a confidence of 105 — confidence is a 1–5 rating, not a percentage.",
      ),
    ).toBeInTheDocument();
    expect(onCommit).not.toHaveBeenCalled();
  });

  it('marks the textarea invalid and links it to the errors for screen readers', async () => {
    const { user } = setup();
    await paste(user, '{ not json');
    await user.click(screen.getByRole('button', { name: /preview/i }));

    const area = screen.getByLabelText(/paste the json/i);
    expect(area).toHaveAttribute('aria-invalid', 'true');
    expect(area).toHaveAttribute('aria-describedby', 'paste-errors');
  });

  /**
   * A verdict must never outlive the text it was about — otherwise a user can
   * edit the JSON and commit a preview built from the previous content.
   */
  it('discards a stale preview when the text is edited', async () => {
    const { user } = setup();
    await paste(user, VALID_COURSE);
    await user.click(screen.getByRole('button', { name: /preview/i }));
    expect(screen.getByText('Calculus I — 1 section, 1 topic')).toBeInTheDocument();

    await user.type(screen.getByLabelText(/paste the json/i), ' ');

    expect(screen.queryByText('Calculus I — 1 section, 1 topic')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: /preview/i })).toBeInTheDocument();
  });

  it('lets the user step back from a preview without committing', async () => {
    const { onCommit, user } = setup();
    await paste(user, VALID_COURSE);
    await user.click(screen.getByRole('button', { name: /preview/i }));
    await user.click(screen.getByRole('button', { name: /back/i }));

    expect(screen.queryByText('Calculus I — 1 section, 1 topic')).not.toBeInTheDocument();
    expect(onCommit).not.toHaveBeenCalled();
  });

  it('shows the copy-the-prompt panel with the current v2.0.0 prompt', () => {
    setup();
    expect(screen.getByRole('button', { name: /copy prompt/i })).toBeInTheDocument();
    // The prompt and the schema must ship in lockstep (Doc 4 v0.3 changelog).
    expect(screen.getByText(/schema \(v2\.0\.0\)/i)).toBeInTheDocument();
  });
});
