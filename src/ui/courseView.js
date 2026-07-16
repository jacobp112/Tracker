import { storageGet, storageSet } from '../core/storage.js';
import { getTopicStudySignal, recordReview, recordTest, topicHealth, predictRetention } from '../trackers/courseTracker.js';
import { showToast, renderActiveView } from './main.js';
import { openImportModal } from './importModal.js';
import { archiveTracker, deleteTracker, renameTracker } from '../core/trackerRegistry.js';

// Track which sections are collapsed: default all expanded
const collapsedSections = new Set();
// Track which topic drawers are expanded
const expandedTopics = new Set();

/**
 * Formats seconds into human-readable duration.
 */
function formatDuration(totalSeconds) {
  const total = Math.max(0, Math.floor(Number(totalSeconds) || 0));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  if (h) return `${h}h ${String(m).padStart(2, '0')}m`;
  if (m) return `${m}m ${String(s).padStart(2, '0')}s`;
  return `${s}s`;
}

/**
 * Renders the Course View.
 * @param {object} tracker 
 */
export function renderCourseView(tracker) {
  const pane = document.getElementById('trackerDetailsPane');
  if (!pane) return;

  const entriesKey = `tracker:${tracker.id}:entries`;
  const topics = storageGet(entriesKey, []);

  let html = `
    <div style="display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 2px solid var(--line); padding-bottom: 16px; flex-wrap: wrap; gap: 12px;">
      <div>
        <div style="display: flex; align-items: center; gap: 12px; margin-bottom: 4px;">
          <h2 style="font-family: var(--font-display); font-size: 1.6rem; margin: 0;">${escapeHtml(tracker.name)}</h2>
          <span class="badge ${tracker.type}">Course Syllabus</span>
        </div>
        <p style="font-size: 0.85rem; color: var(--muted); font-family: var(--font-mono);">ID: ${tracker.id}</p>
      </div>
      <div style="display: flex; gap: 8px;">
        <button id="importSyllabusBtn" class="btn primary" style="font-size: 0.85rem;">📥 Import Syllabus</button>
        <button id="renameTrackerBtn" class="btn secondary" style="font-size: 0.85rem;">Rename</button>
        <button id="archiveTrackerBtn" class="btn secondary" style="font-size: 0.85rem;">
          ${tracker.archived ? 'Unarchive' : 'Archive'}
        </button>
        <button id="deleteTrackerBtn" class="btn danger" style="font-size: 0.85rem;">Delete</button>
      </div>
    </div>
  `;

  if (topics.length === 0) {
    html += `
      <div style="text-align: center; padding: 60px 16px; color: var(--muted);">
        <p style="font-family: var(--font-serif); font-style: italic; font-size: 1.15rem; margin-bottom: 16px;">
          No topics in this syllabus yet. Paste your handbook topics using the import pipeline.
        </p>
        <button id="importSyllabusBtn2" class="btn secondary">📥 Import Syllabus JSON</button>
      </div>
    `;
    pane.innerHTML = html;
    bindHeaderActions(tracker);
    return;
  }

  // Group topics by section
  const sections = {};
  topics.forEach(t => {
    if (!sections[t.section]) sections[t.section] = [];
    sections[t.section].push(t);
  });

  // Calculate overall syllabus stats
  const totalTopics = topics.length;
  const mastered = topics.filter(t => t.status === 'Mastered').length;
  const practicing = topics.filter(t => t.status === 'Practising').length;
  const learning = topics.filter(t => t.status === 'Learning').length;

  html += `
    <!-- Stats Cards Panel -->
    <div style="display: grid; grid-template-columns: repeat(4, 1fr); gap: 12px; margin-bottom: 8px;">
      <div style="background: var(--paper-warm); padding: 12px; border-radius: var(--radius-md); text-align: center;">
        <div style="font-size: 0.75rem; font-weight: 600; text-transform: uppercase; color: var(--muted);">Total</div>
        <div style="font-size: 1.6rem; font-weight: 600; font-family: var(--font-display);">${totalTopics}</div>
      </div>
      <div style="background: var(--paper-warm); padding: 12px; border-radius: var(--radius-md); text-align: center;">
        <div style="font-size: 0.75rem; font-weight: 600; text-transform: uppercase; color: var(--muted); color: var(--gold);">Mastered</div>
        <div style="font-size: 1.6rem; font-weight: 600; font-family: var(--font-display); color: var(--gold);">${mastered}</div>
      </div>
      <div style="background: var(--paper-warm); padding: 12px; border-radius: var(--radius-md); text-align: center;">
        <div style="font-size: 0.75rem; font-weight: 600; text-transform: uppercase; color: var(--muted); color: var(--sage);">Practising</div>
        <div style="font-size: 1.6rem; font-weight: 600; font-family: var(--font-display); color: var(--sage);">${practising}</div>
      </div>
      <div style="background: var(--paper-warm); padding: 12px; border-radius: var(--radius-md); text-align: center;">
        <div style="font-size: 0.75rem; font-weight: 600; text-transform: uppercase; color: var(--muted);">Learning</div>
        <div style="font-size: 1.6rem; font-weight: 600; font-family: var(--font-display);">${learning}</div>
      </div>
    </div>
  `;

  // Render collapsible sections
  html += `<div style="display: flex; flex-direction: column; gap: 16px;">`;

  Object.entries(sections).forEach(([sectionName, sectionTopics]) => {
    const isCollapsed = collapsedSections.has(sectionName);
    const sectionMastered = sectionTopics.filter(t => t.status === 'Mastered').length;
    const sectionTotal = sectionTopics.length;

    html += `
      <div style="border: 1px solid var(--line); border-radius: var(--radius-lg); background-color: var(--card); overflow: hidden;">
        <!-- Section Header Toggle -->
        <div class="section-toggle-header" data-section="${escapeHtml(sectionName)}" style="display: flex; justify-content: space-between; align-items: center; padding: 12px 18px; background-color: var(--paper-warm); cursor: pointer; user-select: none;">
          <h3 style="font-size: 1.15rem; font-family: var(--font-display); margin: 0; display: flex; align-items: center; gap: 8px;">
            <span>${isCollapsed ? '&#9654;' : '&#9660;'}</span>
            ${escapeHtml(sectionName)}
          </h3>
          <span style="font-size: 0.85rem; color: var(--muted); font-weight: 600;">
            ${sectionMastered}/${sectionTotal} Mastered
          </span>
        </div>

        <!-- Section Topics Container -->
        <div style="display: ${isCollapsed ? 'none' : 'block'}; border-top: 1px solid var(--line);">
          <div style="display: flex; flex-direction: column;">
            ${sectionTopics.map(topic => renderTopicRow(tracker, topic)).join('')}
          </div>
        </div>
      </div>
    `;
  });

  html += `</div>`;
  pane.innerHTML = html;

  bindHeaderActions(tracker);
  bindTopicActions(tracker, topics);
}

