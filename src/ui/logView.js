import { storageGet, storageSet } from '../core/storage.js';
import { calculateAggregates } from '../trackers/logTracker.js';
import { renderChartView } from './chartsView.js';
import { showToast, renderActiveView } from './main.js';

let activeTab = 'table'; // 'table' or 'charts'

/**
 * Renders the Log Tracker detailed view inside the details pane.
 * @param {object} tracker 
 */
export function renderLogView(tracker) {
  const pane = document.getElementById('trackerDetailsPane');
  if (!pane) return;

  const entriesKey = `tracker:${tracker.id}:entries`;
  const entries = storageGet(entriesKey, []);

  let html = `
    <!-- Header Controls -->
    <div style="display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 2px solid var(--line); padding-bottom: 16px; flex-wrap: wrap; gap: 12px;">
      <div>
        <div style="display: flex; align-items: center; gap: 12px; margin-bottom: 4px;">
          <h2 style="font-family: var(--font-display); font-size: 1.6rem; margin: 0;">${escapeHtml(tracker.name)}</h2>
          <span class="badge ${tracker.type}">Activity Log</span>
        </div>
        <p style="font-size: 0.85rem; color: var(--muted); font-family: var(--font-mono);">ID: ${tracker.id}</p>
      </div>
      <div style="display: flex; gap: 8px;">
        <button id="importLogsBtn" class="btn primary" style="font-size: 0.85rem;">📥 Import Logs</button>
        <button id="archiveTrackerBtn" class="btn secondary" style="font-size: 0.85rem;">
          ${tracker.archived ? 'Unarchive' : 'Archive'}
        </button>
        <button id="deleteTrackerBtn" class="btn danger" style="font-size: 0.85rem;">Delete</button>
      </div>
    </div>

    <!-- Sub-tab Navigation (Table vs Charts) -->
    <div style="display: flex; gap: 12px; border-bottom: 1px solid var(--line); margin-top: 12px;">
      <button id="logTabTable" class="btn ghost ${activeTab === 'table' ? 'primary' : ''}" style="padding: 6px 16px; font-size: 0.9rem; border-radius: var(--radius-sm); border-bottom-left-radius: 0; border-bottom-right-radius: 0;">
        📋 Log Entries
      </button>
      <button id="logTabCharts" class="btn ghost ${activeTab === 'charts' ? 'primary' : ''}" style="padding: 6px 16px; font-size: 0.9rem; border-radius: var(--radius-sm); border-bottom-left-radius: 0; border-bottom-right-radius: 0;">
        📈 Analytics Charts
      </button>
    </div>

    <!-- Active Tab Pane -->
    <div id="logActivePane" style="margin-top: 16px; display: flex; flex-direction: column; gap: 20px;"></div>
  `;

  pane.innerHTML = html;

  // Bind header buttons
  bindHeaderActions(tracker);

  // Bind tab toggles
  const tabTable = document.getElementById('logTabTable');
  const tabCharts = document.getElementById('logTabCharts');
  const activePane = document.getElementById('logActivePane');

  tabTable?.addEventListener('click', () => {
    activeTab = 'table';
    tabTable.classList.add('primary');
    tabCharts?.classList.remove('primary');
    renderActiveTabContent(tracker, activePane, entries);
  });

  tabCharts?.addEventListener('click', () => {
    activeTab = 'charts';
    tabCharts.classList.add('primary');
    tabTable?.classList.remove('primary');
    renderActiveTabContent(tracker, activePane, entries);
  });

  // Render initial active tab content
  renderActiveTabContent(tracker, activePane, entries);
}

