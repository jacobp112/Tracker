import { allTopics, type Store } from '@/domain/types';
import { globalDueQueue } from './overview';
import { predictRetention } from './retention';

/**
 * The command palette's corpus and matching — Document 3 §4.
 *
 * Deliberately pure and React-free: items are plain descriptors carrying a
 * *target*, not a callback. The component decides what a target means. That
 * keeps ranking and suggestion behaviour unit-testable without a DOM, and stops
 * the corpus from quietly capturing component state in a closure.
 */

export type PaletteAction = 'toggle-theme';

export type PaletteTarget =
  | { type: 'route'; hash: string }
  | { type: 'action'; action: PaletteAction };

export type PaletteGroup = 'Due for review' | 'Jump to' | 'Actions';

export interface PaletteItem {
  id: string;
  label: string;
  /** Where this lives — the course a topic sits in, or the kind of thing it is. */
  hint?: string;
  /** A measured value shown right-aligned, e.g. a due topic's retention. */
  meta?: string;
  group: PaletteGroup;
  target: PaletteTarget;
}

/** How many due topics the palette leads with before you type. Beyond a
 *  handful it stops being a suggestion and becomes a list to read. */
const MAX_SUGGESTED_DUE = 5;

const SCREENS: ReadonlyArray<{ label: string; hash: string }> = [
  { label: 'Overview', hash: '#/overview' },
  { label: 'Study', hash: '#/study' },
  { label: 'Fitness', hash: '#/fitness' },
  { label: 'Exams', hash: '#/exams' },
  { label: 'Settings', hash: '#/settings' },
];

/**
 * Always available, regardless of what's in the store — an empty tracker still
 * needs a way to get its first course in. Labelled with imperative verbs that
 * name the outcome (Doc 3 §7), matching the vocabulary of the screens they
 * lead to.
 */
const ACTIONS: readonly PaletteItem[] = [
  { id: 'action:add-course', label: 'Add a course', group: 'Actions', target: { type: 'route', hash: '#/study/add' } },
  { id: 'action:add-exam', label: 'Add an exam result', group: 'Actions', target: { type: 'route', hash: '#/exams/add' } },
  { id: 'action:add-run', label: 'Log a run', group: 'Actions', target: { type: 'route', hash: '#/fitness/add-run' } },
  { id: 'action:add-lift', label: 'Log a lift', group: 'Actions', target: { type: 'route', hash: '#/fitness/add-lift' } },
  {
    id: 'action:toggle-theme',
    label: 'Toggle light / dark theme',
    group: 'Actions',
    target: { type: 'action', action: 'toggle-theme' },
  },
];

/** topic_id → its course, so a due topic can resolve its own route. */
function courseByTopic(store: Store): Map<string, { id: string; title: string }> {
  return new Map(
    allTopics(store).map(({ topic, course }) => [
      topic.topic_id,
      { id: course.course_id, title: course.title },
    ]),
  );
}

/** Everything reachable from the palette. */
export function paletteItems(store: Store, _now: Date = new Date()): PaletteItem[] {
  const items: PaletteItem[] = [];

  for (const { topic, course } of allTopics(store)) {
    items.push({
      id: `topic:${topic.topic_id}`,
      label: topic.title,
      // The course name, not the word "Topic" — two courses can both have a
      // "Vectors" topic, and the course is what tells them apart.
      hint: course.title,
      group: 'Jump to',
      target: { type: 'route', hash: `#/course/${course.course_id}` },
    });
  }

  for (const course of store.courses) {
    items.push({
      id: `course:${course.course_id}`,
      label: course.title,
      hint: 'Course',
      group: 'Jump to',
      target: { type: 'route', hash: `#/course/${course.course_id}` },
    });
  }

  for (const screen of SCREENS) {
    items.push({
      id: `screen:${screen.hash}`,
      label: screen.label,
      hint: 'Screen',
      group: 'Jump to',
      target: { type: 'route', hash: screen.hash },
    });
  }

  items.push(...ACTIONS);
  return items;
}

/**
 * What the palette shows before a query — the most-decayed topics first, then
 * the actions. The palette opens already answering "what should I do now?"
 * rather than waiting to be interrogated. Reuses the same queue the Overview
 * and course dashboard use, so the answer can't drift between surfaces.
 */
export function suggestions(store: Store, now: Date = new Date()): PaletteItem[] {
  const courses = courseByTopic(store);

  const due: PaletteItem[] = globalDueQueue(store, MAX_SUGGESTED_DUE, now).flatMap(
    ({ topic, courseTitle }) => {
      const course = courses.get(topic.topic_id);
      if (!course) return [];
      const retention = predictRetention(topic, now);
      return [
        {
          id: `due:${topic.topic_id}`,
          label: topic.title,
          hint: courseTitle,
          meta: retention === null ? undefined : `${Math.round(retention * 100)}%`,
          group: 'Due for review' as const,
          target: { type: 'route' as const, hash: `#/course/${course.id}` },
        },
      ];
    },
  );

  return [...due, ...ACTIONS];
}

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Match rank, lowest first; -1 means no match.
 *
 * Substring matching rather than fuzzy: at this corpus size fuzzy adds a
 * dependency and unpredictable ordering to solve a problem nobody has. What
 * matters is that "eig" finds Eigenvalues and that a label starting with the
 * query outranks one merely containing it.
 */
function rank(item: PaletteItem, query: string): number {
  const label = item.label.toLowerCase();
  const hint = (item.hint ?? '').toLowerCase();
  const word = new RegExp(`\\b${escapeRegExp(query)}`);

  if (label.startsWith(query)) return 0;
  if (word.test(label)) return 1;
  if (label.includes(query)) return 2;
  if (hint.startsWith(query)) return 3;
  if (hint.includes(query)) return 4;
  return -1;
}

/** Filter and rank. An empty query is not a filter — it returns everything. */
export function searchItems(items: readonly PaletteItem[], query: string): PaletteItem[] {
  const q = query.trim().toLowerCase();
  if (q === '') return [...items];

  return items
    .map((item, index) => ({ item, index, rank: rank(item, q) }))
    .filter((r) => r.rank !== -1)
    // Rank first, then original order — a stable tie-break keeps results from
    // reshuffling as the user types another character.
    .sort((a, b) => a.rank - b.rank || a.index - b.index)
    .map((r) => r.item);
}
