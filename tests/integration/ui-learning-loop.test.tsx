import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import React from 'react';
import App from '@/App';
import { emptyStore, type Store } from '@/domain/types';
import type { AssessmentDefinition } from '@/domain/assessment';
import { getAssessmentRepo } from '@/core/assessment-store';
import { saveStore } from '@/core/storage';

const mockCourse: Store = {
  schema_version: '4.0.0',
  courses: [
    {
      schema_version: '3.2.0',
      course_id: 'course_math101',
      title: 'Mathematics 101',
      created_at: '2026-08-01T00:00:00Z',
      source: 'manual',
      sections: [
        {
          section_id: 'sec_algebra',
          title: 'Algebra',
          order: 1,
          topics: [
            {
              topic_id: 'topic_quadratics',
              title: 'Quadratic Equations',
              status: 'learning',
              conf: 3,
              strength: 1.0,
              k_factor: 8.4,
              cards: 5,
              last_reviewed: '2026-08-05T00:00:00Z',
              mastered_at: null,
              drift_history: [],
              review_history: [
                {
                  event_id: 'ev_1',
                  date: '2026-08-05T00:00:00Z',
                  kind: 'study_review',
                  source: 'session',
                  source_id: 'sess_1',
                  confidence_reported: 3,
                },
              ],
              error_log: [
                {
                  error_id: 'err_1',
                  date: '2026-08-05T00:00:00Z',
                  source: 'session',
                  source_id: 'sess_1',
                  error_type: 'conceptual',
                  description: 'Sign inversion in discriminant',
                  resolved: false,
                  resolved_date: null,
                  pattern_id: 'pattern_sign_inversion',
                },
              ],
            },
          ],
        },
      ],
    },
  ],
  exams: [],
  sessions: [],
  error_patterns: [
    {
      pattern_id: 'pattern_sign_inversion',
      signature: 'Sign inversion in discriminant',
      error_type: 'conceptual',
      severity: 'medium',
      topic_ids: ['topic_quadratics'],
      occurrence_ids: ['err_1'],
      created_at: '2026-08-05T00:00:00Z',
    },
  ],
  assessment_refs: [
    {
      assessment_id: 'assessment_math_paper1',
      title: 'Math Paper 1 - Algebra',
      provenance: 'past_paper',
      topic_ids: ['topic_quadratics'],
      max_marks: 20,
      created_at: '2026-08-01T00:00:00Z',
    },
  ],
};

const mockAssessmentDef: AssessmentDefinition = {
  schema_version: '4.0.0',
  assessment_id: 'assessment_math_paper1',
  title: 'Math Paper 1 - Algebra',
  provenance: 'past_paper',
  created_at: '2026-08-01T00:00:00Z',
  max_marks: 20,
  questions: [
    {
      question_id: 'q1',
      assessment_id: 'assessment_math_paper1',
      label: 'Q1',
      order: 0,
      marks_available: 20,
      provenance: 'past_paper',
      topic_mappings: [
        {
          topic_id: 'topic_quadratics',
          role: 'primary',
          weight: 1.0,
          proposed_by: 'user',
          confirmed: true,
        },
      ],
      mark_scheme: {
        total_marks: 20,
        criteria: [
          {
            criterion_id: 'c1',
            marks: 20,
            kind: 'method',
            label: 'M1',
            descriptor: 'Solve quadratic equation using discriminant',
          },
        ],
      },
    },
  ],
};

describe('UI Learning-System Integration & Verification Loop', () => {
  beforeEach(async () => {
    localStorage.clear();
    saveStore(mockCourse);
    const repo = getAssessmentRepo();
    await repo.clear();
    await repo.putDefinition(mockAssessmentDef);
  });

  it('1-5: Overview loads recommendation dashboard and launches session with plan', async () => {
    render(<App />);

    // 1 & 2: Overview loads and recommendations render
    expect(screen.getByText('What to do next: Remediate Error')).toBeInTheDocument();
    expect(screen.getAllByText('Quadratic Equations').length).toBeGreaterThan(0);
    expect(screen.getByText(/Remediate "Sign inversion in discriminant"/)).toBeInTheDocument();

    // 4: Recommendation CTA launches session
    const startBtn = screen.getByText('Start Remediate Error →');
    fireEvent.click(startBtn);

    // 5: Session setup modal opens with Session Plan banner
    await waitFor(() => {
      expect(screen.getByText('Start session')).toBeInTheDocument();
      expect(screen.getByText('Session Plan')).toBeInTheDocument();
      expect(screen.getByText(/Demonstrated error remediation and independent proof/)).toBeInTheDocument();
    });
  });

  it('6-13: Exams route displays assessment readiness, opens sitting modal, submits attempt & updates state', async () => {
    window.location.hash = '#/exams';
    fireEvent(window, new Event('hashchange'));
    render(<App />);

    // 6 & 12: Readiness card renders with blocking criteria
    await waitFor(() => {
      expect(screen.getByText('Math Paper 1 - Algebra')).toBeInTheDocument();
      expect(screen.getByText(/Assessment Readiness Check/)).toBeInTheDocument();
    });

    // 8 & 9: Open assessment sitting modal
    const sitBtn = screen.getByText('Sit & Mark Assessment →');
    fireEvent.click(sitBtn);

    await waitFor(() => {
      expect(screen.getByText('1. Sitting Conditions')).toBeInTheDocument();
    });

    // Proceed to marking
    const continueBtn = screen.getByText('Continue to Marking →');
    fireEvent.click(continueBtn);

    await waitFor(() => {
      expect(screen.getByText('2. Mark Question-by-Question')).toBeInTheDocument();
      expect(screen.getByText('Mark Scheme Criteria:')).toBeInTheDocument();
    });

    // 10 & 11: Record marks & submit attempt
    const submitBtn = screen.getByText('Submit Attempt & Record Evidence →');
    fireEvent.click(submitBtn);

    await waitFor(() => {
      expect(screen.getByText('Assessment attempt submitted! Question evidence recorded and un-smeared.')).toBeInTheDocument();
    });
  });
});
