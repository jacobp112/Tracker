import Ajv, { type ErrorObject, type ValidateFunction } from 'ajv';
import addFormats from 'ajv-formats';
import { SCHEMAS, type SchemaName } from '@/domain/schemas';
import { translateErrors, type FriendlyError } from './errorTranslation';

/**
 * Parse & schema validation — Document 1 §6.1 steps 1–2, Document 4 E2-S1.
 */

export type ParseResult =
  | { ok: true; value: unknown }
  | { ok: false; error: FriendlyError };

/**
 * Step 1: Parse. On failure, show the raw error location — the user needs to
 * know *where* the JSON broke, and no translation improves on the parser's own
 * position report (Document 4 E2-S1).
 */
export function parseJson(input: string): ParseResult {
  const trimmed = input.trim();
  if (trimmed.length === 0) {
    return { ok: false, error: { path: '', message: "There's nothing to check yet. Paste the JSON your AI gave you." } };
  }

  // A very common paste: the AI wrapped it in a markdown fence despite being
  // told not to. Say so plainly rather than reporting a cryptic parse error.
  if (trimmed.startsWith('```')) {
    return {
      ok: false,
      error: {
        path: '',
        message:
          'This starts with a ``` code fence. Paste just the JSON itself, from the opening { to the closing }.',
      },
    };
  }

  try {
    return { ok: true, value: JSON.parse(trimmed) };
  } catch (e) {
    const raw = e instanceof Error ? e.message : String(e);
    const where = locate(raw, trimmed);
    return {
      ok: false,
      error: { path: '', message: `That isn't valid JSON${where}. The parser said: ${raw}` },
    };
  }
}

/**
 * Extract a human location from a V8 JSON parse error.
 *
 * V8 emits two different shapes, and which one you get depends on the failure:
 *   "Expected ':' after property name in JSON at position 5 (line 1 column 6)"
 *   "Unexpected token '}', \"{...}\" is not valid JSON"        ← no position
 * The second carries no offset at all, so a location is best-effort. When we
 * can't derive one we still surface V8's raw text, which embeds the offending
 * snippet — E2-S1 asks for the error *location*, and the snippet is it.
 */
function locate(raw: string, source: string): string {
  const lineCol = /\(line (\d+) column (\d+)\)/.exec(raw);
  if (lineCol?.[1] && lineCol[2]) return ` (line ${lineCol[1]}, column ${lineCol[2]})`;

  const pos = /at position (\d+)/.exec(raw);
  if (pos?.[1]) {
    const offset = Math.min(Number(pos[1]), source.length);
    const upTo = source.slice(0, offset);
    const line = upTo.split('\n').length;
    const col = offset - upTo.lastIndexOf('\n');
    return ` (line ${line}, column ${col})`;
  }

  return '';
}

const ajv = new Ajv({
  allErrors: true, // Document 1 §6.1: collect ALL errors, not just the first.
  strict: false, // our schemas use `description` as documentation
  verbose: true,
});
addFormats(ajv);

const compiled = new Map<SchemaName, ValidateFunction>();

function validator(name: SchemaName): ValidateFunction {
  let v = compiled.get(name);
  if (!v) {
    v = ajv.compile(SCHEMAS[name]);
    compiled.set(name, v);
  }
  return v;
}

export type ValidationResult =
  | { ok: true; value: unknown }
  | { ok: false; errors: FriendlyError[] };

/**
 * Step 2: Schema validate. Collects every error, then translates them all into
 * the interface's own voice (Document 3 §5.6).
 */
export function validateAgainst(schemaName: SchemaName, value: unknown): ValidationResult {
  const validate = validator(schemaName);
  if (validate(value)) return { ok: true, value };

  const raw: ErrorObject[] = validate.errors ?? [];
  const errors = translateErrors(raw, value, schemaName);

  // Never report "invalid" with an empty list — that would be a silent failure
  // (Document 4 DoD §9).
  if (errors.length === 0) {
    return {
      ok: false,
      errors: [{ path: '', message: `This ${schemaName} didn't match the expected shape.` }],
    };
  }
  return { ok: false, errors };
}

/** Steps 1–2 together. */
export function parseAndValidate(input: string, schemaName: SchemaName): ValidationResult {
  const parsed = parseJson(input);
  if (!parsed.ok) return { ok: false, errors: [parsed.error] };
  return validateAgainst(schemaName, parsed.value);
}
