import { useCallback, useEffect, useState } from 'react';
import { commit } from '@/core/pipeline';
import { mergeInto } from '@/core/merge';
import { cloneStore, loadStore, saveStore, StorageError } from '@/core/storage';
import type { SchemaName } from '@/domain/schemas';
import {
  allTopics,
  emptyStore,
  type Confidence,
  type ReviewEvent,
  type SessionRecord,
  type Store,
  type TopicStatus,
} from '@/domain/types';
import { makeId } from '@/core/merge';
import { levelUps, type LevelUp } from '@/engine/leveling';
import { applyEvent, promote } from '@/engine/recalculate';

/**
 * Owns the live store. Commits go through the pipeline's clone-then-swap
 * (Document 4 E2-S4): the draft is only adopted once the merge and the write
 * have both succeeded, so a throw anywhere leaves state untouched.
 */
export function useStore() {
  const [store, setStore] = useState<Store>(emptyStore);
  const [loadError, setLoadError] = useState<string | null>(null);
  // Single-level undo for paste commits. Holds the pre-commit store for one
  // toast lifetime — not a history stack, just the "oops" escape hatch.
  const [undoSnapshot, setUndoSnapshot] = useState<Store | null>(null);

  useEffect(() => {
    try {
      setStore(loadStore());
    } catch (e) {
      // No silent failures (Document 4 DoD §9).
      setLoadError(e instanceof StorageError ? e.message : 'Your saved data could not be read.');
    }
  }, []);

  /** Returns null on success, or a plain-English message on failure. */
  const commitValue = useCallback(
    (schemaName: SchemaName, value: unknown, onLevelUps?: (ups: LevelUp[]) => void): string | null => {
      try {
        const next = commit(schemaName, value, store, mergeInto);
        saveStore(next); // throws before we adopt the draft
        setUndoSnapshot(store); // the pre-commit state, for the toast's Undo
        setStore(next);
        // Level-up detection is cosmetic: it runs only after the commit has
        // persisted and been adopted, and its own failure must never surface as a
        // save error (the save already succeeded).
        try {
          onLevelUps?.(levelUps(store, next, new Date()));
        } catch {
          /* a failed celebratory toast is not a failed commit */
        }
        return null;
      } catch (e) {
        if (e instanceof StorageError) return e.message;
        return e instanceof Error
          ? `That couldn't be saved: ${e.message}. Your existing data is unchanged.`
          : "That couldn't be saved. Your existing data is unchanged.";
      }
    },
    [store],
  );

  /**
   * Commit a session: the pasted JSON goes through the normal pipeline (same
   * merge/save/adopt path as `commitValue`), and a `SessionRecord` is appended
   * in the SAME persisted update — one save, one adopted draft, so the two
   * never drift apart. The AI-supplied JSON is never the source of the stored
   * duration: `duration_minutes` comes only from `meta.measured_minutes`, the
   * real timer-measured value, never from `value`.
   */
  const commitSession = useCallback(
    (
      value: unknown,
      meta: Omit<SessionRecord, 'session_id' | 'course_id' | 'duration_minutes' | 'completed_at'> & {
        measured_minutes: number;
      },
    ): string | null => {
      try {
        const committed = commit('session', value, store, mergeInto);
        const v = value as { session_id: string; course_id: string };
        const record: SessionRecord = {
          session_id: v.session_id,
          topic_id: meta.topic_id,
          course_id: v.course_id,
          created_at: meta.created_at,
          completed_at: new Date().toISOString(),
          duration_minutes: meta.measured_minutes,
          intent: meta.intent,
          scope: meta.scope,
          timer_mode: meta.timer_mode,
          pomodoro_config: meta.pomodoro_config,
        };
        const next: Store = { ...committed, sessions: [...committed.sessions, record] };
        saveStore(next); // throws before we adopt the draft
        setUndoSnapshot(store); // the pre-commit state, for the toast's Undo
        setStore(next);
        return null;
      } catch (e) {
        if (e instanceof StorageError) return e.message;
        return e instanceof Error
          ? `That couldn't be saved: ${e.message}. Your existing data is unchanged.`
          : "That couldn't be saved. Your existing data is unchanged.";
      }
    },
    [store],
  );

  /**
   * Toggle an error's resolved flag (Document 3 §5.3 — "error entries have
   * resolve toggles that write back to the topic's error list"). Active error
   * count feeds `errorScore` and the Under-carded badge, so this immediately
   * moves health.
   */
  const toggleError = useCallback(
    (topicId: string, errorId: string): string | null => {
      try {
        const draft = cloneStore(store);
        const topic = allTopics(draft).find((t) => t.topic.topic_id === topicId)?.topic;
        const entry = topic?.error_log.find((e) => e.error_id === errorId);
        if (!entry) return "That error couldn't be found — nothing was changed.";

        entry.resolved = !entry.resolved;
        entry.resolved_date = entry.resolved ? new Date().toISOString() : null;

        saveStore(draft);
        setStore(draft);
        return null;
      } catch (e) {
        if (e instanceof StorageError) return e.message;
        return "That couldn't be saved. Your existing data is unchanged.";
      }
    },
    [store],
  );

  /** Revert the last paste commit. One level deep; consumed on use. */
  const undoLast = useCallback((): string | null => {
    if (!undoSnapshot) return 'Nothing to undo.';
    try {
      saveStore(undoSnapshot);
      setStore(undoSnapshot);
      setUndoSnapshot(null);
      return null;
    } catch (e) {
      if (e instanceof StorageError) return e.message;
      return "That couldn't be undone. Your data is unchanged.";
    }
  }, [undoSnapshot]);

  /**
   * Set a topic's status — the learner-set ladder (Document 2 §7). Routed
   * through the engine's `promote`, which owns the two automatic rules:
   * seeding on first promotion out of Not Started, and stamping `mastered_at`
   * on first arrival at Mastered.
   */
  const promoteTopic = useCallback(
    (topicId: string, status: TopicStatus): string | null => {
      try {
        const draft = cloneStore(store);
        const topic = allTopics(draft).find((t) => t.topic.topic_id === topicId)?.topic;
        if (!topic) return "That topic couldn't be found — nothing was changed.";
        if (topic.status === status) return null;

        Object.assign(topic, promote(topic, status));

        saveStore(draft);
        setStore(draft);
        return null;
      } catch (e) {
        if (e instanceof StorageError) return e.message;
        return "That couldn't be saved. Your existing data is unchanged.";
      }
    },
    [store],
  );

  /**
   * One-tap review — the `manual_review` source (Document 1 §2.4) the domain
   * always modeled but nothing created. Runs the same single recalculation
   * path as sessions and exams; only the provenance differs.
   */
  const logManualReview = useCallback(
    (topicId: string, confidence: Confidence): string | null => {
      try {
        const draft = cloneStore(store);
        const topic = allTopics(draft).find((t) => t.topic.topic_id === topicId)?.topic;
        if (!topic) return "That topic couldn't be found — nothing was changed.";

        const event: ReviewEvent = {
          event_id: makeId('event'),
          date: new Date().toISOString(),
          kind: 'study_review',
          source: 'manual_review',
          source_id: makeId('manual'),
          confidence_reported: confidence,
        };
        Object.assign(topic, applyEvent(topic, event));

        saveStore(draft);
        setStore(draft);
        return null;
      } catch (e) {
        if (e instanceof StorageError) return e.message;
        return "That couldn't be saved. Your existing data is unchanged.";
      }
    },
    [store],
  );

  /** Replace the whole store (import / restore). Atomic: the write happens
   *  before the swap, so a failure leaves current state intact (E2-S4). */
  const replaceStore = useCallback((next: Store): string | null => {
    try {
      saveStore(next);
      setStore(next);
      return null;
    } catch (e) {
      if (e instanceof StorageError) return e.message;
      return "That couldn't be saved. Your existing data is unchanged.";
    }
  }, []);

  /** Wipe everything back to empty (Settings). */
  const clearStore = useCallback((): string | null => replaceStore(emptyStore()), [replaceStore]);

  return {
    store,
    commitValue,
    commitSession,
    undoLast,
    toggleError,
    promoteTopic,
    logManualReview,
    replaceStore,
    clearStore,
    loadError,
  };
}
