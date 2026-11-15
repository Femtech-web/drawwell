import { parseBudgetCsv, parseLedgerCsv } from "@/engine/csv";
import type { ReviewInput } from "@/engine/types";
import { SAMPLE_SOURCES } from "./data.generated";

export { SAMPLE_SOURCES };

export function sampleInput(id: string): ReviewInput {
  const s = SAMPLE_SOURCES.find((x) => x.id === id);
  if (!s) throw new Error(`Unknown sample ${id}`);
  const budget = parseBudgetCsv(s.budgetCsv);
  const ledger = parseLedgerCsv(s.ledgerCsv);
  if (budget.issues.length || ledger.issues.length) {
    throw new Error(`Sample ${id} has CSV issues: ${JSON.stringify([...budget.issues, ...ledger.issues])}`);
  }
  return {
    award: s.award,
    budget: budget.rows,
    ledger: ledger.rows,
    terms: s.terms,
    documents: s.documents,
    selectedRowIds: ledger.rows.filter((r) => !r.drawnIn).map((r) => r.id),
  };
}
