import { useCallback, useEffect, useState } from 'react';

/**
 * Persisted user preferences (Document 4 E8-S2). Theme lives separately (it
 * must resolve before first paint); this covers the rest. Weight *display*
 * unit only — storage always stays kg (Document 1 §5.2 / Document 3 §5.5).
 */

export type WeightUnit = 'kg' | 'lb';

export interface Preferences {
  weightUnit: WeightUnit;
}

const PREFS_KEY = 'studyos-prefs';
const DEFAULTS: Preferences = { weightUnit: 'kg' };

function read(): Preferences {
  try {
    const raw = localStorage.getItem(PREFS_KEY);
    if (!raw) return DEFAULTS;
    return { ...DEFAULTS, ...(JSON.parse(raw) as Partial<Preferences>) };
  } catch {
    return DEFAULTS;
  }
}

export function usePreferences() {
  const [prefs, setPrefs] = useState<Preferences>(read);

  useEffect(() => {
    try {
      localStorage.setItem(PREFS_KEY, JSON.stringify(prefs));
    } catch {
      // Non-fatal: preference just won't persist this session.
    }
  }, [prefs]);

  const setWeightUnit = useCallback((weightUnit: WeightUnit) => {
    setPrefs((p) => ({ ...p, weightUnit }));
  }, []);

  return { prefs, setWeightUnit };
}
