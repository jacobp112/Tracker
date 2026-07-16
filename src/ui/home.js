import { listTrackers } from '../core/trackerRegistry.js';
import { storageGet } from '../core/storage.js';

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
      const practicing = entries.filter(topic => topic.status === 'Practising').length;
      const learning = entries.filter(topic => topic.status === 'Learning').length;

      if (total === 0) {
        snapshotText = 'Syllabus not imported yet.';
      } else {
        snapshotText = `${mastered}/${total} mastered · ${practicing} practising · ${learning} learning`;
      }
    } else {
      // Log tracker summary
      const count = entries.length;
      if (count === 0) {
        snapshotText = 'No entries logged yet.';
      } else {
        snapshotText = `${count} entries recorded.`;
        // Check if there are numeric fields in schema to summarize
        const numFields = t.schema?.filter(f => f.kind === 'number') || [];
        if (numFields.length > 0 && count > 0) {
          const firstNum = numFields[0];
          const sum = entries.reduce((s, entry) => s + (Number(entry[firstNum.key]) || 0), 0);
          const avg = sum / count;
          snapshotText += ` Total ${firstNum.label}: ${sum.toFixed(1)}${firstNum.unit ? ' ' + firstNum.unit : ''} (Avg: ${avg.toFixed(1)})`;
        }
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
