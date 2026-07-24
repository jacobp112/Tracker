import { useCallback, useMemo, useRef, useState } from 'react';
import type { MouseEvent } from 'react';
import { useReducedMotion } from '@/hooks/useReducedMotion';

const VB_W = 320;
const VB_H = 140;
const PAD_L = 34;
const PAD_R = 10;
const PAD_T = 10;
const PAD_B = 24;

export interface ChartPoint {
  /** x label (e.g. a date). */
  label: string;
  value: number;
}

export interface LineChartProps {
  points: readonly ChartPoint[];
  formatValue: (v: number) => string;
  /** Inverts the y-axis so "down is good" (e.g., pace), keeping "up = improvement" consistent. */
  invertBetter?: boolean;
  ariaLabel: string;
}

/**
 * A small line chart for fitness trends (Document 3 §5.5). Distinct from the
 * study Sparkline: this one has axes and value labels, and is used where the
 * absolute numbers matter (pace, weight), not just the shape.
 */
export function LineChart({
  points,
  formatValue,
  invertBetter = false,
  ariaLabel,
}: LineChartProps) {
  const reduced = useReducedMotion();
  const svgRef = useRef<SVGSVGElement>(null);
  const [hover, setHover] = useState<number | null>(null);

  const model = useMemo(() => {
    if (points.length === 0) return null;
    
    const values = points.map((p) => p.value);
    let min = Math.min(...values);
    let max = Math.max(...values);
    
    if (min === max) {
      // A flat series still needs a band to draw in.
      min -= 1;
      max += 1;
    }
    
    const pad = (max - min) * 0.1;
    min -= pad;
    max += pad;

    const n = points.length;
    const getX = (i: number) => 
      n === 1 ? (PAD_L + VB_W - PAD_R) / 2 : PAD_L + (i / (n - 1)) * (VB_W - PAD_L - PAD_R);
    
    const getY = (v: number) => {
      const t = (v - min) / (max - min);
      // invertBetter: smaller value plots higher (good is up).
      return PAD_T + (invertBetter ? t : 1 - t) * (VB_H - PAD_T - PAD_B);
    };

    const coords = points.map((p, i) => ({ x: getX(i), y: getY(p.value), ...p }));
    const line = coords
      .map((c, i) => `${i === 0 ? 'M' : 'L'}${c.x.toFixed(1)},${c.y.toFixed(1)}`)
      .join(' ');

    return { coords, line, min, max, y: getY };
  }, [points, invertBetter]);

  const handleMouseMove = useCallback((e: MouseEvent<SVGSVGElement>) => {
    if (!svgRef.current || !model) return;
    
    const r = svgRef.current.getBoundingClientRect();
    const px = ((e.clientX - r.left) / r.width) * VB_W;
    
    let nearest = 0;
    let best = Infinity;
    
    model.coords.forEach((c, i) => {
      const d = Math.abs(c.x - px);
      if (d < best) {
        best = d;
        nearest = i;
      }
    });
    
    setHover(nearest);
  }, [model]);

  if (!model) {
    return (
      <div
        style={{
          padding: 'var(--space-12)',
          textAlign: 'center',
          color: 'var(--ink-secondary)',
          fontSize: 'var(--fs-secondary)',
        }}
      >
        Not enough data to chart yet.
      </div>
    );
  }

  const active = hover !== null ? model.coords[hover] : null;

  return (
    <div style={{ position: 'relative' }}>
      <svg
        ref={svgRef}
        viewBox={`0 0 ${VB_W} ${VB_H}`}
        style={{ display: 'block', width: '100%', height: 'auto', overflow: 'visible' }}
        role="img"
        aria-label={ariaLabel}
        onMouseLeave={() => setHover(null)}
        onMouseMove={handleMouseMove}
      >
        {/* min / max gridlines */}
        {[model.max, model.min].map((v) => (
          <g key={`gridline-${v}`}>
            <line
              x1={PAD_L}
              x2={VB_W - PAD_R}
              y1={model.y(v)}
              y2={model.y(v)}
              stroke="var(--border)"
              strokeWidth="1"
            />
            <text
              x={PAD_L - 5}
              y={model.y(v) + 3}
              textAnchor="end"
              style={{ fontSize: 8, fill: 'var(--ink-muted)', fontFamily: 'var(--font-mono)' }}
            >
              {formatValue(v)}
            </text>
          </g>
        ))}

        <path
          d={model.line}
          fill="none"
          stroke="var(--accent)"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          className={reduced ? undefined : 'spark-draw'}
        />

        {model.coords.map((c, i) => (
          <circle
            key={`${c.label}-${i}`}
            cx={c.x}
            cy={c.y}
            r={hover === i ? 4 : 2.5}
            fill={hover === i ? 'var(--surface)' : 'var(--accent)'}
            stroke="var(--accent)"
            strokeWidth={hover === i ? 2.5 : 0}
            style={{ transition: 'r 0.15s ease, stroke-width 0.15s ease' }}
          />
        ))}

        {active && (
          <line
            x1={active.x}
            x2={active.x}
            y1={PAD_T}
            y2={VB_H - PAD_B}
            stroke="var(--accent)"
            strokeWidth="1"
            opacity="0.4"
          />
        )}
      </svg>

      {active && (
        <div
          className="spark-readout"
          style={{
            position: 'absolute',
            left: `${(active.x / VB_W) * 100}%`,
            top: 0,
            opacity: 1,
            pointerEvents: 'none',
          }}
        >
          <span className="ro-val">{formatValue(active.value)}</span>
          <span className="ro-date">{active.label}</span>
        </div>
      )}
    </div>
  );
}