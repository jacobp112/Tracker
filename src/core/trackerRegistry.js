import { storageGet, storageSet, storageDelete } from './storage.js';

const REGISTRY_INDEX_KEY = 'trackers:index';

/**
 * Returns a list of all trackers in the registry.
 * @returns {Array<{ id: string, name: string, type: 'course'|'log', archived: boolean, createdAt: string }>}
 */
export function listTrackers() {
  return storageGet(REGISTRY_INDEX_KEY, []);
}

/**
 * Creates a new tracker.
 * @param {string} name
 * @param {'course'|'log'} type
 * @param {Array<object>} schema
 * @returns {object} The created tracker's metadata
 */
export function createTracker(name, type, schema) {
  const id = `tr-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
  const createdAt = new Date().toISOString();
  const meta = {
    id,
    name,
    type,
    schema: schema || [],
    createdAt,
    archived: false
  };

  // Save tracker meta and empty entries/topics
  storageSet(`tracker:${id}:meta`, meta);
  storageSet(`tracker:${id}:entries`, []);

  // Update index
  const index = listTrackers();
  index.push({
    id,
    name,
    type,
    archived: false,
    createdAt
  });
  storageSet(REGISTRY_INDEX_KEY, index);

  return meta;
}

/**
 * Toggles a tracker's archived state.
 * @param {string} id
 * @param {boolean} archived
 * @returns {boolean} True if successful, false if tracker not found
 */
export function archiveTracker(id, archived) {
  const metaKey = `tracker:${id}:meta`;
  const meta = storageGet(metaKey, null);
  if (!meta) return false;

  meta.archived = archived;
  storageSet(metaKey, meta);

  const index = listTrackers();
  const indexItem = index.find(item => item.id === id);
  if (indexItem) {
    indexItem.archived = archived;
    storageSet(REGISTRY_INDEX_KEY, index);
  }

  return true;
}

/**
 * Permanently deletes a tracker and all its entries.
 * @param {string} id
 * @returns {boolean} True if successful
 */
export function deleteTracker(id) {
  // Remove from index
  const index = listTrackers();
  const updatedIndex = index.filter(item => item.id !== id);
  storageSet(REGISTRY_INDEX_KEY, updatedIndex);

  // Delete tracker storage keys
  storageDelete(`tracker:${id}:meta`);
  storageDelete(`tracker:${id}:entries`);

  return true;
}
