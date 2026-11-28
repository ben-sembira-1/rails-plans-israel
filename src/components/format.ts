/** `27/11/2026` from an ISO date or time. */
export function formatDate(iso: string): string {
  // A date without a time is a calendar day: format it as written, not as UTC midnight in the local zone.
  const day = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
  if (day) return `${day[3] ?? ''}/${day[2] ?? ''}/${day[1] ?? ''}`;
  const d = new Date(iso);
  return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${String(d.getFullYear())}`;
}

/** A count in Hebrew digit grouping (`1,234`). */
export function formatCount(n: number): string {
  return n.toLocaleString('he-IL');
}
