import type { Store } from '@/domain/types';
import { allTopics } from '@/domain/types';
import { downstreamDependents, prerequisiteInstability, type PrerequisiteBlockingGap } from './prerequisites';
import { CONFIG } from '@/config/constants';

export interface TimeBudget {
  availableMinutes: number | null;
  deadline: Date | null;
  sessionsRemaining: number | null;
}

export interface EligibleTopicInfo {
  topicId: string;
  title: string;
  downstreamValue: number;
  depth: number;
}

export interface BlockedTopicInfo {
  topicId: string;
  title: string;
  blockingPrerequisites: string[];
  blockingGaps: PrerequisiteBlockingGap[];
}

export interface CurriculumPosition {
  eligibleTopics: EligibleTopicInfo[];
  suggestedOrder: string[];
  blockedTopics: BlockedTopicInfo[];
}

/**
 * Derives a time budget for planning, supporting explicit parameters or inference from Store.exams.
 * Pure, derived, deterministic.
 */
export function deriveTimeBudget(
  store: Store,
  options?: { availableMinutes?: number | null; deadline?: Date | null },
  now: Date = new Date(),
): TimeBudget {
  const availableMinutes: number | null = options?.availableMinutes ?? null;
  let deadline: Date | null = options?.deadline ?? null;

  // If deadline is not explicitly supplied, try inferring from upcoming store.exams
  if (!deadline && store.exams && store.exams.length > 0) {
    const futureExams = store.exams
      .map((e) => new Date(e.date))
      .filter((d) => !isNaN(d.getTime()) && d.getTime() > now.getTime())
      .sort((a, b) => a.getTime() - b.getTime());

    if (futureExams.length > 0) {
      deadline = futureExams[0]!;
    }
  }

  let sessionsRemaining: number | null = null;
  if (availableMinutes !== null && availableMinutes !== undefined) {
    sessionsRemaining = Math.max(0, Math.floor(availableMinutes / CONFIG.PROGRESS.SESSION_MINUTES));
  } else if (deadline !== null) {
    // Convert the deadline's day-distance into a *session* count so the two
    // branches report the same unit (V4). A same-day-but-future deadline still
    // leaves at least one session.
    const days = Math.max(0, Math.floor((deadline.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)));
    sessionsRemaining = Math.max(1, Math.floor(days * CONFIG.DEFAULT_SESSIONS_PER_DAY));
  }

  return {
    availableMinutes,
    deadline,
    sessionsRemaining,
  };
}

/**
 * Derives current curriculum position and optimal sequencing for unstarted topics.
 * Pure, derived, deterministic.
 */
export function curriculumPosition(store: Store, now: Date = new Date()): CurriculumPosition {
  const unstarted = allTopics(store).filter(({ topic }) => topic.status === 'not_started');

  const eligibleTopics: EligibleTopicInfo[] = [];
  const blockedTopics: BlockedTopicInfo[] = [];

  for (const { topic } of unstarted) {
    const report = prerequisiteInstability(topic, store, now);
    const hardBlockers = report.upstream.filter(
      (u) => u.unstable && (u.blockingGap === 'unconsolidated_status' || u.blockingGap === 'unresolved_error'),
    );

    if (hardBlockers.length === 0) {
      const dependents = downstreamDependents(topic.topic_id, store);
      const maxDepth = report.upstream.length > 0 ? Math.max(...report.upstream.map((u) => u.depth)) : 0;

      eligibleTopics.push({
        topicId: topic.topic_id,
        title: topic.title,
        downstreamValue: dependents.length,
        depth: maxDepth,
      });
    } else {
      const blockingPrerequisites = Array.from(new Set(hardBlockers.map((u) => u.topic_id)));
      const blockingGaps = Array.from(
        new Set(
          hardBlockers
            .map((u) => u.blockingGap)
            .filter((g): g is PrerequisiteBlockingGap => g !== undefined),
        ),
      );

      blockedTopics.push({
        topicId: topic.topic_id,
        title: topic.title,
        blockingPrerequisites,
        blockingGaps,
      });
    }
  }

  // Sort eligible topics deterministically:
  // 1. downstreamValue descending (foundation topics underpinning more future work first)
  // 2. depth ascending (shallowest prerequisites first)
  // 3. title / topicId ascending (alphabetical tiebreaker)
  const sortedEligible = [...eligibleTopics].sort((a, b) => {
    if (b.downstreamValue !== a.downstreamValue) {
      return b.downstreamValue - a.downstreamValue;
    }
    if (a.depth !== b.depth) {
      return a.depth - b.depth;
    }
    return a.title.localeCompare(b.title);
  });

  const suggestedOrder = sortedEligible.map((t) => t.topicId);

  return {
    eligibleTopics: sortedEligible,
    suggestedOrder,
    blockedTopics,
  };
}
