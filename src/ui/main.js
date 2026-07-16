import { renderHome } from './home.js';
import { renderTrackerList } from './trackerList.js';
import { initCreateTrackerModal } from './createTrackerModal.js';
import { initImportModal } from './importModal.js';

// Boot Application
document.addEventListener('DOMContentLoaded', () => {
  initTheme();
  initTabs();
  initCreateTrackerModal();
  initImportModal();

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
