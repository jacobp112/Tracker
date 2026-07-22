import { useCallback, useEffect, useState } from 'react';
import { commit } from '@/core/pipeline';
import { mergeInto } from '@/core/merge';
import { cloneStore, loadStore, saveStore, StorageError } from '@/core/storage';
import type { SchemaName } from '@/domain/schemas';
import {
  allTopics,
  currentStage,
  emptyStore,
  type Confidence,
  type JobApplication,
  type JobStage,
  type ReviewEvent,
  type Store,
  type TopicStatus,
} from '@/domain/types';
import { makeId } from '@/core/merge';
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
    (schemaName: SchemaName, value: unknown): string | null => {
      try {
        const next = commit(schemaName, value, store, mergeInto);
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

  /**
   * Move an application to a new stage — APPENDS a StageEvent, never rewrites
   * history, so time-in-stage and the funnel stay honest. The descriptive half
   * of the record is edited via `editApplication`; this is the append-only half.
   */
  const moveStage = useCallback(
    (applicationId: string, stage: JobStage, notes?: string): string | null => {
      try {
        const draft = cloneStore(store);
        const app = draft.applications.find((a) => a.application_id === applicationId);
        if (!app) return "That application couldn't be found — nothing was changed.";
        if (currentStage(app) === stage) return null; // no-op, not an event

        app.stage_history.push({
          event_id: makeId('event'),
          date: new Date().toISOString(),
          stage,
          ...(notes ? { notes } : {}),
        });

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

  /** Edit an application's descriptive fields (the mutable half of the hybrid
   *  record). Stage and history are deliberately not patchable here. */
  const editApplication = useCallback(
    (
      applicationId: string,
      patch: Partial<
        Omit<JobApplication, 'application_id' | 'schema_version' | 'stage_history' | 'created_at' | 'archived'>
      >,
    ): string | null => {
      try {
        const draft = cloneStore(store);
        const app = draft.applications.find((a) => a.application_id === applicationId);
        if (!app) return "That application couldn't be found — nothing was changed.";

        Object.assign(app, patch);

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

  /** Archive/unarchive — leaves the board but keeps funnel math honest. */
  const archiveApplication = useCallback(
    (applicationId: string, archived = true): string | null => {
      try {
        const draft = cloneStore(store);
        const app = draft.applications.find((a) => a.application_id === applicationId);
        if (!app) return "That application couldn't be found — nothing was changed.";

        app.archived = archived;

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
    undoLast,
    toggleError,
    promoteTopic,
    logManualReview,
    moveStage,
    editApplication,
    archiveApplication,
    replaceStore,
    clearStore,
    loadError,
  };
}
