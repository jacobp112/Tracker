import { storageGet, storageSet } from './storage.js';
import { validateEntry } from './schema.js';

/**
 * Generates a stable slug for a topic to serve as its unique ID.
 * Matches legacy slug function.
 */
export function generateSlug(section, name) {
  return (section.split('\u2014')[0].trim() + '-' + name)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

/**
 * Generates an example JSON template for a given tracker schema/type.
 * @param {'course'|'log'} type
 * @param {Array<object>} schema
 * @returns {string}
 */
export function generateTemplate(type, schema = []) {
  if (type === 'course') {
    return JSON.stringify([
      {
        section: "Section 1 \u2014 Algebra Basics",
        name: "Solving Simple Equations",
        reference: "Page 24"
      },
      {
        section: "Section 1 \u2014 Algebra Basics",
        name: "Rearranging Formulas",
        reference: "Page 28"
      }
    ], null, 2);
  } else {
    // Log tracker: generate sample from fields schema
    const entry = {};
    schema.forEach(field => {
      if (field.kind === 'number') {
        entry[field.key] = 12.5;
      } else if (field.kind === 'date') {
        entry[field.key] = new Date().toISOString().split('T')[0];
      } else if (field.kind === 'select') {
        entry[field.key] = field.options ? field.options[0] : 'option_value';
      } else {
        entry[field.key] = 'Sample text';
      }
    });
    return JSON.stringify([entry], null, 2);
  }
}

/**
 * Generates an AI instruction block/prompt to guide screenshot-to-JSON parsing.
 * @param {string} trackerName
 * @param {'course'|'log'} type
 * @param {Array<object>} schema
 * @returns {string}
 */
export function generateAIPrompt(trackerName, type, schema = []) {
  if (type === 'course') {
    return `You are an AI assistant. Analyze the syllabus, course handbook, or screenshot for "${trackerName}" and extract the list of topics/modules.
Convert them into a raw JSON array. Each element in the array must be an object with exactly these fields:
- "section": The name of the section or chapter containing the topic.
- "name": The name of the specific topic or skill to study.
- "reference": Optional chapter number, page number, or section code reference (use "" if not found).

JSON Format:
${generateTemplate('course')}

Output ONLY the raw JSON code block, without any markdown fences, explanation, or extra characters.`;
  } else {
    // Log tracker prompt
    const fieldDescriptions = schema.map(f => {
      let desc = `- "${f.key}": (${f.kind}) ${f.label}`;
      if (f.unit) desc += ` (in ${f.unit})`;
      if (f.kind === 'select' && f.options) desc += ` [Options: ${f.options.join(', ')}]`;
      return desc;
    }).join('\n');

    return `You are an AI assistant. Analyze the screenshot, raw text, or description of the activity logs for "${trackerName}" and extract the entries.
Convert them into a raw JSON array. Each element in the array must be an entry object matching this schema:
${fieldDescriptions}

JSON Format:
${generateTemplate('log', schema)}

Ensure all dates are formatted as YYYY-MM-DD. For numbers, output raw numeric values without unit suffixes.
Output ONLY the raw JSON code block, without any markdown fences, explanation, or extra characters.`;
  }
}

/**
 * Validates the raw JSON input for a tracker.
 * @param {string} jsonStr
 * @param {object} trackerMeta The tracker metadata object
 * @returns {{ ok: boolean, data?: any, error?: string, warnings?: string[] }}
 */
export function validateImport(jsonStr, trackerMeta) {
  let parsed = null;
  try {
    parsed = JSON.parse(jsonStr);
  } catch (e) {
    return { ok: false, error: `Invalid JSON syntax: ${e.message}` };
  }

  if (trackerMeta.type === 'course') {
    if (!Array.isArray(parsed)) {
      return { ok: false, error: 'Course syllabus data must be a JSON array of topics.' };
    }

    const validTopics = [];
    const errors = [];
    parsed.forEach((t, i) => {
      const idxLabel = `Topic [${i}]`;
      if (!t || typeof t !== 'object') {
        errors.push(`${idxLabel}: must be an object.`);
        return;
      }
      if (!t.section || typeof t.section !== 'string' || t.section.trim() === '') {
        errors.push(`${idxLabel}: missing or invalid "section".`);
      }
      if (!t.name || typeof t.name !== 'string' || t.name.trim() === '') {
        errors.push(`${idxLabel}: missing or invalid "name".`);
      }

      validTopics.push({
        section: String(t.section).trim(),
        name: String(t.name).trim(),
        reference: t.reference ? String(t.reference).trim() : ''
      });
    });

    if (errors.length > 0) {
      return { ok: false, error: errors.join('\n') };
    }

    return { ok: true, data: { topics: validTopics }, warnings: [] };
  } else {
    // Log tracker: expects array of entries or single entry
    let entries = parsed;
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
      entries = [parsed];
    }

    if (!Array.isArray(entries)) {
      return { ok: false, error: 'Log data must be a JSON array of entry objects (or a single entry object).' };
    }

    const validEntries = [];
    const allErrors = [];
    const allWarnings = [];

    entries.forEach((entry, i) => {
      const { ok, errors, warnings } = validateEntry(entry, trackerMeta.schema);
      if (!ok) {
        allErrors.push(`Entry [${i}]:\n` + errors.map(e => `  - ${e}`).join('\n'));
      }
      if (warnings.length > 0) {
        allWarnings.push(`Entry [${i}]:\n` + warnings.map(w => `  - ${w}`).join('\n'));
      }

      // Keep only schema fields in clean entry
      if (ok) {
        const cleanEntry = {};
        trackerMeta.schema.forEach(field => {
          if (entry[field.key] !== undefined && entry[field.key] !== null && entry[field.key] !== '') {
            if (field.kind === 'number') {
              cleanEntry[field.key] = Number(entry[field.key]);
            } else {
              cleanEntry[field.key] = entry[field.key];
            }
          } else {
            cleanEntry[field.key] = null;
          }
        });
        validEntries.push(cleanEntry);
      }
    });

    if (allErrors.length > 0) {
      return { ok: false, error: allErrors.join('\n') };
    }

    return { ok: true, data: { entries: validEntries }, warnings: allWarnings };
  }
}

