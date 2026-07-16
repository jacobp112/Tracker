import { createTracker } from '../core/trackerRegistry.js';
import { validateSchema } from '../core/schema.js';
import { renderActiveView, showToast } from './main.js';

let fieldIndex = 0;

export function initCreateTrackerModal() {
  const modal = document.getElementById('createTrackerModal');
  const typeSelect = document.getElementById('trackerType');
  const schemaSection = document.getElementById('logSchemaSection');
  const addFieldBtn = document.getElementById('addFieldBtn');
  const fieldsList = document.getElementById('schemaFieldsList');
  const form = document.getElementById('createTrackerForm');

  // Close buttons
  const closeBtns = [
    document.getElementById('closeCreateTrackerModalBtn'),
    document.getElementById('cancelCreateTrackerModalBtn')
  ];

  closeBtns.forEach(btn => {
    btn?.addEventListener('click', () => {
      modal?.classList.remove('open');
      resetForm();
    });
  });

  // Toggle schema section based on tracker type
  typeSelect?.addEventListener('change', (e) => {
    if (e.target.value === 'log') {
      schemaSection.style.display = 'block';
      if (fieldsList && fieldsList.children.length === 0) {
        // Add one initial field row for convenience
        addFieldRow();
      }
    } else {
      schemaSection.style.display = 'none';
    }
  });

  // Add field row button
  addFieldBtn?.addEventListener('click', () => {
    addFieldRow();
  });

  // Handle Form Submission
  form?.addEventListener('submit', (e) => {
    e.preventDefault();

    const name = document.getElementById('trackerName').value.trim();
    const type = typeSelect.value;
    let schema = [];

    if (type === 'log') {
      const rows = fieldsList.querySelectorAll('.schema-field-row');
      let hasError = false;

      rows.forEach(row => {
        const key = row.querySelector('.field-key').value.trim();
        const label = row.querySelector('.field-label').value.trim();
        const kind = row.querySelector('.field-kind').value;
        const unit = row.querySelector('.field-unit').value.trim();
        const optionsRaw = row.querySelector('.field-options').value.trim();

        let options = undefined;
        if (kind === 'select') {
          options = optionsRaw.split(',').map(o => o.trim()).filter(o => o !== '');
        }

        schema.push({
          key,
          label,
          kind,
          ...(unit && { unit }),
          ...(options && { options })
        });
      });

      // Validate schema
      const valResult = validateSchema(schema);
      if (!valResult.ok) {
        showToast(`Schema Error: ${valResult.errors[0]}`, true);
        hasError = true;
      }

      if (hasError) return;
    }

    try {
      createTracker(name, type, schema);
      showToast(`Created tracker "${name}" successfully!`);
      modal?.classList.remove('open');
      resetForm();
      renderActiveView();
    } catch (err) {
      showToast(`Failed to create tracker: ${err.message}`, true);
    }
  });
}

function addFieldRow() {
  const fieldsList = document.getElementById('schemaFieldsList');
  if (!fieldsList) return;

  const id = `field-row-${fieldIndex++}`;
  const row = document.createElement('div');
  row.className = 'schema-field-row';
  row.id = id;
  row.style.cssText = `
    display: grid;
    grid-template-columns: 1fr 1fr 1fr auto;
    gap: 8px;
    align-items: end;
    border: 1px solid var(--line);
    padding: 12px;
    border-radius: var(--radius-md);
    background-color: var(--paper);
  `;

  row.innerHTML = `
    <div class="form-group" style="margin-bottom: 0;">
      <label style="font-size: 0.8rem;">Field Key</label>
      <input type="text" class="form-input field-key" placeholder="e.g. distance, pace" required style="padding: 6px 8px; font-size: 0.85rem;">
    </div>
    <div class="form-group" style="margin-bottom: 0;">
      <label style="font-size: 0.8rem;">Field Label</label>
      <input type="text" class="form-input field-label" placeholder="e.g. Distance Run" required style="padding: 6px 8px; font-size: 0.85rem;">
    </div>
    <div class="form-group" style="margin-bottom: 0;">
      <label style="font-size: 0.8rem;">Kind</label>
      <select class="form-select field-kind" style="padding: 6px 8px; font-size: 0.85rem;">
        <option value="text">Text</option>
        <option value="number">Number</option>
        <option value="date">Date</option>
        <option value="select">Select (Options list)</option>
      </select>
    </div>
    <button type="button" class="btn danger remove-field-btn" style="padding: 6px 12px; align-self: end; height: 32px;">&times;</button>
    
    <!-- Optional details row -->
    <div class="field-extras-row" style="grid-column: span 4; display: grid; grid-template-columns: 1fr 1fr; gap: 8px; margin-top: 8px;">
      <div class="form-group" style="margin-bottom: 0;">
        <label style="font-size: 0.75rem;">Unit (Optional, e.g. km, kg, min)</label>
        <input type="text" class="form-input field-unit" placeholder="e.g. km" style="padding: 4px 6px; font-size: 0.8rem;">
      </div>
      <div class="form-group field-options-group" style="margin-bottom: 0; display: none;">
        <label style="font-size: 0.75rem;">Options (Comma-separated)</label>
        <input type="text" class="form-input field-options" placeholder="e.g. Great, Tired, Sore" style="padding: 4px 6px; font-size: 0.8rem;">
      </div>
    </div>
  `;

  // Remove button action
  row.querySelector('.remove-field-btn').addEventListener('click', () => {
    fieldsList.removeChild(row);
  });

  // Kind change toggle options input
  const kindSelect = row.querySelector('.field-kind');
  const optionsGroup = row.querySelector('.field-options-group');
  const optionsInput = row.querySelector('.field-options');

  kindSelect.addEventListener('change', (e) => {
    if (e.target.value === 'select') {
      optionsGroup.style.display = 'block';
      optionsInput.setAttribute('required', 'true');
    } else {
      optionsGroup.style.display = 'none';
      optionsInput.removeAttribute('required');
      optionsInput.value = '';
    }
  });

  fieldsList.appendChild(row);
}

function resetForm() {
  const form = document.getElementById('createTrackerForm');
  if (form) {
    form.reset();
  }
  const fieldsList = document.getElementById('schemaFieldsList');
  if (fieldsList) {
    fieldsList.innerHTML = '';
  }
  const schemaSection = document.getElementById('logSchemaSection');
  if (schemaSection) {
    schemaSection.style.display = 'none';
  }
}
