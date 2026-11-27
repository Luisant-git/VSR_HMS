export const BLOCK_ORDER = ['A', 'B', 'C', 'CD', 'D', 'E', 'Dormitory', 'W'];

export const blockRank = (block: string) => {
  const index = BLOCK_ORDER.findIndex(
    (b) => b.toLowerCase() === String(block).toLowerCase(),
  );
  return index === -1 ? BLOCK_ORDER.length : index;
};

/**
 * Normalizes block names ("Block A", "A", "Single Rooms", "W Block", etc.)
 * and room IDs (A1, B2, W1, Dorm) into canonical block keys.
 */
export const normalizeBlock = (rawBlock: any, roomId?: any): string => {
  const room = String(roomId || '').trim();
  const b = String(rawBlock || '').trim();
  const letter = room.match(/^([A-E])\d+/i)?.[1]?.toUpperCase();
  if (letter || /^block\s*[a-e]$/i.test(b) || /^[a-e]$/i.test(b)) {
    return letter || b.replace(/^block\s*/i, '').trim().toUpperCase();
  }
  if (/dorm/i.test(b) || /^dorm/i.test(room)) return 'Dormitory';
  if (
    /single/i.test(b) ||
    /^w\d+/i.test(room) ||
    /^w\s*block$/i.test(b) ||
    /^block\s*w$/i.test(b) ||
    /^w$/i.test(b)
  ) {
    return 'W';
  }
  return b.replace(/^block\s*/i, '').trim() || 'Other';
};

/** Formats canonical block keys for display ("A" -> "Block A", "W" -> "Block W"). */
export const blockLabel = (block: string): string => {
  const clean = String(block || '').trim();
  if (/^([A-E]|W)$/i.test(clean)) return `Block ${clean.toUpperCase()}`;
  return clean;
};
