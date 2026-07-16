import { listTrackers, archiveTracker, deleteTracker } from '../core/trackerRegistry.js';
import { storageGet } from '../core/storage.js';
import { openImportModal } from './importModal.js';
import { renderActiveView, showToast } from './main.js';

let selectedTrackerId = null;
let showArchived = false;

export function renderTrackerList() {
  const container = document.getElementById('trackers-view-container');
  if (!container) return;

  const trackers = listTrackers();
  const activeTrackers = trackers.filter(t => !t.archived);
  const archivedTrackers = trackers.filter(t => t.archived);

  const listToRender = showArchived ? archivedTrackers : activeTrackers;

  let html = `
    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px; flex-wrap: wrap; gap: 12px;">
      <div>
        <h2 style="font-size: 1.6rem;">Trackers Registry</h2>
        <p style="color: var(--muted); font-size: 0.95rem;">Create, configure, and inspect your progress trackers.</p>
      </div>
      <div style="display: flex; gap: 8px;">
        <button id="toggleArchivedBtn" class="btn secondary" style="font-size: 0.9rem;">
          ${showArchived ? 'View Active Trackers' : `View Archived (${archivedTrackers.length})`}
        </button>
        <button id="openCreateTrackerModalBtn" class="btn primary" style="font-size: 0.9rem;">+ Create Tracker</button>
      </div>
    </div>
  `;

  if (listToRender.length === 0) {
    html += `
      <div class="empty-state">
        <h3>No ${showArchived ? 'archived' : 'active'} trackers found</h3>
        <p>${showArchived ? 'You have no archived trackers.' : 'Get started by creating a tracker for your course syllabus or logs!'}</p>
        ${!showArchived ? '<button id="emptyCreateTrackerBtn" class="btn primary">Create Tracker</button>' : ''}
      </div>
    `;
    container.innerHTML = html;

    // Attach listeners
    document.getElementById('toggleArchivedBtn')?.addEventListener('click', () => {
      showArchived = !showArchived;
      renderTrackerList();
    });
    document.getElementById('openCreateTrackerModalBtn')?.addEventListener('click', () => {
      document.getElementById('createTrackerModal')?.classList.add('open');
    });
    document.getElementById('emptyCreateTrackerBtn')?.addEventListener('click', () => {
      document.getElementById('createTrackerModal')?.classList.add('open');
    });
    return;
  }

  // Layout with a left-hand list of trackers and a right-hand detail pane
  html += `
    <div style="display: grid; grid-template-columns: 300px 1fr; gap: 24px; align-items: start;">
      <!-- Left sidebar: tracker selectors -->
      <div style="display: flex; flex-direction: column; gap: 10px;" role="tablist" aria-label="Tracker Selection">
        ${listToRender.map(t => {
          const isSelected = t.id === selectedTrackerId;
          return `
            <div 
              class="card" 
              data-tracker-list-id="${t.id}"
              style="padding: 16px; cursor: pointer; border-color: ${isSelected ? 'var(--gold)' : 'var(--line)'}; background-color: ${isSelected ? 'var(--paper-warm)' : 'var(--card)'};"
              role="tab"
              aria-selected="${isSelected ? 'true' : 'false'}"
            >
              <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 4px;">
                <span style="font-weight: 600; font-family: var(--font-display); font-size: 1.1rem;">${escapeHtml(t.name)}</span>
                <span class="badge ${t.type}" style="font-size: 0.7rem; padding: 1px 6px;">${t.type === 'course' ? 'Course' : 'Log'}</span>
              </div>
              <span style="font-size: 0.8rem; color: var(--muted);">Created: ${new Date(t.createdAt).toLocaleDateString()}</span>
            </div>
          `;
        }).join('')}
      </div>

      <!-- Right sidebar: details/entries of selected tracker -->
      <div id="trackerDetailsPane" class="card" style="min-height: 400px; gap: 20px;">
        <div style="display: flex; align-items: center; justify-content: center; height: 350px; color: var(--muted); font-family: var(--font-serif); font-style: italic;">
          Select a tracker from the list to view and manage its data.
        </div>
      </div>
    </div>
  `;

  container.innerHTML = html;

  // Wire up page controls
  document.getElementById('toggleArchivedBtn')?.addEventListener('click', () => {
    showArchived = !showArchived;
    // reset selected if list changes
    selectedTrackerId = null;
    renderTrackerList();
  });

  document.getElementById('openCreateTrackerModalBtn')?.addEventListener('click', () => {
    document.getElementById('createTrackerModal')?.classList.add('open');
  });

  // Selector clicks
  const rows = container.querySelectorAll('[data-tracker-list-id]');
  rows.forEach(row => {
    row.addEventListener('click', () => {
      const id = row.getAttribute('data-tracker-list-id');
      selectedTrackerId = id;
      // Re-highlight selectors
      rows.forEach(r => {
        const rId = r.getAttribute('data-tracker-list-id');
        r.style.borderColor = rId === id ? 'var(--gold)' : 'var(--line)';
        r.style.backgroundColor = rId === id ? 'var(--paper-warm)' : 'var(--card)';
        r.setAttribute('aria-selected', rId === id ? 'true' : 'false');
      });
      // Render details pane
      const tracker = trackers.find(t => t.id === id);
      if (tracker) {
        renderDetailsPane(tracker);
      }
    });
  });

  // Auto-select first tracker if none selected
  if (!selectedTrackerId && listToRender.length > 0) {
    const firstRow = container.querySelector('[data-tracker-list-id]');
    firstRow?.click();
  } else if (selectedTrackerId) {
    // Re-trigger select for the already selected item
    const selectedRow = container.querySelector(`[data-tracker-list-id="${selectedTrackerId}"]`);
    if (selectedRow) {
      selectedRow.click();
    } else {
      // In case selected was deleted or archived and hidden
      selectedTrackerId = null;
      const firstRow = container.querySelector('[data-tracker-list-id]');
      firstRow?.click();
    }
  }
}

