/**
 * Core Storage Engine with Corruption-Recovery
 * Primary key + :prev fallback + :corrupt quarantine key
 */

/**
 * Safely parses JSON string, returns null on failure.
 */
function safeParse(str) {
  try {
    return JSON.parse(str);
  } catch (e) {
    return null;
  }
}

/**
 * Gets a value from localStorage with fallback and recovery logic.
 * @param {string} key
 * @param {any} defaultVal
 * @returns {any}
 */
export function storageGet(key, defaultVal) {
  let primaryVal = null;
  try {
    primaryVal = localStorage.getItem(key);
  } catch (e) {
    // Treat localStorage failure as null to trigger fallbacks
    primaryVal = null;
  }

  if (primaryVal === null) {
    // Check if a backup exists
    let prevVal = null;
    try {
      prevVal = localStorage.getItem(`${key}:prev`);
    } catch (e) {
      prevVal = null;
    }

    if (prevVal !== null) {
      const parsedPrev = safeParse(prevVal);
      if (parsedPrev !== null) {
        // Recovery: restore primary from prev
        try {
          localStorage.setItem(key, prevVal);
        } catch (e) {
          // Ignore write failure during recovery
        }
        return parsedPrev;
      } else {
        // Quarantine corrupt prev
        try {
          localStorage.setItem(`${key}:prev:corrupt`, prevVal);
          localStorage.removeItem(`${key}:prev`);
        } catch (e) {}
      }
    }
    return defaultVal;
  }

  const parsedPrimary = safeParse(primaryVal);
  if (parsedPrimary !== null) {
    return parsedPrimary;
  }

  // Primary exists but is corrupt. Quarantine it!
  try {
    localStorage.setItem(`${key}:corrupt`, primaryVal);
    localStorage.removeItem(key);
  } catch (e) {}

  // Try to recover from prev
  let prevVal = null;
  try {
    prevVal = localStorage.getItem(`${key}:prev`);
  } catch (e) {
    prevVal = null;
  }

  if (prevVal !== null) {
    const parsedPrev = safeParse(prevVal);
    if (parsedPrev !== null) {
      // Restore primary from prev
      try {
        localStorage.setItem(key, prevVal);
      } catch (e) {}
      return parsedPrev;
    } else {
      // Quarantine corrupt prev
      try {
        localStorage.setItem(`${key}:prev:corrupt`, prevVal);
        localStorage.removeItem(`${key}:prev`);
      } catch (e) {}
    }
  }

  return defaultVal;
}

/**
 * Sets a value in localStorage after backing up the current value.
 * @param {string} key
 * @param {any} val
 * @returns {boolean} True if successful, false otherwise
 */
export function storageSet(key, val) {
  try {
    const newValStr = JSON.stringify(val);
    let oldValStr = null;
    try {
      oldValStr = localStorage.getItem(key);
    } catch (e) {
      oldValStr = null;
    }

    // Set backup key to current value
    if (oldValStr !== null) {
      try {
        localStorage.setItem(`${key}:prev`, oldValStr);
      } catch (e) {
        // If backup write fails, we should still try to write primary
      }
    }

    localStorage.setItem(key, newValStr);
    return true;
  } catch (e) {
    console.error(`Storage write failed for key "${key}":`, e);
    return false;
  }
}

/**
 * Deletes all namespaces related to key.
 * @param {string} key
 */
export function storageDelete(key) {
  try {
    localStorage.removeItem(key);
    localStorage.removeItem(`${key}:prev`);
    localStorage.removeItem(`${key}:corrupt`);
    localStorage.removeItem(`${key}:prev:corrupt`);
  } catch (e) {
    console.error(`Storage delete failed for key "${key}":`, e);
  }
}