function renderActiveTabContent(tracker, pane, entries) {
  if (!pane) return;

  if (activeTab === 'table') {
    if (entries.length === 0) {
      pane.innerHTML = `
        <div style="text-align: center; padding: 40px 16px; color: var(--muted);">
          <p style="font-family: var(--font-serif); font-style: italic; font-size: 1.1rem; margin-bottom: 16px;">
            No entries logged yet. Import spreadsheet CSV/JSON data to get started.
          </p>
          <button id="importLogsBtn2" class="btn secondary">📥 Import Logs JSON</button>
        </div>
      `;
      document.getElementById('importLogsBtn2')?.addEventListener('click', () => {
        import { openImportModal } from './importModal.js';
        openImportModal(tracker);
      });
      return;
    }

    // Calculate aggregates
    const aggs = calculateAggregates(entries, tracker.schema);
    const numFields = tracker.schema.filter(f => f.kind === 'number');

    let aggsHtml = '';
    if (numFields.length > 0) {
      aggsHtml += `
        <!-- Aggregate summaries -->
        <div style="display: grid; grid-template-columns: repeat(auto-fill, minmax(220px, 1fr)); gap: 12px; margin-bottom: 8px;">
          ${numFields.map(f => {
            const stat = aggs[f.key];
            if (!stat) return '';
            return `
              <div style="background-color: var(--card); border: 1px solid var(--line); border-radius: var(--radius-md); padding: 12px; box-shadow: 0 2px 4px var(--shadow);">
                <div style="font-size: 0.75rem; text-transform: uppercase; font-weight: 600; color: var(--muted);">${escapeHtml(f.label)} Statistics</div>
                <div style="margin-top: 6px; display: flex; flex-direction: column; gap: 4px;">
                  <div style="display: flex; justify-content: space-between; font-size: 0.9rem;">
                    <span>This Week:</span>
                    <strong>${stat.sumThisWeek.toFixed(1)} ${f.unit || ''}</strong>
                  </div>
                  <div style="display: flex; justify-content: space-between; font-size: 0.9rem;">
                    <span>Lifetime Total:</span>
                    <strong>${stat.sumLifetime.toFixed(1)} ${f.unit || ''}</strong>
                  </div>
                  <div style="display: flex; justify-content: space-between; font-size: 0.9rem;">
                    <span>Lifetime Avg:</span>
                    <strong>${stat.avgLifetime.toFixed(1)} ${f.unit || ''}</strong>
                  </div>
                </div>
              </div>
            `;
          }).join('')}
        </div>
      `;
    }

    // Render Table log
    let tableHtml = `
      ${aggsHtml}
      <div>
        <h3 style="font-size: 1.1rem; margin-bottom: 12px;">Entries Logs</h3>
        <div class="table-container">
          <table>
            <thead>
              <tr>
                ${tracker.schema.map(f => `<th>${escapeHtml(f.label)}</th>`).join('')}
                <th style="width: 70px; text-align: center;">Actions</th>
              </tr>
            </thead>
            <tbody>
              ${entries.map((entry, idx) => `
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
                  <td style="text-align: center;">
                    <button class="btn danger delete-row-btn" data-row-idx="${idx}" style="padding: 2px 6px; font-size: 0.75rem; font-weight: 600;">
                      &times; Delete
                    </button>
                  </td>
                </tr>
              `).reverse().join('') /* newest first */}
            </tbody>
          </table>
        </div>
      </div>
    `;

    pane.innerHTML = tableHtml;

    // Bind row deletions
    pane.querySelectorAll('.delete-row-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const idx = parseInt(btn.dataset.rowIdx, 10);
        if (confirm('Are you sure you want to permanently delete this log entry?')) {
          entries.splice(idx, 1);
          storageSet(`tracker:${tracker.id}:entries`, entries);
          showToast('Entry deleted successfully.');
          renderLogView(tracker);
        }
      });
    });
  } else {
    // Analytics Charts view
    const chartDiv = document.createElement('div');
    chartDiv.id = 'logChartsViewContainer';
    pane.appendChild(chartDiv);
    renderChartView(tracker, chartDiv);
  }
}

function bindHeaderActions(tracker) {
  document.getElementById('importLogsBtn')?.addEventListener('click', () => {
    import { openImportModal } from './importModal.js';
    openImportModal(tracker);
  });

  // Archive
  document.getElementById('archiveTrackerBtn')?.addEventListener('click', () => {
    import { archiveTracker } from '../core/trackerRegistry.js';
    const nextArchived = !tracker.archived;
    archiveTracker(tracker.id, nextArchived);
    showToast(`Tracker "${tracker.name}" ${nextArchived ? 'archived' : 'unarchived'}.`);
    renderActiveView();
  });

  // Delete
  document.getElementById('deleteTrackerBtn')?.addEventListener('click', () => {
    import { deleteTracker } from '../core/trackerRegistry.js';
    if (confirm(`Are you absolutely sure you want to permanently delete the tracker "${tracker.name}"?\nAll study metrics, logs, and stored progress will be lost forever.`)) {
      deleteTracker(tracker.id);
      showToast(`Tracker "${tracker.name}" has been permanently deleted.`, true);
      renderActiveView();
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
