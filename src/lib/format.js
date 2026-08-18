import { format, parseISO, isValid, differenceInDays } from 'date-fns';

/** Format an ISO date string as UK-style "7 Aug 2026". Falls back gracefully. */
export function formatDate(value, fallback = '—') {
  if (!value) return fallback;
  const date = typeof value === 'string' ? parseISO(value) : value;
  return isValid(date) ? format(date, 'd MMM yyyy') : (value || fallback);
}

/** "in 42 days" / "today" / "12 days ago" — relative wording for expiry dates. */
export function formatRelativeDays(value) {
  if (!value) return null;
  const date = typeof value === 'string' ? parseISO(value) : value;
  if (!isValid(date)) return null;
  const days = differenceInDays(date, new Date());
  if (days < 0) return `${Math.abs(days)} day${Math.abs(days) === 1 ? '' : 's'} ago`;
  if (days === 0) return 'today';
  return `in ${days} day${days === 1 ? '' : 's'}`;
}

/** Pluralise a countable noun: pluralise(1,'member') → "1 member". */
export function pluralise(count, singular, plural = `${singular}s`) {
  return `${count} ${count === 1 ? singular : plural}`;
}
