import { listTrackers } from '../core/trackerRegistry.js';
import { storageGet } from '../core/storage.js';
import { getTopicStudySignal } from '../trackers/courseTracker.js';
import { getStartOfWeek, getEndOfWeek } from '../trackers/logTracker.js';

/**
 * Renders the Home View panel.
 */
export function renderHome() {
  const container = document.getElementById('home-view-container');
  if (!container) return;

  const trackers = listTrackers().filter(t => !t.archived);

  if (trackers.length === 0) {
    container.innerHTML = `
      <div class="empty-state">
        <h3>Welcome to your Dashboard</h3>
        <p>This is a fully offline, local space for tracking your progress across courses, exercises, or any customized activities.</p>
        <button id="homeCreateTrackerBtn" class="btn primary">Create Your First Tracker</button>
      </div>
    `;

    document.getElementById('homeCreateTrackerBtn')?.addEventListener('click', () => {
      // Trigger opening the create tracker modal
      const modal = document.getElementById('createTrackerModal');
      modal?.classList.add('open');
    });
    return;
  }

  // Active trackers overview
  let html = `
    <div style="margin-bottom: 24px;">
      <h2 style="font-size: 1.6rem; margin-bottom: 8px;">Dashboard Overview</h2>
      <p style="font-family: var(--font-serif); color: var(--muted); font-size: 1.1rem; font-style: italic;">
        Tracking progress across ${trackers.length} active domain${trackers.length === 1 ? '' : 's'}.
      </p>
    </div>
    <div class="home-summary-grid">
  `;

  trackers.forEach(t => {
    const entries = storageGet(`tracker:${t.id}:entries`, []);
    let snapshotText = '';

    if (t.type === 'course') {
      const total = entries.length;
      const mastered = entries.filter(topic => topic.status === 'Mastered').length;

      if (total === 0) {
        snapshotText = 'Syllabus not imported yet.';
      } else {
        let retrievalCount = 0;
        let frictionCount = 0;
        let readyCount = 0;

        entries.forEach(topic => {
          const sig = getTopicStudySignal(topic);
          if (sig) {
            if (sig.cls === 'needs-retrieval') retrievalCount++;
            else if (sig.cls === 'friction-zone') frictionCount++;
            else if (sig.cls === 'ready-test') readyCount++;
          }
        });

        if (retrievalCount > 0) {
          snapshotText = `${retrievalCount} topic${retrievalCount === 1 ? '' : 's'} need retrieval`;
        } else if (frictionCount > 0) {
          snapshotText = `${frictionCount} topic${frictionCount === 1 ? '' : 's'} stuck in Friction`;
        } else if (readyCount > 0) {
          snapshotText = `${readyCount} topic${readyCount === 1 ? '' : 's'} ready for test`;
        } else {
          snapshotText = `${mastered}/${total} topics mastered`;
        }
      }
    } else {
      // Log tracker summary
      const count = entries.length;
      if (count === 0) {
        snapshotText = 'No entries logged yet.';
      } else {
        const startOfWeek = getStartOfWeek();
        const endOfWeek = getEndOfWeek();
        const dateField = t.schema.find(f => f.kind === 'date');

        let weeklyCount = 0;
        if (dateField) {
          entries.forEach(entry => {
            if (entry[dateField.key]) {
              const entryDate = new Date(entry[dateField.key]);
              if (!isNaN(entryDate.getTime()) && entryDate >= startOfWeek && entryDate <= endOfWeek) {
                weeklyCount++;
              }
            }
          });
        }

        const activityLabel = t.name.toLowerCase().includes('run') ? 'run' : 'entry';
        const plural = weeklyCount === 1 ? '' : 's';
        const activityPlural = weeklyCount === 1 ? activityLabel : `${activityLabel}s`;

        snapshotText = `${weeklyCount} ${activityPlural} logged this week (${count} lifetime)`;
      }
    }

    html += `
      <div class="card" style="cursor: pointer;" data-home-tracker-id="${t.id}">
        <div style="display: flex; justify-content: space-between; align-items: flex-start;">
          <h3 style="font-family: var(--font-display);">${escapeHtml(t.name)}</h3>
          <span class="badge ${t.type}">${t.type === 'course' ? 'Course' : 'Log'}</span>
        </div>
        <p style="font-size: 0.95rem; color: var(--muted); font-family: var(--font-sans); margin-top: 4px;">
          ${escapeHtml(snapshotText)}
        </p>
        <div class="card-footer" style="padding-top: 8px; font-size: 0.8rem; color: var(--muted);">
          <span>Created: ${new Date(t.createdAt).toLocaleDateString()}</span>
          <span style="color: var(--gold); font-weight: 500;">Open &rarr;</span>
        </div>
      </div>
    `;
  });

  html += `</div>`;
  container.innerHTML = html;

  // Add click listeners to cards to switch to Trackers tab and focus on this tracker
  container.querySelectorAll('[data-home-tracker-id]').forEach(card => {
    card.addEventListener('click', (e) => {
      const id = card.getAttribute('data-home-tracker-id');
      // Trigger trackers tab switch
      const trackersTabBtn = document.getElementById('tab-trackers');
      trackersTabBtn?.click();

      // Dispatch event or call render function of tracker list with selected tracker ID
      setTimeout(() => {
        const trackerRow = document.querySelector(`[data-tracker-list-id="${id}"]`);
        trackerRow?.click();
      }, 50);
    });
  });
}

function escapeHtml(str) {
  if (!str) return '';
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}
