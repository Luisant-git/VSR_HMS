// Room E1 is the staff/warden quarters. Anyone registered there is staff,
// not a hosteller. Keep the record visible with a distinct theme, but never
// count it as a hosteller. No hardcoded student IDs or names.
export const isWardenStudent = (s: any) => {
  const room = String(s?.roomNo || s?.room || s?.id || '').trim().toUpperCase();
  return room === 'E1';
};