/**
 * Renders a single topic row, incorporating play/stop timer buttons, status select, and confidence dots.
 */
function renderTopicRow(tracker, topic) {
  const activeTimer = storageGet('tracker:activeTimer', null);
  const isTimerRunning = activeTimer && activeTimer.trackerId === tracker.id && activeTimer.topicId === topic.id;
  const isExpanded = expandedTopics.has(topic.id);

  // Compute live duration
  let liveSeconds = Number(topic.studySeconds) || 0;
  if (isTimerRunning) {
    liveSeconds += Math.floor((Date.now() - activeTimer.startedAt) / 1000);
  }

  // Get active study signal
  const signal = getTopicStudySignal(topic);
  const health = topicHealth(topic);
  const confScore = parseInt(topic.conf, 10) || 0;

  // Render stars/dots for confidence
  let dotsHtml = '';
  for (let i = 1; i <= 5; i++) {
    dotsHtml += `
      <span class="conf-dot" data-topic-id="${topic.id}" data-val="${i}" 
            style="cursor: pointer; font-size: 1.25rem; color: ${i <= confScore ? 'var(--gold)' : 'var(--line)'}; transition: color 0.1s ease; padding: 0 2px;">
        ●
      </span>
    `;
  }

  return `
    <div style="border-bottom: 1px solid var(--line); display: flex; flex-direction: column;">
      <!-- Main Row -->
      <div style="display: flex; align-items: center; padding: 12px 16px; gap: 16px; flex-wrap: wrap;" class="topic-row-container">
        
        <!-- Timer play/stop -->
        <div style="display: flex; align-items: center; gap: 8px;">
          <button class="btn timer-btn ${isTimerRunning ? 'danger' : 'secondary'}" 
                  data-topic-id="${topic.id}" 
                  style="width: 36px; height: 36px; border-radius: 50%; padding: 0; display: inline-flex; align-items: center; justify-content: center; font-size: 0.95rem;">
            ${isTimerRunning ? '⏹' : '▶'}
          </button>
          <span class="timer-display" data-live-topic-id="${topic.id}" style="font-family: var(--font-mono); font-size: 0.85rem; min-width: 60px;">
            ${formatDuration(liveSeconds)}
          </span>
        </div>

        <!-- Topic details -->
        <div style="flex: 1; min-width: 180px;">
          <div style="font-weight: 500; font-size: 1.05rem;">${escapeHtml(topic.name)}</div>
          ${topic.reference ? `<div style="font-size: 0.8rem; color: var(--muted); font-family: var(--font-serif); font-style: italic;">Ref: ${escapeHtml(topic.reference)}</div>` : ''}
        </div>

        <!-- Status pick -->
        <div>
          <select class="form-select status-select" data-topic-id="${topic.id}" style="padding: 4px 8px; font-size: 0.85rem; width: 110px;">
            <option value="Not Started" ${topic.status === 'Not Started' ? 'selected' : ''}>Not Started</option>
            <option value="Learning" ${topic.status === 'Learning' ? 'selected' : ''}>Learning</option>
            <option value="Practising" ${topic.status === 'Practising' ? 'selected' : ''}>Practising</option>
            <option value="Mastered" ${topic.status === 'Mastered' ? 'selected' : ''}>Mastered</option>
          </select>
        </div>

        <!-- Confidence dots -->
        <div style="display: flex; align-items: center; min-width: 90px; justify-content: center;">
          ${dotsHtml}
        </div>

        <!-- Signals and health -->
        <div style="display: flex; align-items: center; gap: 8px; min-width: 140px; justify-content: flex-end;">
          ${signal ? `<span class="badge-tag ${signal.cls}" title="${escapeHtml(signal.detail)}">${escapeHtml(signal.label)}</span>` : ''}
          ${topic.status !== 'Not Started' ? `
            <span class="badge" style="background-color: ${health < 40 ? 'var(--rose-soft)' : (health <= 70 ? 'var(--gold-soft-bg)' : 'var(--sage-soft)')}; color: ${health < 40 ? 'var(--rose)' : (health <= 70 ? 'var(--gold)' : 'var(--sage)')};" title="Bjork Health Score: ${health}%">
              ${health}%
            </span>
          ` : ''}
        </div>

        <!-- Details drawer toggle -->
        <div>
          <button class="btn ghost toggle-drawer-btn" data-topic-id="${topic.id}" style="padding: 4px 8px;">
            ${isExpanded ? '▲ Hide' : '▼ Details'}
          </button>
        </div>
      </div>

      <!-- Collapsible Drawer -->
      <div class="topic-drawer-panel" style="display: ${isExpanded ? 'block' : 'none'}; background-color: var(--paper); border-top: 1px dashed var(--line); padding: 18px 24px;">
        ${renderDrawerBody(topic)}
      </div>
    </div>
  `;
}

