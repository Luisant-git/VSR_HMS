/**
 * Browser tab title, taken from System Settings -> "Hostel / Organization Name".
 *
 * Falls back to the app name when the name is missing or the request fails, so
 * the tab never shows a blank or stale title.
 */

const FALLBACK_TITLE = 'HMS';

export function setDocumentTitle(hostelName?: string | null): void {
  const name = typeof hostelName === 'string' ? hostelName.trim() : '';
  document.title = name || FALLBACK_TITLE;
}
