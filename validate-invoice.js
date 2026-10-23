const createInvoiceNumber = (dateValue, serial) => {
  const date = new Date(dateValue || Date.now());
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  return `INV-${year}-${month}-${String(serial).padStart(3, '0')}`;
};

const serialFromId = (id) => {
  const text = String(id || '').trim();
  if (!text) return 1;
  let hash = 2166136261;
  for (let i = 0; i < text.length; i += 1) {
    hash ^= text.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return ((hash >>> 0) % 900) + 100;
};

const buildFallbackSerialMap = (rows) => {
  const ordered = [...rows].sort((a, b) => {
    const aTime = new Date(a.paidDate || a.createdAt || a.updatedAt || 0).getTime();
    const bTime = new Date(b.paidDate || b.createdAt || b.updatedAt || 0).getTime();
    return aTime - bTime;
  });
  const map = new Map();
  ordered.forEach((row, index) => map.set(String(row.id), index + 1));
  return map;
};

const rows = [
  { id: 'a1', paidDate: '2026-10-23', createdAt: '2026-10-23' },
  { id: 'a2', paidDate: '2026-10-23', createdAt: '2026-10-23' },
  { id: 'b1', paidDate: '2026-10-23', createdAt: '2026-10-23' },
  { id: 'b2', paidDate: '2026-10-23', createdAt: '2026-10-23' },
  { id: 'c1', paidDate: '2026-10-23', createdAt: '2026-10-23' },
];

const fallbackMap = buildFallbackSerialMap(rows);
const values = rows.map(row => createInvoiceNumber(row.paidDate, fallbackMap.get(row.id) ?? serialFromId(row.id)));
console.log(values);
console.log('unique=', new Set(values).size === values.length);