/**
 * Renders the detailed study/test history inside the collapsible drawer.
 */
function renderDrawerBody(topic) {
  const reviews = topic.reviewHistory || [];
  const tests = topic.tests || [];
  const errors = topic.errors || [];
  const notesVal = topic.note || '';

  let html = `
    <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 24px; align-items: start;">
      
      <!-- Left side: notes & loggers -->
      <div style="display: flex; flex-direction: column; gap: 16px;">
        <!-- Notes text area -->
        <div class="form-group" style="margin-bottom: 0;">
          <label style="font-size: 0.8rem; font-weight: 600;">Study Notes</label>
          <textarea class="form-textarea notes-ta" data-topic-id="${topic.id}" placeholder="Jot down formulas, core concepts, or active recall triggers here..." style="font-family: var(--font-sans); height: 80px; min-height: 80px;">${escapeHtml(notesVal)}</textarea>
        </div>

        <!-- Log Test Score Form -->
        <div style="border: 1px solid var(--line); border-radius: var(--radius-md); padding: 12px; background-color: var(--card);">
          <h4 style="font-size: 0.95rem; margin-bottom: 8px; border-bottom: 1px solid var(--line); padding-bottom: 4px;">Log Test Result</h4>
          <form class="log-test-form" data-topic-id="${topic.id}" style="display: flex; flex-direction: column; gap: 8px;">
            <div style="display: flex; gap: 8px;">
              <div class="form-group" style="flex: 1; margin-bottom: 0;">
                <label style="font-size: 0.75rem;">Score</label>
                <input type="number" class="form-input test-score" required min="0" placeholder="8" style="padding: 4px 6px; font-size: 0.8rem;">
              </div>
              <div class="form-group" style="flex: 1; margin-bottom: 0;">
                <label style="font-size: 0.75rem;">Out Of</label>
                <input type="number" class="form-input test-outof" required min="1" placeholder="10" style="padding: 4px 6px; font-size: 0.8rem;">
              </div>
              <div class="form-group" style="flex: 1; margin-bottom: 0;">
                <label style="font-size: 0.75rem;">Confidence</label>
                <select class="form-select test-conf" style="padding: 4px 6px; font-size: 0.8rem;">
                  <option value="5">5 - Mastered</option>
                  <option value="4">4 - High</option>
                  <option value="3" selected>3 - Medium</option>
                  <option value="2">2 - Low</option>
                  <option value="1">1 - Confused</option>
                </select>
              </div>
            </div>
            <div class="form-group" style="margin-bottom: 0;">
              <label style="font-size: 0.75rem;">Test Note / Misconception</label>
              <input type="text" class="form-input test-note" placeholder="e.g. Forgot BODMAS sign change" style="padding: 4px 6px; font-size: 0.8rem;">
            </div>
            <button type="submit" class="btn primary" style="padding: 6px 12px; font-size: 0.8rem; align-self: flex-start; margin-top: 4px;">Log Test</button>
          </form>
        </div>
      </div>

      <!-- Right side: History & Error Logs -->
      <div style="display: flex; flex-direction: column; gap: 16px;">
        <!-- Review Logs -->
        <div>
          <h4 style="font-size: 0.95rem; margin-bottom: 6px;">History Logs</h4>
          <div style="max-height: 120px; overflow-y: auto; border: 1px solid var(--line); border-radius: var(--radius-md); padding: 8px; background: var(--card); display: flex; flex-direction: column; gap: 6px;">
            ${reviews.length === 0 && tests.length === 0 ? `
              <span style="font-size: 0.8rem; color: var(--muted); font-style: italic;">No history logs captured yet.</span>
            ` : ''}
            
            <!-- Render tests -->
            ${tests.map(t => `
              <div style="font-size: 0.8rem; border-bottom: 1px solid var(--line); padding-bottom: 4px; margin-bottom: 4px; display: flex; justify-content: space-between;">
                <span>📝 <strong>Score: ${t.score}/${t.outOf}</strong> (Conf: ${t.confidence})</span>
                <span style="color: var(--muted); font-size: 0.75rem;">${t.date}</span>
              </div>
            `).join('')}

            <!-- Render reviews -->
            ${reviews.map(r => `
              <div style="font-size: 0.8rem; display: flex; justify-content: space-between;">
                <span>📅 Reviewed (Conf: ${r.confidence}, Source: ${escapeHtml(r.source)})</span>
                <span style="color: var(--muted); font-size: 0.75rem;">${r.date}</span>
              </div>
            `).join('')}
          </div>
        </div>

        <!-- Misconceptions / Active Errors -->
        <div>
          <h4 style="font-size: 0.95rem; margin-bottom: 6px; display: flex; justify-content: space-between; align-items: center;">
            <span>Active Misconceptions</span>
            ${errors.filter(e => e.status === 'active').length >= 3 ? `<span class="badge danger" style="font-size: 0.65rem; padding: 2px 6px;">Friction Warning</span>` : ''}
          </h4>
          <div style="max-height: 120px; overflow-y: auto; border: 1px solid var(--line); border-radius: var(--radius-md); padding: 8px; background: var(--card); display: flex; flex-direction: column; gap: 6px;">
            ${errors.length === 0 ? `
              <span style="font-size: 0.8rem; color: var(--muted); font-style: italic;">No active misconceptions recorded. Pass your tests to stay clean!</span>
            ` : ''}
            ${errors.map((e, idx) => `
              <div style="font-size: 0.8rem; display: flex; justify-content: space-between; align-items: center; border-bottom: ${idx < errors.length - 1 ? '1px dashed var(--line)' : 'none'}; padding-bottom: 4px;">
                <span style="text-decoration: ${e.status === 'resolved' ? 'line-through' : 'none'}; color: ${e.status === 'resolved' ? 'var(--muted)' : 'var(--ink)'};">
                  ❌ ${escapeHtml(e.note)}
                </span>
                <button class="btn ghost toggle-error-btn" data-topic-id="${topic.id}" data-error-idx="${idx}" style="padding: 2px 6px; font-size: 0.7rem; background-color: var(--paper-warm);">
                  ${e.status === 'resolved' ? 'Activate' : 'Resolve'}
                </button>
              </div>
            `).join('')}
          </div>
        </div>
      </div>

    </div>
  `;
  return html;
}

