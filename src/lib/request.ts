import { sumCents } from "@/engine/money";
import type { RequestSummary } from "@/engine/totals";
import type { Award, BudgetLine, Category, LedgerRow } from "@/engine/types";

export interface BudgetPosition {
  category: Category;
  approvedCents: number;
  drawnCents: number;
  requestCents: number;
  remainingCents: number;
}

export function budgetPositions(award: Award, budget: BudgetLine[], ledger: LedgerRow[], summary: RequestSummary): BudgetPosition[] {
  return budget.map((b) => {
    const drawnCents = sumCents(
      ledger
        .filter((r) => r.drawnIn && r.category === b.category && r.incurredDate >= award.budgetPeriodStart && r.incurredDate <= award.budgetPeriodEnd)
        .map((r) => r.amountCents),
    );
    const requestCents = summary.totals.find((t) => t.category === b.category)?.cents ?? 0;
    return { category: b.category, approvedCents: b.approvedCents, drawnCents, requestCents, remainingCents: b.approvedCents - drawnCents - requestCents };
  });
}

export function personalNames(ledger: LedgerRow[]): string[] {
  return [...new Set(ledger.filter((r) => r.payeeType === "employee" || r.payeeType === "participant").map((r) => r.payee))];
}

export function purposes(summary: RequestSummary): { category: string; examples: string[] }[] {
  return summary.totals.map((t) => ({
    category: t.category,
    examples: summary.included
      .filter((r) => r.category === t.category)
      .slice(0, 3)
      .map((r) => r.description.slice(0, 120)),
  }));
}
