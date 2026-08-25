// Date-only helpers for financial reporting.
//
// Report periods are calendar dates, not instants. They must never travel
// through JavaScript's timezone-shifting Date construction: `new
// Date("2025-12-31")` is UTC midnight, which renders as Dec 30 in the
// Americas. These helpers treat "YYYY-MM-DD" strings as literal dates.

const MONTHS = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
];

/** True for a strict YYYY-MM-DD date-only string. */
export function isDateOnly(value: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(value);
}

/**
 * Format a date-only string ("2025-12-31") as "Dec 31, 2025" with zero
 * timezone math. True timestamps (containing a time component) fall back to
 * locale rendering. Invalid input renders "—".
 */
export function fmtDateOnly(iso: string | null | undefined): string {
  if (!iso) return "—";
  const datePart = iso.length >= 10 ? iso.slice(0, 10) : iso;
  if (!isDateOnly(datePart)) return "—";
  const y = Number(datePart.slice(0, 4));
  const m = Number(datePart.slice(5, 7));
  const d = Number(datePart.slice(8, 10));
  if (m < 1 || m > 12 || d < 1 || d > 31) return "—";
  return `${MONTHS[m - 1]} ${d}, ${y}`;
}

/** Format a real timestamp (fetch/sync times) in the viewer's locale. */
export function fmtTimestamp(iso: string | null | undefined): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}