function renderDetailsPane(tracker) {
  const pane = document.getElementById('trackerDetailsPane');
  if (!pane) return;

  const entriesKey = `tracker:${tracker.id}:entries`;
  const data = storageGet(entriesKey, []);

  let innerHtml = `
    <div style="display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 2px solid var(--line); padding-bottom: 16px; flex-wrap: wrap; gap: 12px;">
      <div>
        <div style="display: flex; align-items: center; gap: 12px; margin-bottom: 4px;">
          <h2 style="font-family: var(--font-display); font-size: 1.6rem; margin: 0;">${escapeHtml(tracker.name)}</h2>
          <span class="badge ${tracker.type}">${tracker.type === 'course' ? 'Course Syllabus' : 'Log'}</span>
        </div>
        <p style="font-size: 0.85rem; color: var(--muted); font-family: var(--font-mono);">ID: ${tracker.id}</p>
      </div>
      <div style="display: flex; gap: 8px;">
        <button id="importDataBtn" class="btn primary" style="font-size: 0.85rem;">📥 Import JSON</button>
        <button id="archiveActionBtn" class="btn secondary" style="font-size: 0.85rem;">
          ${tracker.archived ? 'Unarchive' : 'Archive'}
        </button>
        <button id="deleteActionBtn" class="btn danger" style="font-size: 0.85rem;">Delete</button>
      </div>
    </div>
  `;

  // Content Table
  if (tracker.type === 'course') {
    if (data.length === 0) {
      innerHtml += `
        <div style="text-align: center; padding: 40px 16px; color: var(--muted);">
          <p style="font-family: var(--font-serif); font-style: italic; font-size: 1.1rem; margin-bottom: 12px;">No syllabus topics found.</p>
          <button id="syllabusImportBtn" class="btn secondary">📥 Import Syllabus JSON</button>
        </div>
      `;
    } else {
      innerHtml += `
        <div>
          <h3 style="font-size: 1.1rem; margin-bottom: 12px;">Syllabus Topics (${data.length})</h3>
          <div class="table-container">
            <table>
              <thead>
                <tr>
                  <th>Section</th>
                  <th>Topic Name</th>
                  <th>Reference</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                ${data.map(topic => `
                  <tr>
                    <td><strong>${escapeHtml(topic.section)}</strong></td>
                    <td>${escapeHtml(topic.name)}</td>
                    <td style="color: var(--muted); font-size: 0.85rem;">${escapeHtml(topic.reference || '—')}</td>
                    <td>
                      <span class="badge" style="background-color: var(--paper-warm); color: var(--ink); text-transform: none; font-size: 0.75rem;">
                        ${topic.status || 'Not Started'}
                      </span>
                    </td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
          </div>
        </div>
      `;
    }
  } else {
    // Log tracker details
    if (data.length === 0) {
      innerHtml += `
        <div style="text-align: center; padding: 40px 16px; color: var(--muted);">
          <p style="font-family: var(--font-serif); font-style: italic; font-size: 1.1rem; margin-bottom: 12px;">No entries logged yet.</p>
          <button id="logImportBtn" class="btn secondary">📥 Import Logs JSON</button>
        </div>
      `;
    } else {
      innerHtml += `
        <div>
          <h3 style="font-size: 1.1rem; margin-bottom: 12px;">Logged Entries (${data.length})</h3>
          <div class="table-container">
            <table>
              <thead>
                <tr>
                  ${tracker.schema.map(f => `<th>${escapeHtml(f.label)}</th>`).join('')}
                </tr>
              </thead>
              <tbody>
                ${data.map(entry => `
                  <tr>
                    ${tracker.schema.map(f => {
                      const val = entry[f.key];
                      let display = '—';
                      if (val !== undefined && val !== null && val !== '') {
                        display = escapeHtml(String(val));
                        if (f.unit) display += ` ${escapeHtml(f.unit)}`;
                      }
                      return `<td>${display}</td>`;
                    }).join('')}
                  </tr>
                `).join('')}
              </tbody>
            </table>
          </div>
        </div>
      `;
    }
  }

  pane.innerHTML = innerHtml;

  // Event bindings for Pane actions
  document.getElementById('importDataBtn')?.addEventListener('click', () => {
    openImportModal(tracker);
  });
  document.getElementById('syllabusImportBtn')?.addEventListener('click', () => {
    openImportModal(tracker);
  });
  document.getElementById('logImportBtn')?.addEventListener('click', () => {
    openImportModal(tracker);
  });

  // Archive
  document.getElementById('archiveActionBtn')?.addEventListener('click', () => {
    const nextArchived = !tracker.archived;
    archiveTracker(tracker.id, nextArchived);
    showToast(`Tracker "${tracker.name}" ${nextArchived ? 'archived' : 'unarchived'}.`);
    // If we archived it, clear active selection from list view
    if (nextArchived) {
      selectedTrackerId = null;
    }
    renderTrackerList();
  });

  // Delete
  document.getElementById('deleteActionBtn')?.addEventListener('click', () => {
    if (confirm(`Are you absolutely sure you want to permanently delete the tracker "${tracker.name}"?\nAll study metrics, logs, and stored progress will be lost forever. This action cannot be undone.`)) {
      deleteTracker(tracker.id);
      showToast(`Tracker "${tracker.name}" has been permanently deleted.`, true);
      selectedTrackerId = null;
      renderTrackerList();
    }
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
