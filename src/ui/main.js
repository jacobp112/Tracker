import { renderHome } from './home.js';
import { renderTrackerList } from './trackerList.js';
import { initCreateTrackerModal } from './createTrackerModal.js';
import { initImportModal } from './importModal.js';
import { storageGet, storageSet } from '../core/storage.js';
import { listTrackers } from '../core/trackerRegistry.js';

let timerInterval = null;

// Boot Application
document.addEventListener('DOMContentLoaded', () => {
  initTheme();
  initTabs();
  initCreateTrackerModal();
  initImportModal();
  initTimerBanner();

  // Initial render: Home
  renderActiveView();
});

// Theme Management
function initTheme() {
  const toggleBtn = document.getElementById('themeToggleBtn');
  const toggleIcon = document.getElementById('themeToggleIcon');
  const toggleText = document.getElementById('themeToggleText');

  const savedTheme = localStorage.getItem('tracker:theme') || 'light';
  if (savedTheme === 'dark') {
    document.body.classList.add('dark-theme');
    toggleIcon.textContent = '☀️';
    toggleText.textContent = 'Light Theme';
  } else {
    document.body.classList.remove('dark-theme');
    toggleIcon.textContent = '🌙';
    toggleText.textContent = 'Dark Theme';
  }

  toggleBtn.addEventListener('click', () => {
    const isDark = document.body.classList.toggle('dark-theme');
    if (isDark) {
      localStorage.setItem('tracker:theme', 'dark');
      toggleIcon.textContent = '☀️';
      toggleText.textContent = 'Light Theme';
      showToast('Switched to Dark Theme');
    } else {
      localStorage.setItem('tracker:theme', 'light');
      toggleIcon.textContent = '🌙';
      toggleText.textContent = 'Dark Theme';
      showToast('Switched to Light Theme');
    }
    // Re-trigger layout paints if needed
    renderActiveView();
  });
}

// Single Page Tab Navigation
let currentTab = 'home';
function initTabs() {
  const tabs = document.querySelectorAll('.nav-tabs .tab-btn');
  tabs.forEach(tab => {
    tab.addEventListener('click', (e) => {
      const targetTab = e.target.id.replace('tab-', '');
      if (targetTab === currentTab) return;

      // Update Tab button states
      tabs.forEach(t => {
        t.classList.remove('active');
        t.setAttribute('aria-selected', 'false');
      });
      e.target.classList.add('active');
      e.target.setAttribute('aria-selected', 'true');

      // Update View Panel states
      const panels = document.querySelectorAll('.view-panel');
      panels.forEach(p => p.classList.remove('active'));
      const targetPanel = document.getElementById(`view-${targetTab}`);
      if (targetPanel) {
        targetPanel.classList.add('active');
      }

      currentTab = targetTab;
      renderActiveView();
    });
  });
}

// Global View Render Dispatcher
export function renderActiveView() {
  if (currentTab === 'home') {
    renderHome();
  } else if (currentTab === 'trackers') {
    renderTrackerList();
  }
}

// Global Toast Notification Helper
export function showToast(message, isError = false) {
  const container = document.getElementById('toastContainer');
  if (!container) return;

  const toast = document.createElement('div');
  toast.className = 'toast';
  if (isError) {
    toast.style.borderLeft = '4px solid var(--rose)';
  } else {
    toast.style.borderLeft = '4px solid var(--gold)';
  }
  toast.textContent = message;

  container.appendChild(toast);

  // Auto-remove after 4 seconds
  setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transition = 'opacity 0.5s ease';
    setTimeout(() => {
      if (container.contains(toast)) {
        container.removeChild(toast);
      }
    }, 500);
  }, 4000);
}

// Background Timer Management
export function initTimerBanner() {
  updateTimerBanner();
  
  if (timerInterval) clearInterval(timerInterval);
  timerInterval = setInterval(() => {
    updateTimerBanner();
  }, 1000);
}

