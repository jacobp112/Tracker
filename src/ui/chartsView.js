import { storageGet } from '../core/storage.js';

/**
 * Renders the SVG Analytics Chart View inside a container.
 * @param {object} tracker 
 * @param {HTMLElement} container 
 */
export function renderChartView(tracker, container) {
  if (!container) return;

  const numericFields = tracker.schema.filter(f => f.kind === 'number');
  if (numericFields.length === 0) {
    container.innerHTML = `
      <div style="text-align: center; padding: 40px 16px; color: var(--muted); font-family: var(--font-serif); font-style: italic;">
        No numeric fields defined in this tracker's schema to plot.
      </div>
    `;
    return;
  }

  // Set default selected metric
  let activeFieldKey = numericFields[0].key;

  const entriesKey = `tracker:${tracker.id}:entries`;
  const entries = storageGet(entriesKey, []);

  function draw() {
    const field = numericFields.find(f => f.key === activeFieldKey);
    const dateField = tracker.schema.find(f => f.kind === 'date');

    // Filter and sort entries with valid values
    const chartData = entries
      .filter(e => e[activeFieldKey] !== undefined && e[activeFieldKey] !== null && e[activeFieldKey] !== '')
      .map(e => ({
        date: dateField ? e[dateField.key] : 'Entry',
        value: Number(e[activeFieldKey])
      }));

    // Sort chronologically by date
    if (dateField) {
      chartData.sort((a, b) => a.date.localeCompare(b.date));
    }

    let innerHtml = `
      <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px; flex-wrap: wrap; gap: 8px;">
        <h3 style="font-size: 1.1rem; font-family: var(--font-display);">Line Chart Visualizer</h3>
        <div style="display: flex; align-items: center; gap: 8px;">
          <label style="font-size: 0.85rem; font-weight: 600;">Metric:</label>
          <select id="chartMetricSelect" class="form-select" style="padding: 4px 8px; font-size: 0.85rem; width: 160px;">
            ${numericFields.map(f => `<option value="${f.key}" ${f.key === activeFieldKey ? 'selected' : ''}>${escapeHtml(f.label)}</option>`).join('')}
          </select>
        </div>
      </div>
    `;

    if (chartData.length < 2) {
      innerHtml += `
        <div style="display: flex; align-items: center; justify-content: center; height: 260px; border: 1px dashed var(--line); border-radius: var(--radius-md); color: var(--muted); font-family: var(--font-serif); font-style: italic;">
          Add at least 2 log entries with values for "${escapeHtml(field.label)}" to view the chart trend.
        </div>
      `;
      container.innerHTML = innerHtml;
      bindDropdown();
      return;
    }

    // Chart Dimensions
    const svgW = 600;
    const svgH = 300;
    const padL = 60;
    const padR = 20;
    const padT = 40;
    const padB = 40;

    const plotW = svgW - padL - padR;
    const plotH = svgH - padT - padB;

    // Extents
    const values = chartData.map(d => d.value);
    let minVal = Math.min(...values);
    let maxVal = Math.max(...values);
    if (minVal === maxVal) {
      minVal -= 1;
      maxVal += 1;
    }
    const valRange = maxVal - minVal;

    // Map data points
    const points = chartData.map((d, i) => {
      const pctX = i / (chartData.length - 1);
      const pctY = (d.value - minVal) / valRange;

      return {
        x: padL + pctX * plotW,
        y: padT + plotH - pctY * plotH, // invert Y axis
        date: d.date,
        value: d.value
      };
    });

    // Generate Path D strings
    const linePath = points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ');
    // Area path (closed at baseline)
    const areaPath = `${linePath} L ${points[points.length - 1].x} ${padT + plotH} L ${points[0].x} ${padT + plotH} Z`;

    // Horizontal Gridlines & Y-Axis Labels
    const gridCount = 4;
    let gridLinesHtml = '';
    for (let i = 0; i <= gridCount; i++) {
      const pct = i / gridCount;
      const y = padT + plotH - pct * plotH;
      const gridVal = minVal + pct * valRange;
      
      gridLinesHtml += `
        <!-- Gridline -->
        <line x1="${padL}" y1="${y}" x2="${svgW - padR}" y2="${y}" stroke="var(--line)" stroke-width="1" stroke-dasharray="4,4" />
        <!-- Axis Label -->
        <text x="${padL - 10}" y="${y + 4}" text-anchor="end" font-family="var(--font-mono)" font-size="11" fill="var(--muted)">
          ${gridVal.toFixed(1)}${field.unit ? field.unit : ''}
        </text>
      `;
    }

    // X-Axis Date Labels (Start, Middle, End)
    let dateLabelsHtml = '';
    const labelIndices = [0, Math.floor(points.length / 2), points.length - 1];
    const uniqueIndices = [...new Set(labelIndices)]; // avoid duplicates if length < 3
    uniqueIndices.forEach(idx => {
      const p = points[idx];
      dateLabelsHtml += `
        <text x="${p.x}" y="${svgH - 12}" text-anchor="middle" font-family="var(--font-mono)" font-size="10" fill="var(--muted)">
          ${escapeHtml(p.date)}
        </text>
      `;
    });

    // Build SVG
    const svgHtml = `
      <svg viewBox="0 0 ${svgW} ${svgH}" width="100%" height="300" style="overflow: visible; background-color: var(--card);">
        <defs>
          <linearGradient id="chartAreaGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stop-color="var(--gold)" stop-opacity="0.25"/>
            <stop offset="100%" stop-color="var(--gold)" stop-opacity="0.0"/>
          </linearGradient>
        </defs>

        <!-- Tooltip display inside SVG -->
        <text id="svgTooltipText" x="${svgW / 2}" y="20" text-anchor="middle" font-family="var(--font-sans)" font-size="12" font-weight="600" fill="var(--gold)" style="opacity: 0; transition: opacity 0.15s ease;">
          Hover over data points to inspect
        </text>

        <!-- Grid Lines -->
        ${gridLinesHtml}

        <!-- Shaded Area Gradient -->
        <path d="${areaPath}" fill="url(#chartAreaGrad)" />

        <!-- Line Plot -->
        <path d="${linePath}" fill="none" stroke="var(--gold)" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" />

        <!-- Interactive Data Point Markers -->
        ${points.map((p, idx) => `
          <circle cx="${p.x}" cy="${p.y}" r="5" fill="var(--paper)" stroke="var(--gold)" stroke-width="2" 
                  class="chart-marker"
                  data-date="${escapeHtml(p.date)}"
                  data-value="${p.value}"
                  data-unit="${escapeHtml(field.unit || '')}"
                  style="cursor: pointer; transition: r 0.15s ease;"
          />
          <!-- Large transparent hover boundary -->
          <circle cx="${p.x}" cy="${p.y}" r="14" fill="transparent" 
                  class="chart-trigger"
                  data-idx="${idx}"
                  style="cursor: pointer;"
          />
        `).join('')}

        <!-- Date Labels -->
        ${dateLabelsHtml}
      </svg>
    `;

    innerHtml += `<div style="background-color: var(--card); border: 1px solid var(--line); border-radius: var(--radius-lg); padding: 16px; box-shadow: inset 0 2px 8px var(--shadow-inset);">${svgHtml}</div>`;
    container.innerHTML = innerHtml;

    bindDropdown();
    bindChartHovers();
  }

  function bindDropdown() {
    const select = document.getElementById('chartMetricSelect');
    select?.addEventListener('change', (e) => {
      activeFieldKey = e.target.value;
      draw();
    });
  }

  function bindChartHovers() {
    const tooltipText = document.getElementById('svgTooltipText');
    const triggers = container.querySelectorAll('.chart-trigger');
    const markers = container.querySelectorAll('.chart-marker');

    triggers.forEach(trigger => {
      const idx = trigger.dataset.idx;
      const marker = markers[idx];
      const date = marker.dataset.date;
      const val = Number(marker.dataset.value).toFixed(1);
      const unit = marker.dataset.unit;

      trigger.addEventListener('mouseenter', () => {
        marker.setAttribute('r', '8');
        marker.setAttribute('fill', 'var(--gold-soft)');
        if (tooltipText) {
          tooltipText.textContent = `${date} : ${val} ${unit}`;
          tooltipText.style.opacity = '1';
        }
      });

      trigger.addEventListener('mouseleave', () => {
        marker.setAttribute('r', '5');
        marker.setAttribute('fill', 'var(--paper)');
        if (tooltipText) {
          tooltipText.style.opacity = '0';
        }
      });
    });
  }

  // Draw initially
  draw();
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