/**
 * Binds actions for Tracker view headers.
 */
function bindHeaderActions(tracker) {
  document.getElementById('importSyllabusBtn')?.addEventListener('click', () => {
    openImportModal(tracker);
  });
  document.getElementById('importSyllabusBtn2')?.addEventListener('click', () => {
    openImportModal(tracker);
  });

  // Rename
  document.getElementById('renameTrackerBtn')?.addEventListener('click', () => {
    const newName = prompt('Enter new name for this tracker:', tracker.name);
    if (newName && newName.trim() !== '') {
      renameTracker(tracker.id, newName.trim());
      showToast(`Renamed tracker to "${newName.trim()}".`);
      // Refresh view
      tracker.name = newName.trim();
      renderCourseView(tracker);
      // Refresh sidebar
      renderActiveView();
    }
  });

  // Archive
  document.getElementById('archiveTrackerBtn')?.addEventListener('click', () => {
    const nextArchived = !tracker.archived;
    archiveTracker(tracker.id, nextArchived);
    showToast(`Tracker "${tracker.name}" ${nextArchived ? 'archived' : 'unarchived'}.`);
    // re-trigger active view
    renderActiveView();
  });

  // Delete
  document.getElementById('deleteTrackerBtn')?.addEventListener('click', () => {
    if (confirm(`Are you absolutely sure you want to permanently delete the tracker "${tracker.name}"?\nAll study metrics, logs, and stored progress will be lost forever.`)) {
      deleteTracker(tracker.id);
      showToast(`Tracker "${tracker.name}" has been permanently deleted.`, true);
      renderActiveView();
    }
  });
}

