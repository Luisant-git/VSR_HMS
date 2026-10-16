/**
 * Shared date-display helpers.
 *
 * App-wide convention: every date shown to the user is dd/mm/yyyy
 * (Indian convention). Avoid raw `toLocaleDateString()` calls (they
 * follow the browser locale, e.g. mm/dd/yyyy) and never render ISO
 * strings directly — use these helpers instead.
 */

type DateInput = string | number | Date | null | undefined;

const pad = (n: number) => String(n).padStart(2, '0');

/**
 * Format a date as dd/mm/yyyy (e.g. "16/10/2026").
 * Plain `yyyy-mm-dd` strings are parsed directly so there is no
 * timezone shift (a date-only string is UTC-midnight in JS).
 */
export function formatDateDMY(value: DateInput, fallback = ''): string {
  if (value === null || value === undefined || value === '') return fallback;
  if (typeof value === 'string') {
    const m = value.match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (m) return `${m[3]}/${m[2]}/${m[1]}`;
  }
  const d = value instanceof Date ? value : new Date(value);
  if (isNaN(d.getTime())) return fallback;
  return `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()}`;
}
