import Papa from "papaparse";
import { normalizeDate } from "./dates";
import { parseMoney } from "./money";
import { ED524_CATEGORIES, type BudgetLine, type Category, type LedgerRow } from "./types";

export interface CsvIssue {
  file: "budget" | "ledger";
  line: number;
  message: string;
}

export interface Parsed<T> {
  rows: T[];
  issues: CsvIssue[];
}

const LEDGER_COLUMNS = [
  "row_id", "incurred_date", "payment_date", "status", "payee", "payee_type",
  "description", "account", "budget_category", "amount", "document", "drawn_in",
] as const;

function matchCategory(raw: string): Category | null {
  const s = raw.trim().toLowerCase();
  return ED524_CATEGORIES.find((c) => c.toLowerCase() === s) ?? null;
}

function readCsv(text: string) {
  const result = Papa.parse<Record<string, string>>(text.trim(), {
    header: true,
    skipEmptyLines: "greedy",
    transformHeader: (h) => h.trim().toLowerCase().replace(/\s+/g, "_"),
  });
  return result;
}

export function parseBudgetCsv(text: string): Parsed<BudgetLine> {
  const issues: CsvIssue[] = [];
  const rows: BudgetLine[] = [];
  const parsed = readCsv(text);
  const fields = parsed.meta.fields ?? [];
  for (const col of ["category", "approved"]) {
    if (!fields.includes(col)) issues.push({ file: "budget", line: 1, message: `Missing column "${col}".` });
  }
  if (issues.length) return { rows, issues };
  const seen = new Set<Category>();
  parsed.data.forEach((r, i) => {
    const line = i + 2;
    const category = matchCategory(r.category ?? "");
    const cents = parseMoney(r.approved ?? "");
    if (!category) {
      issues.push({ file: "budget", line, message: `"${r.category}" is not an ED 524 budget category. Use one of: ${ED524_CATEGORIES.join(", ")}.` });
      return;
    }
    if (cents === null || cents < 0) {
      issues.push({ file: "budget", line, message: `Approved amount "${r.approved}" is not a valid dollar amount.` });
      return;
    }
    if (seen.has(category)) {
      issues.push({ file: "budget", line, message: `${category} appears more than once.` });
      return;
    }
    seen.add(category);
    rows.push({ category, approvedCents: cents });
  });
  if (!rows.length && !issues.length) issues.push({ file: "budget", line: 1, message: "The budget file has no rows." });
  return { rows, issues };
}

export function parseLedgerCsv(text: string): Parsed<LedgerRow> {
  const issues: CsvIssue[] = [];
  const rows: LedgerRow[] = [];
  const parsed = readCsv(text);
  const fields = parsed.meta.fields ?? [];
  const missing = LEDGER_COLUMNS.filter((c) => !fields.includes(c));
  if (missing.length) {
    issues.push({ file: "ledger", line: 1, message: `Missing column${missing.length > 1 ? "s" : ""}: ${missing.join(", ")}.` });
    return { rows, issues };
  }
  const ids = new Set<string>();
  parsed.data.forEach((r, i) => {
    const line = i + 2;
    const fail = (message: string) => issues.push({ file: "ledger", line, message });
    const id = (r.row_id ?? "").trim();
    if (!id) return fail("Missing row_id.");
    if (ids.has(id)) return fail(`row_id ${id} is used more than once.`);
    const incurredDate = normalizeDate(r.incurred_date ?? "");
    if (!incurredDate) return fail(`incurred_date "${r.incurred_date}" is not a date (use YYYY-MM-DD).`);
    const paymentDate = normalizeDate(r.payment_date ?? "");
    if (!paymentDate) return fail(`payment_date "${r.payment_date}" is not a date (use YYYY-MM-DD).`);
    const status = (r.status ?? "").trim().toLowerCase();
    if (status !== "paid" && status !== "scheduled") return fail(`status must be "paid" or "scheduled", not "${r.status}".`);
    const payeeType = (r.payee_type ?? "").trim().toLowerCase();
    if (!["vendor", "employee", "participant", "internal"].includes(payeeType)) {
      return fail(`payee_type must be vendor, employee, participant or internal, not "${r.payee_type}".`);
    }
    const category = matchCategory(r.budget_category ?? "");
    if (!category) return fail(`budget_category "${r.budget_category}" is not an ED 524 category.`);
    const amountCents = parseMoney(r.amount ?? "");
    if (amountCents === null) return fail(`amount "${r.amount}" is not a valid dollar amount.`);
    ids.add(id);
    rows.push({
      id,
      line,
      incurredDate,
      paymentDate,
      status,
      payee: (r.payee ?? "").trim(),
      payeeType: payeeType as LedgerRow["payeeType"],
      description: (r.description ?? "").trim(),
      account: (r.account ?? "").trim(),
      category,
      amountCents,
      documentId: (r.document ?? "").trim(),
      drawnIn: (r.drawn_in ?? "").trim(),
    });
  });
  if (!rows.length && !issues.length) issues.push({ file: "ledger", line: 1, message: "The ledger file has no rows." });
  return { rows, issues };
}