/**
 * Binds actions for Topic rows (timers, dropdowns, confidence dots, expanders).
 */
function bindTopicActions(tracker, topics) {
  const entriesKey = `tracker:${tracker.id}:entries`;

  // Collapsible Sections
  document.querySelectorAll('.section-toggle-header').forEach(header => {
    header.addEventListener('click', () => {
      const section = header.dataset.section;
      if (collapsedSections.has(section)) {
        collapsedSections.delete(section);
      } else {
        collapsedSections.add(section);
      }
      renderCourseView(tracker);
    });
  });

  // Collapsible Topic Details Drawers
  document.querySelectorAll('.toggle-drawer-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const topicId = btn.dataset.topicId;
      if (expandedTopics.has(topicId)) {
        expandedTopics.delete(topicId);
      } else {
        expandedTopics.add(topicId);
      }
      renderCourseView(tracker);
    });
  });

  // Timer button play/stop toggles
  document.querySelectorAll('.timer-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const topicId = btn.dataset.topicId;
      handleTimerToggle(tracker, topicId);
    });
  });

  // Status select dropdowns
  document.querySelectorAll('.status-select').forEach(select => {
    select.addEventListener('change', (e) => {
      const topicId = select.dataset.topicId;
      const status = e.target.value;

      const topicIdx = topics.findIndex(t => t.id === topicId);
      if (topicIdx !== -1) {
        topics[topicIdx].status = status;
        if (status === 'Mastered') {
          topics[topicIdx].conf = '5';
        } else if (status === 'Learning' && topics[topicIdx].conf === '') {
          topics[topicIdx].conf = '2';
        }
        storageSet(entriesKey, topics);
        showToast(`Updated "${topics[topicIdx].name}" status to ${status}.`);
        renderCourseView(tracker);
      }
    });
  });

  // Confidence dots
  document.querySelectorAll('.conf-dot').forEach(dot => {
    dot.addEventListener('click', () => {
      const topicId = dot.dataset.topicId;
      const val = dot.dataset.val;

      const topicIdx = topics.findIndex(t => t.id === topicId);
      if (topicIdx !== -1) {
        const topic = topics[topicIdx];
        recordReview(topic, val, 'study');
        storageSet(entriesKey, topics);
        showToast(`Logged study review for "${topic.name}" with confidence ${val}`);
        renderCourseView(tracker);
      }
    });
  });

  // Notes blur auto-save
  document.querySelectorAll('.notes-ta').forEach(ta => {
    ta.addEventListener('blur', () => {
      const topicId = ta.dataset.topicId;
      const val = ta.value.trim();

      const topicIdx = topics.findIndex(t => t.id === topicId);
      if (topicIdx !== -1) {
        if (topics[topicIdx].note !== val) {
          topics[topicIdx].note = val;
          storageSet(entriesKey, topics);
          showToast(`Notes auto-saved for "${topics[topicIdx].name}"`);
        }
      }
    });
  });

  // Log test submit forms
  document.querySelectorAll('.log-test-form').forEach(form => {
    form.addEventListener('submit', (e) => {
      e.preventDefault();
      const topicId = form.dataset.topicId;
      const score = form.querySelector('.test-score').value;
      const outOf = form.querySelector('.test-outof').value;
      const conf = form.querySelector('.test-conf').value;
      const note = form.querySelector('.test-note').value.trim();

      const topicIdx = topics.findIndex(t => t.id === topicId);
      if (topicIdx !== -1) {
        const topic = topics[topicIdx];
        recordTest(topic, score, outOf, conf, note);
        storageSet(entriesKey, topics);
        showToast(`Logged test score ${score}/${outOf} for "${topic.name}"`);
        renderCourseView(tracker);
      }
    });
  });

  // Toggle active/resolved errors
  document.querySelectorAll('.toggle-error-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const topicId = btn.dataset.topicId;
      const errorIdx = parseInt(btn.dataset.errorIdx, 10);

      const topicIdx = topics.findIndex(t => t.id === topicId);
      if (topicIdx !== -1) {
        const topic = topics[topicIdx];
        if (topic.errors && topic.errors[errorIdx]) {
          const currentStatus = topic.errors[errorIdx].status;
          topic.errors[errorIdx].status = currentStatus === 'resolved' ? 'active' : 'resolved';
          storageSet(entriesKey, topics);
          showToast(`Marked misconception as ${topic.errors[errorIdx].status}.`);
          renderCourseView(tracker);
        }
      }
    });
  });
}

