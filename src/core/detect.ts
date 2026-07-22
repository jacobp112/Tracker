import type { SchemaName } from '@/domain/schemas';

/**
 * Schema auto-detection for the Quick-add inbox.
 *
 * Every ingestion shape is structurally self-identifying — each carries at
 * least one key no other shape has. Detection reads those discriminators only;
 * full validation still happens downstream in `ingest()`, so a wrong guess
 * cannot corrupt anything, it can only produce the right error messages for
 * the wrong schema (and the discriminators below are mutually exclusive).
 *
 * Discriminators:
 *  - course   → `sections`
 *  - session  → `topics_covered`
 *  - exam     → `linked_topic_ids`
 *  - running  → `activity_id`
 *  - lifting  → `exercises`
 *  - job      → `application_id`
 */
export function detectSchema(value: unknown): SchemaName | null {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return null;
  const keys = value as Record<string, unknown>;

  if ('sections' in keys) return 'course';
  if ('topics_covered' in keys) return 'session';
  if ('linked_topic_ids' in keys) return 'exam';
  if ('activity_id' in keys) return 'running';
  if ('exercises' in keys) return 'lifting';
  if ('application_id' in keys) return 'job';
  return null;
}
