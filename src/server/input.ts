import { z } from "zod";
import { parseBudgetCsv, parseLedgerCsv, type CsvIssue } from "@/engine/csv";
import { isIsoDate } from "@/engine/dates";
import type { ReviewInput } from "@/engine/types";

const iso = z.string().refine(isIsoDate, "must be YYYY-MM-DD");

export const AwardSchema = z.object({
  awardNumber: z.string().trim().min(3).max(40),
  programName: z.string().trim().min(2).max(80),
  assistanceListing: z.string().trim().max(20),
  recipient: z.string().trim().max(120),
  budgetPeriodStart: iso,
  budgetPeriodEnd: iso,
  paymentBasis: z.enum(["advance", "reimbursement"]),
  advanceWindowDays: z.number().int().min(0).max(30),
  capitalizationThreshold: z.number().min(0).max(1_000_000),
  requestDate: iso,
});

export const ReviewBodySchema = z.object({
  award: AwardSchema,
  budgetCsv: z.string().max(20_000),
  ledgerCsv: z.string().max(200_000),
  terms: z.array(z.object({ id: z.string().max(20), title: z.string().max(120), text: z.string().max(4_000) })).max(20),
  documents: z.array(z.object({ id: z.string().max(60), text: z.string().max(20_000) })).max(60),
  selectedRowIds: z.array(z.string().max(40)).max(200),
});

export type ReviewBody = z.infer<typeof ReviewBodySchema>;

export function toReviewInput(body: ReviewBody): { input: ReviewInput | null; issues: CsvIssue[] } {
  const budget = parseBudgetCsv(body.budgetCsv);
  const ledger = parseLedgerCsv(body.ledgerCsv);
  const issues = [...budget.issues, ...ledger.issues];
  if (issues.length) return { input: null, issues };
  return {
    input: { award: body.award, budget: budget.rows, ledger: ledger.rows, terms: body.terms, documents: body.documents, selectedRowIds: body.selectedRowIds },
    issues,
  };
}
