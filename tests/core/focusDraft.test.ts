import { afterEach, describe, expect, it } from 'vitest';
import { clearFocusDraft, loadFocusDraft, saveFocusDraft, FOCUS_DRAFT_KEY, type FocusDraft } from '@/core/focusDraft';

const draft: FocusDraft = {
  course_id: 'c', section_id: 's', topic_id: 't', topic_title: 'T',
  intent: 'remediate', scope: 'topic', timer_mode: 'count_up',
  created_at: '2026-08-07T12:00:00Z', elapsed_seconds: 42, checked_error_ids: ['x'],
};
afterEach(() => localStorage.clear());

describe('focusDraft', () => {
  it('round-trips a draft', () => { saveFocusDraft(draft); expect(loadFocusDraft()).toEqual(draft); });
  it('returns null when absent', () => { expect(loadFocusDraft()).toBeNull(); });
  it('clears', () => { saveFocusDraft(draft); clearFocusDraft(); expect(loadFocusDraft()).toBeNull(); });
  it('returns null on corrupt JSON rather than throwing', () => {
    localStorage.setItem(FOCUS_DRAFT_KEY, '{not json');
    expect(loadFocusDraft()).toBeNull();
  });
});
