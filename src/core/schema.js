/**
 * Schema Validation Logic
 */

/**
 * Validates a schema definition array.
 * @param {Array<object>} schema
 * @returns {{ ok: boolean, errors: string[] }}
 */
export function validateSchema(schema) {
  const errors = [];
  if (!Array.isArray(schema)) {
    return { ok: false, errors: ['Schema must be an array of field definitions.'] };
  }

  const keys = new Set();

  schema.forEach((field, i) => {
    const label = `Field [${i}]`;
    if (!field || typeof field !== 'object') {
      errors.push(`${label}: must be an object.`);
      return;
    }

    if (!field.key || typeof field.key !== 'string') {
      errors.push(`${label}: missing or invalid "key" (must be non-empty string).`);
    } else {
      if (!/^[a-zA-Z][a-zA-Z0-9_]*$/.test(field.key)) {
        errors.push(`${label}: "key" "${field.key}" must start with a letter and contain only alphanumeric characters and underscores.`);
      }
      if (keys.has(field.key)) {
        errors.push(`${label}: duplicate key "${field.key}" found.`);
      }
      keys.add(field.key);
    }

    if (!field.label || typeof field.label !== 'string') {
      errors.push(`${label}: missing or invalid "label" (must be non-empty string).`);
    }

    const validKinds = ['text', 'number', 'date', 'select'];
    if (!field.kind || !validKinds.includes(field.kind)) {
      errors.push(`${label}: "kind" must be one of: ${validKinds.join(', ')}.`);
    }

    if (field.kind === 'select') {
      if (!Array.isArray(field.options) || field.options.length === 0) {
        errors.push(`${label}: select kind must have a non-empty "options" array.`);
      } else {
        field.options.forEach((opt, oi) => {
          if (typeof opt !== 'string' || opt.trim() === '') {
            errors.push(`${label}: option at index ${oi} must be a non-empty string.`);
          }
        });
      }
    }
  });

  return {
    ok: errors.length === 0,
    errors
  };
}

/**
 * Validates an entry object against a schema definition.
 * @param {object} entry
 * @param {Array<object>} schema
 * @returns {{ ok: boolean, errors: string[], warnings: string[] }}
 */
export function validateEntry(entry, schema) {
  const errors = [];
  const warnings = [];

  if (!entry || typeof entry !== 'object' || Array.isArray(entry)) {
    return { ok: false, errors: ['Entry must be an object.'], warnings: [] };
  }

  // Create a map of schema fields for easy access
  const schemaMap = new Map();
  schema.forEach(field => schemaMap.set(field.key, field));

  // Check for unrecognized fields (warnings)
  Object.keys(entry).forEach(key => {
    if (!schemaMap.has(key)) {
      warnings.push(`Unrecognized field "${key}" not in schema.`);
    }
  });

  // Validate each field in the schema
  schema.forEach(field => {
    const val = entry[field.key];
    const isPresent = val !== undefined && val !== null && val !== '';

    if (!isPresent) {
      // By default all fields are optional, but if a field is required, we could add support here.
      // For now, let's treat them as optional.
      return;
    }

    const fieldLabel = `Field "${field.key}"`;

    if (field.kind === 'number') {
      const num = Number(val);
      if (isNaN(num)) {
        errors.push(`${fieldLabel}: value "${val}" must be a number.`);
      }
    } else if (field.kind === 'date') {
      // Expect YYYY-MM-DD
      const dateStr = String(val).trim();
      if (!/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
        errors.push(`${fieldLabel}: value "${val}" must be in YYYY-MM-DD format.`);
      } else {
        // Validate date is actually valid (e.g. not Feb 30th)
        const parts = dateStr.split('-');
        const y = parseInt(parts[0], 10);
        const m = parseInt(parts[1], 10) - 1;
        const d = parseInt(parts[2], 10);
        const dateObj = new Date(Date.UTC(y, m, d));
        if (dateObj.getUTCFullYear() !== y || dateObj.getUTCMonth() !== m || dateObj.getUTCDate() !== d) {
          errors.push(`${fieldLabel}: value "${val}" is an invalid date.`);
        }
      }
    } else if (field.kind === 'select') {
      if (!field.options.includes(val)) {
        errors.push(`${fieldLabel}: value "${val}" must be one of: ${field.options.join(', ')}.`);
      }
    } else if (field.kind === 'text') {
      if (typeof val !== 'string') {
        // We can warn or convert, but let's check it can be represented as string
        if (typeof val === 'object') {
          errors.push(`${fieldLabel}: value must be a primitive string.`);
        }
      }
    }
  });

  return {
    ok: errors.length === 0,
    errors,
    warnings
  };
}