/**
 * Handles study timer play/stop actions.
 */
function handleTimerToggle(tracker, topicId) {
  const activeTimer = storageGet('tracker:activeTimer', null);
  const entriesKey = `tracker:${tracker.id}:entries`;
  const topics = storageGet(entriesKey, []);
  const topicIdx = topics.findIndex(t => t.id === topicId);
  if (topicIdx === -1) return;
  const topic = topics[topicIdx];

  if (activeTimer && activeTimer.trackerId === tracker.id && activeTimer.topicId === topicId) {
    // Stop the active timer
    const elapsed = Math.floor((Date.now() - activeTimer.startedAt) / 1000);
    topic.studySeconds = (Number(topic.studySeconds) || 0) + elapsed;
    topic.lastStudySeconds = elapsed;
    
    // Automatically set status to Learning if not started
    if (topic.status === 'Not Started') {
      topic.status = 'Learning';
    }

    storageSet(entriesKey, topics);
    storageSet('tracker:activeTimer', null);
    showToast(`Timer stopped. Logged ${formatDuration(elapsed)} study time on "${topic.name}".`);
  } else {
    // Start/Switch timer
    if (activeTimer) {
      // Stop the other running timer first!
      const oldTracker = storageGet(`tracker:${activeTimer.trackerId}:meta`, null);
      if (oldTracker) {
        const oldEntriesKey = `tracker:${activeTimer.trackerId}:entries`;
        const oldTopics = storageGet(oldEntriesKey, []);
        const oldTopicIdx = oldTopics.findIndex(t => t.id === activeTimer.topicId);
        if (oldTopicIdx !== -1) {
          const elapsed = Math.floor((Date.now() - activeTimer.startedAt) / 1000);
          oldTopics[oldTopicIdx].studySeconds = (Number(oldTopics[oldTopicIdx].studySeconds) || 0) + elapsed;
          oldTopics[oldTopicIdx].lastStudySeconds = elapsed;
          storageSet(oldEntriesKey, oldTopics);
          showToast(`Stopped previous timer running on "${oldTopics[oldTopicIdx].name}".`);
        }
      }
    }

    // Start new timer
    storageSet('tracker:activeTimer', {
      trackerId: tracker.id,
      topicId: topicId,
      startedAt: Date.now()
    });

    if (topic.status === 'Not Started') {
      topic.status = 'Learning';
      storageSet(entriesKey, topics);
    }

    showToast(`Timer started for "${topic.name}".`);
  }

  renderCourseView(tracker);
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