/**
 * Applies the validated import data to storage.
 * @param {string} trackerId
 * @param {object} trackerMeta The tracker metadata
 * @param {object} importData The validated import data payload
 * @returns {boolean} True if successful
 */
export function applyImport(trackerId, trackerMeta, importData) {
  const entriesKey = `tracker:${trackerId}:entries`;
  const currentData = storageGet(entriesKey, []);

  if (trackerMeta.type === 'course') {
    // Merge topics based on section + name slug, keeping progress
    const bySlug = {};
    currentData.forEach(topic => {
      const slug = topic.id || generateSlug(topic.section, topic.name);
      bySlug[slug] = topic;
    });

    const mergedTopics = importData.topics.map((t, idx) => {
      const slug = generateSlug(t.section, t.name);
      const existing = bySlug[slug];

      if (existing) {
        // Keep progress details
        return {
          ...existing,
          section: t.section,
          name: t.name,
          reference: t.reference || existing.reference,
          i: idx // update index order
        };
      } else {
        // Create fresh topic
        return {
          id: slug,
          i: idx,
          section: t.section,
          name: t.name,
          reference: t.reference || '',
          status: 'Not Started',
          conf: '',
          reviewed: '',
          note: '',
          strength: 0,
          reviewHistory: [],
          studySeconds: 0,
          lastStudySeconds: 0
        };
      }
    });

    return storageSet(entriesKey, mergedTopics);
  } else {
    // Append log entries
    const mergedEntries = [...currentData, ...importData.entries];
    // Sort by date if 'date' is a field in schema
    const dateField = trackerMeta.schema.find(f => f.kind === 'date');
    if (dateField) {
      mergedEntries.sort((a, b) => {
        const da = a[dateField.key] || '';
        const db = b[dateField.key] || '';
        return da.localeCompare(db);
      });
    }
    return storageSet(entriesKey, mergedEntries);
  }
}
