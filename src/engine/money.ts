export function parseMoney(raw: string): number | null {
  const s = raw.trim().replace(/[$,\s]/g, "");
  if (!/^-?\d+(\.\d{1,2})?$/.test(s)) return null;
  const negative = s.startsWith("-");
  const [whole, frac = ""] = s.replace("-", "").split(".");
  const cents = Number(whole) * 100 + Number(frac.padEnd(2, "0"));
  return negative ? -cents : cents;
}

export function formatMoney(cents: number, { forceCents = false } = {}): string {
  const negative = cents < 0;
  const abs = Math.abs(cents);
  const whole = Math.floor(abs / 100).toLocaleString("en-US");
  const frac = abs % 100;
  const body = frac === 0 && !forceCents ? whole : `${whole}.${String(frac).padStart(2, "0")}`;
  return `${negative ? "-" : ""}$${body}`;
}

export function sumCents(values: number[]): number {
  return values.reduce((a, b) => a + b, 0);
}

/** Every way a cents amount is likely to be written in a receipt or justification. */
export function moneyVariants(cents: number): string[] {
  const abs = Math.abs(cents);
  const whole = Math.floor(abs / 100);
  const frac = String(abs % 100).padStart(2, "0");
  const grouped = whole.toLocaleString("en-US");
  const out = new Set([`${grouped}.${frac}`, `${whole}.${frac}`]);
  if (frac === "00") {
    out.add(grouped);
    out.add(String(whole));
  }
  return [...out];
}