function updateTimerBanner() {
  const activeTimer = storageGet('tracker:activeTimer', null);
  const existingBanner = document.getElementById('activeTimerBanner');

  if (!activeTimer) {
    if (existingBanner) {
      existingBanner.parentNode.removeChild(existingBanner);
    }
    return;
  }

  const elapsed = Math.floor((Date.now() - activeTimer.startedAt) / 1000);

  // Load tracker metadata
  const trackers = listTrackers();
  const tracker = trackers.find(t => t.id === activeTimer.trackerId);
  if (!tracker) {
    storageSet('tracker:activeTimer', null);
    return;
  }

  const topics = storageGet(`tracker:${activeTimer.trackerId}:entries`, []);
  const topic = topics.find(t => t.id === activeTimer.topicId);
  if (!topic) {
    storageSet('tracker:activeTimer', null);
    return;
  }

  const liveSeconds = (Number(topic.studySeconds) || 0) + elapsed;
  const timeStr = formatDuration(liveSeconds);

  // Update live row displays if present in DOM
  const liveDisplays = document.querySelectorAll(`[data-live-topic-id="${topic.id}"]`);
  liveDisplays.forEach(el => {
    el.textContent = timeStr;
  });

  if (existingBanner) {
    const timeSpan = existingBanner.querySelector('.banner-time');
    if (timeSpan) timeSpan.textContent = timeStr;
  } else {
    const mainContent = document.querySelector('.main-content');
    if (!mainContent) return;

    const banner = document.createElement('div');
    banner.id = 'activeTimerBanner';
    banner.style.cssText = `
      display: flex;
      justify-content: space-between;
      align-items: center;
      background-color: var(--card);
      border: 1px solid var(--gold);
      border-left: 5px solid var(--gold);
      padding: 12px 18px;
      border-radius: var(--radius-md);
      margin-bottom: 20px;
      font-size: 0.95rem;
    `;

    banner.innerHTML = `
      <div>
        <span style="margin-right: 8px;">⏱</span>
        <strong>Study Session:</strong> 
        <span style="font-family: var(--font-serif); font-style: italic;">${escapeHtml(topic.name)}</span> 
        (in ${escapeHtml(tracker.name)}) 
        &middot; <strong class="banner-time" style="font-family: var(--font-mono);">${timeStr}</strong>
      </div>
      <button class="btn danger banner-stop-btn" style="padding: 4px 10px; font-size: 0.8rem;">⏹ Stop Timer</button>
    `;

    banner.querySelector('.banner-stop-btn').addEventListener('click', () => {
      stopActiveTimerGlobal(activeTimer, topic, tracker);
    });

    mainContent.parentNode.insertBefore(banner, mainContent);
  }
}

function stopActiveTimerGlobal(activeTimer, topic, tracker) {
  const entriesKey = `tracker:${activeTimer.trackerId}:entries`;
  const topics = storageGet(entriesKey, []);
  const topicIdx = topics.findIndex(t => t.id === activeTimer.topicId);

  if (topicIdx !== -1) {
    const elapsed = Math.floor((Date.now() - activeTimer.startedAt) / 1000);
    topics[topicIdx].studySeconds = (Number(topics[topicIdx].studySeconds) || 0) + elapsed;
    topics[topicIdx].lastStudySeconds = elapsed;

    if (topics[topicIdx].status === 'Not Started') {
      topics[topicIdx].status = 'Learning';
    }

    storageSet(entriesKey, topics);
    storageSet('tracker:activeTimer', null);
    showToast(`Timer stopped. Logged ${formatDuration(elapsed)} study time on "${topic.name}".`);
    
    // Re-render
    renderActiveView();
  }
}

function formatDuration(totalSeconds) {
  const total = Math.max(0, Math.floor(Number(totalSeconds) || 0));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  if (h) return `${h}h ${String(m).padStart(2, '0')}m`;
  if (m) return `${m}m ${String(s).padStart(2, '0')}s`;
  return `${s}s`;
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
