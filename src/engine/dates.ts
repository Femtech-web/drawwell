export function isIsoDate(s: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return false;
  const d = new Date(`${s}T00:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === s;
}

/** Accepts YYYY-MM-DD or M/D/YYYY (common in accounting exports). */
export function normalizeDate(raw: string): string | null {
  const s = raw.trim();
  if (isIsoDate(s)) return s;
  const m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2}|\d{4})$/);
  if (!m) return null;
  const year = m[3].length === 2 ? `20${m[3]}` : m[3];
  const iso = `${year}-${m[1].padStart(2, "0")}-${m[2].padStart(2, "0")}`;
  return isIsoDate(iso) ? iso : null;
}

export function businessDaysBetween(fromIso: string, toIso: string): number {
  const from = new Date(`${fromIso}T00:00:00Z`);
  const to = new Date(`${toIso}T00:00:00Z`);
  if (to <= from) return 0;
  let days = 0;
  for (const d = new Date(from); d < to; d.setUTCDate(d.getUTCDate() + 1)) {
    const next = new Date(d);
    next.setUTCDate(next.getUTCDate() + 1);
    const dow = next.getUTCDay();
    if (dow !== 0 && dow !== 6) days++;
  }
  return days;
}

export function daysBetween(aIso: string, bIso: string): number {
  return Math.round(
    (new Date(`${bIso}T00:00:00Z`).getTime() - new Date(`${aIso}T00:00:00Z`).getTime()) / 86_400_000,
  );
}

export function formatShortDate(iso: string): string {
  const [y, m, d] = iso.split("-");
  return `${m}/${d}/${y.slice(2)}`;
}
