import { generateTemplate, generateAIPrompt, validateImport, applyImport } from '../core/importPipeline.js';
import { renderActiveView, showToast } from './main.js';

let activeTrackerMeta = null;
let validatedPayload = null;

export function initImportModal() {
  const modal = document.getElementById('importModal');
  const textarea = document.getElementById('importJsonTa');
  const validateBtn = document.getElementById('validateImportBtn');
  const applyBtn = document.getElementById('applyImportBtn');
  const errorContainer = document.getElementById('importErrorContainer');
  const previewArea = document.getElementById('importPreviewArea');
  const previewContent = document.getElementById('importPreviewContent');

  const copyTemplateBtn = document.getElementById('copyTemplateBtn');
  const copyPromptBtn = document.getElementById('copyPromptBtn');

  // Close actions
  const closeBtns = [
    document.getElementById('closeImportModalBtn'),
    document.getElementById('cancelImportModalBtn')
  ];

  closeBtns.forEach(btn => {
    btn?.addEventListener('click', () => {
      modal?.classList.remove('open');
      resetImportModalState();
    });
  });

  // Textarea input resets validation state
  textarea?.addEventListener('input', () => {
    applyBtn.style.display = 'none';
    previewArea.style.display = 'none';
    errorContainer.style.display = 'none';
    validatedPayload = null;
  });

  // Template Copy Action
  copyTemplateBtn?.addEventListener('click', () => {
    if (!activeTrackerMeta) return;
    const template = generateTemplate(activeTrackerMeta.type, activeTrackerMeta.schema);
    navigator.clipboard.writeText(template).then(() => {
      showToast('JSON Template copied to clipboard!');
    }).catch(err => {
      showToast('Failed to copy template: ' + err.message, true);
    });
  });

  // Prompt Copy Action
  copyPromptBtn?.addEventListener('click', () => {
    if (!activeTrackerMeta) return;
    const prompt = generateAIPrompt(activeTrackerMeta.name, activeTrackerMeta.type, activeTrackerMeta.schema);
    navigator.clipboard.writeText(prompt).then(() => {
      showToast('AI Prompt copied to clipboard!');
    }).catch(err => {
      showToast('Failed to copy prompt: ' + err.message, true);
    });
  });

  // Validate Action
  validateBtn?.addEventListener('click', () => {
    if (!activeTrackerMeta) return;
    const jsonStr = textarea.value.trim();
    if (!jsonStr) {
      showToast('Please paste some JSON data first.', true);
      return;
    }

    const result = validateImport(jsonStr, activeTrackerMeta);
    if (!result.ok) {
      errorContainer.textContent = result.error;
      errorContainer.style.display = 'block';
      previewArea.style.display = 'none';
      applyBtn.style.display = 'none';
      validatedPayload = null;
      showToast('JSON Validation Failed', true);
    } else {
      errorContainer.style.display = 'none';
      validatedPayload = result.data;

      // Render Preview
      renderPreview(activeTrackerMeta, result.data, result.warnings || []);
      previewArea.style.display = 'block';
      applyBtn.style.display = 'block';
      showToast('JSON Validated successfully! Preview ready.');
    }
  });

  // Apply Action
  applyBtn?.addEventListener('click', () => {
    if (!activeTrackerMeta || !validatedPayload) return;

    try {
      const ok = applyImport(activeTrackerMeta.id, activeTrackerMeta, validatedPayload);
      if (ok) {
        showToast('Data imported successfully!');
        modal?.classList.remove('open');
        resetImportModalState();
        renderActiveView();
      } else {
        showToast('Storage write failed. Quota exceeded?', true);
      }
    } catch (err) {
      showToast(`Failed to apply import: ${err.message}`, true);
    }
  });
}

/**
 * Opens the import modal for a specific tracker.
 * @param {object} trackerMeta
 */
export function openImportModal(trackerMeta) {
  activeTrackerMeta = trackerMeta;
  resetImportModalState();
  const modal = document.getElementById('importModal');
  modal?.classList.add('open');
}

function resetImportModalState() {
  const textarea = document.getElementById('importJsonTa');
  if (textarea) textarea.value = '';

  const errorContainer = document.getElementById('importErrorContainer');
  if (errorContainer) {
    errorContainer.textContent = '';
    errorContainer.style.display = 'none';
  }

  const previewArea = document.getElementById('importPreviewArea');
  if (previewArea) previewArea.style.display = 'none';

  const previewContent = document.getElementById('importPreviewContent');
  if (previewContent) previewContent.innerHTML = '';

  const applyBtn = document.getElementById('applyImportBtn');
  if (applyBtn) applyBtn.style.display = 'none';

  validatedPayload = null;
}

function renderPreview(trackerMeta, data, warnings = []) {
  const content = document.getElementById('importPreviewContent');
  if (!content) return;

  let html = '';

  // Render warnings if any
  if (warnings.length > 0) {
    html += `
      <div style="background-color: var(--gold-soft-bg); border-left: 4px solid var(--gold); padding: 8px 12px; border-radius: var(--radius-sm); font-size: 0.8rem; color: var(--gold); margin-bottom: 12px;">
        <strong>Warnings:</strong>
        <ul style="margin-left: 16px; margin-top: 4px;">
          ${warnings.map(w => `<li>${escapeHtml(w)}</li>`).join('')}
        </ul>
      </div>
    `;
  }

  if (trackerMeta.type === 'course') {
    html += `
      <p style="font-size: 0.9rem; margin-bottom: 8px;"><strong>${data.topics.length} topics</strong> will be added/merged into this syllabus:</p>
      <div class="table-container">
        <table>
          <thead>
            <tr>
              <th>Section</th>
              <th>Topic Name</th>
              <th>Reference</th>
            </tr>
          </thead>
          <tbody>
            ${data.topics.map(t => `
              <tr>
                <td><strong>${escapeHtml(t.section)}</strong></td>
                <td>${escapeHtml(t.name)}</td>
                <td style="color: var(--muted); font-size: 0.85rem;">${escapeHtml(t.reference || '—')}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
    `;
  } else {
    // Log entries list
    const schema = trackerMeta.schema;
    html += `
      <p style="font-size: 0.9rem; margin-bottom: 8px;"><strong>${data.entries.length} log entries</strong> will be appended:</p>
      <div class="table-container">
        <table>
          <thead>
            <tr>
              ${schema.map(f => `<th>${escapeHtml(f.label)}</th>`).join('')}
            </tr>
          </thead>
          <tbody>
            ${data.entries.map(entry => `
              <tr>
                ${schema.map(f => {
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
    `;
  }

  content.innerHTML = html;
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
