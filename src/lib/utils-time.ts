export function relativeDue(iso: string): { label: string; urgent: boolean } {
  const due = new Date(iso).getTime();
  const now = Date.now();
  const diffMs = due - now;
  const diffH = Math.round(diffMs / 36e5);
  const diffD = Math.round(diffMs / 864e5);

  if (diffMs < 0) return { label: "Past due", urgent: true };
  if (diffH < 24) return { label: diffH <= 1 ? "Due in under an hour" : `Due in ${diffH} hours`, urgent: true };
  if (diffD === 1) return { label: "Tomorrow", urgent: true };
  if (diffD <= 3) return { label: `In ${diffD} days`, urgent: true };
  if (diffD <= 7) return { label: `In ${diffD} days`, urgent: false };
  return { label: `In ${diffD} days`, urgent: false };
}

export function formatDay(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString(undefined, { weekday: "long", month: "short", day: "numeric" });
}

export function formatShortDay(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" });
}

export function dayKey(iso: string): string {
  const d = new Date(iso);
  d.setHours(0, 0, 0, 0);
  return d.toISOString();
}
