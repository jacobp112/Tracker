import { useCallback, useEffect, useState } from 'react';
import { commit } from '@/core/pipeline';
import { mergeInto } from '@/core/merge';
import { cloneStore, loadStore, saveStore, StorageError } from '@/core/storage';
import type { SchemaName } from '@/domain/schemas';
import { allTopics, emptyStore, type Store } from '@/domain/types';

/**
 * Owns the live store. Commits go through the pipeline's clone-then-swap
 * (Document 4 E2-S4): the draft is only adopted once the merge and the write
 * have both succeeded, so a throw anywhere leaves state untouched.
 */
export function useStore() {
  const [store, setStore] = useState<Store>(emptyStore);
  const [loadError, setLoadError] = useState<string | null>(null);

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

  return { store, commitValue, toggleError, replaceStore, clearStore, loadError };
}
