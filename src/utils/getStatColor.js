/**
 * Color intensity scaling utility for stat tables.
 * Maps stat values to 4-level color intensity (strong/moderate positive/negative).
 */

/**
 * Normalize a stat value to [-1, +1] range.
 * Positive = good, negative = bad.
 */
function metricT(value, metric) {
  let t;
  switch (metric) {
    case 'winPct':  t = (value - 50) / 30; break;      // 50% neutral
    case 'kd':      t = (value - 1.0) / 0.5; break;    // 1.0 neutral
    case 'netDmg':  t = value / 200; break;             // 0 neutral
    case 'dpm':     t = (value - 300) / 150; break;     // 300 neutral
    case 'capDiff': t = value / 3; break;               // 0 neutral
    case 'hhi':     t = -(value - 0.25) / 0.10; break;  // 0.25 ideal, higher = worse
    default: return undefined;
  }
  return Math.max(-1, Math.min(1, t));
}

/**
 * Returns a CSS color string for stat text based on value and metric.
 * @param {number} value - The stat value
 * @param {string} metric - One of: winPct, kd, netDmg, dpm, capDiff, hhi
 * @param {boolean} [invert=false] - Reverse good/bad (for opponent stats)
 * @returns {string|undefined} CSS color string or undefined for neutral
 */
export function getStatColor(value, metric, invert = false) {
  let t = metricT(value, metric);
  if (t === undefined) return undefined;
  if (invert) t = -t;

  if (t >= 0.7)  return 'var(--color-win)';
  if (t >= 0.3)  return 'rgba(34, 197, 94, 0.7)';
  if (t <= -0.7) return 'var(--color-loss)';
  if (t <= -0.3) return 'rgba(239, 68, 68, 0.7)';
  return undefined;
}

/**
 * Returns a subtle CSS background-color tint for table cells.
 * @param {number} value - The stat value
 * @param {string} metric - One of: winPct, kd, netDmg, dpm, capDiff, hhi
 * @param {boolean} [invert=false] - Reverse good/bad (for opponent stats)
 * @returns {string|undefined} CSS background-color string or undefined
 */
export function getStatBg(value, metric, invert = false) {
  let t = metricT(value, metric);
  if (t === undefined) return undefined;
  if (invert) t = -t;

  const abs = Math.abs(t);
  if (abs < 0.2) return undefined;
  const alpha = (0.04 + abs * 0.11).toFixed(2);
  if (t > 0) return `rgba(34, 197, 94, ${alpha})`;
  return `rgba(239, 68, 68, ${alpha})`;
}
