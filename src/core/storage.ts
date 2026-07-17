import { emptyStore, SCHEMA_VERSION, type Store } from '@/domain/types';

/**
 * Local-first persistence. v1 is single-user and local (Document 4 §13.4), so
 * localStorage is the whole backend.
 */

export const STORE_KEY = 'studyos-store';

export class StorageError extends Error {}

/** Deep clone. Commits mutate a copy so a mid-commit throw can't leave a
 *  half-written store behind (Document 4 E2-S4, atomicity). */
export function cloneStore(store: Store): Store {
  return structuredClone(store);
}

export function loadStore(): Store {
  let raw: string | null;
  try {
    raw = localStorage.getItem(STORE_KEY);
  } catch (e) {
    // No silent failures (Document 4 DoD §9) — the caller surfaces this.
    throw new StorageError(
      "Your tracker's storage isn't available. If you're in a private window, data can't be saved there.",
    );
  }

  if (!raw) return emptyStore();

  try {
    const parsed = JSON.parse(raw) as Store;
    // Guard against a store written by a future/other version rather than
    // reading it as if it were ours.
    if (parsed.schema_version !== SCHEMA_VERSION) {
      throw new StorageError(
        `Your saved data is version ${parsed.schema_version ?? 'unknown'}, but this app expects ${SCHEMA_VERSION}. It hasn't been touched — export it before continuing.`,
      );
    }
    return {
      ...emptyStore(),
      ...parsed,
    };
  } catch (e) {
    if (e instanceof StorageError) throw e;
    throw new StorageError(
      "Your saved data couldn't be read — it may be corrupted. It hasn't been overwritten.",
    );
  }
}

/**
 * Atomic write: one `setItem` of the whole store. Either the new state lands
 * whole or the previous state survives untouched — there is no partial write
 * (Document 4 E2-S4).
 */
export function saveStore(store: Store): void {
  let serialised: string;
  try {
    serialised = JSON.stringify(store);
  } catch {
    throw new StorageError("That data couldn't be saved — it contains something unserialisable.");
  }

  try {
    localStorage.setItem(STORE_KEY, serialised);
  } catch (e) {
    const quota =
      e instanceof DOMException &&
      (e.name === 'QuotaExceededError' || e.name === 'NS_ERROR_DOM_QUOTA_REACHED');
    throw new StorageError(
      quota
        ? "There's no room left to save this. Export your data and remove something you no longer need."
        : "That couldn't be saved. Your existing data is unchanged.",
    );
  }
}
