import type { CategoryTotal } from "./justification";
import { sumCents } from "./money";
import { ED524_CATEGORIES, type LedgerRow } from "./types";

export interface Adjustment {
  rowId: string;
  removeCents: number;
  reason: string;
}

export interface RequestSummary {
  included: LedgerRow[];
  totals: CategoryTotal[];
  totalCents: number;
  startIso: string;
  endIso: string;
}

export function summarizeRequest(rows: LedgerRow[], excluded: Set<string>, adjustments: Adjustment[]): RequestSummary {
  const included = rows.filter((r) => !excluded.has(r.id));
  const net = (r: LedgerRow) =>
    r.amountCents - sumCents(adjustments.filter((a) => a.rowId === r.id).map((a) => a.removeCents));
  const totals = ED524_CATEGORIES.map((category) => ({
    category,
    cents: sumCents(included.filter((r) => r.category === category).map(net)),
  })).filter((t) => t.cents > 0);
  const dates = included.map((r) => r.incurredDate).sort();
  return {
    included,
    totals,
    totalCents: sumCents(totals.map((t) => t.cents)),
    startIso: dates[0] ?? "",
    endIso: dates[dates.length - 1] ?? "",
  };
}
