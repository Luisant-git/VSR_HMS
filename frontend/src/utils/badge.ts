/**
 * Shared list-row badge helpers.
 *
 * Soft badge variants come from `.ui-badge-*` in index.css.
 */

const ROW_BADGE_VARIANTS = [
  'ui-badge-purple',
  'ui-badge-info',
  'ui-badge-accent',
  'ui-badge-success',
  'ui-badge-warning'
];

/**
 * A distinct badge class for a row, keyed on its absolute position in the list
 * (e.g. `(page - 1) * limit + index`). Using the position rather than the
 * value keeps each row's colour stable while paging through the same list.
 */
export function rowBadgeVariant(index: number): string {
  const i = Math.abs(Math.trunc(index));
  return ROW_BADGE_VARIANTS[i % ROW_BADGE_VARIANTS.length];
}
