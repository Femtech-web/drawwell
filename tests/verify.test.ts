import { describe, expect, it } from "vitest";
import { quoteAppearsIn } from "@/rules/cfr";
import { verifyServReview } from "@/engine/verify";
import type { ServReviewRow } from "@/serv/schema";
import { sampleInput } from "@/samples";

const input = sampleInput("upward-bound");
const rows = input.ledger.filter((r) => ["L-1104", "L-1105", "L-1106", "L-1109"].includes(r.id));
const base = (rowId: string): ServReviewRow => ({
  row_id: rowId, coded_category_fits: true, best_category: "Supplies", allowability: "allowable", reason: "ok",
  citations: [{ section: "200.453", quote: "Costs incurred for materials, supplies, and fabricated parts necessary for the performance of a Federal award are allowable." }],
  term_refs: [], document_total: null, document_total_quote: null, partial_amount: null, partial_quote: null, partial_reason: null,
  injection_detected: false,
});

describe("quote verification", () => {
  it("requires word-for-word text of meaningful length", () => {
    expect(quoteAppearsIn("The cost of alcoholic beverages is unallowable.", "The cost of alcoholic beverages is unallowable.")).toBe(true);
    expect(quoteAppearsIn("unallowable", "The cost of alcoholic beverages is unallowable.")).toBe(false);
    expect(quoteAppearsIn("Alcohol is never allowed under any federal award", "The cost of alcoholic beverages is unallowable.")).toBe(false);
  });
});

describe("verifying SERV output", () => {
  const raw: ServReviewRow[] = [
    { ...base("L-1104"), document_total: 1263, document_total_quote: "TOTAL                                               $1,263.00" },
    {
      ...base("L-1105"), best_category: "Other", allowability: "needs_review",
      citations: [{ section: "200.423", quote: "The cost of alcoholic beverages is unallowable." }],
      partial_amount: 38, partial_quote: "House red wine (2 btl) @ 19.00                         38.00", partial_reason: "Wine is unallowable.",
    },
    { ...base("L-1106"), best_category: "Other", allowability: "likely_unallowable", citations: [{ section: "200.438", quote: "Staff parties are always unallowable under federal grants." }] },
  ];
  const v = verifyServReview(raw, rows, input.documents, input.terms);

  it("turns a verified receipt total that differs from the ledger into a blocking error", () => {
    const f = v.findings.find((x) => x.code === "DOCUMENT_MISMATCH");
    expect(f).toMatchObject({ severity: "error", rowIds: ["L-1104"], amountCents: 2700, verified: true });
  });
  it("proposes removing only the verified unallowable line", () => {
    expect(v.proposedAdjustments).toEqual([{ rowId: "L-1105", removeCents: 3800, reason: "Wine is unallowable." }]);
  });
  it("drops an invented citation and downgrades the conclusion to review", () => {
    expect(v.assessments["L-1106"]).toMatchObject({ allowability: "needs_review", downgraded: true, citations: [] });
    expect(v.findings.some((f) => f.code === "UNVERIFIED_CITATION" && f.rowIds[0] === "L-1106")).toBe(true);
  });
  it("never produces a model-only blocking error", () => {
    expect(v.findings.filter((f) => f.severity === "error" && !f.verified)).toEqual([]);
  });
  it("reports rows SERV skipped", () => {
    expect(v.findings.some((f) => f.code === "NOT_ASSESSED" && f.rowIds[0] === "L-1109")).toBe(true);
    expect(v.stats).toMatchObject({ rowsExpected: 4, rowsReturned: 3, citationsReturned: 3, citationsVerified: 2 });
  });
  it("ignores a document quote that is not in the document", () => {
    const w = verifyServReview([{ ...base("L-1104"), document_total: 1236, document_total_quote: "TOTAL $1,236.00" }], rows, input.documents, input.terms);
    expect(w.findings.some((f) => f.code === "DOCUMENT_MISMATCH")).toBe(false);
    expect(w.assessments["L-1104"].documentVerified).toBe(false);
  });
  it("judges the remainder once a partial line is verified, without a second whole-row rejection", () => {
    const w = verifyServReview([{
      ...base("L-1105"), best_category: "Other", allowability: "likely_unallowable",
      citations: [{ section: "200.423", quote: "The cost of alcoholic beverages is unallowable." }],
      partial_amount: 38, partial_quote: "House red wine (2 btl) @ 19.00                         38.00", partial_reason: "Wine is unallowable.",
    }], rows, input.documents, input.terms);
    expect(w.assessments["L-1105"].allowability).toBe("needs_review");
    expect(w.findings.filter((f) => f.code === "LIKELY_UNALLOWABLE")).toEqual([]);
    expect(w.findings.filter((f) => f.rowIds[0] === "L-1105").map((f) => f.code).sort()).toEqual(["NEEDS_REVIEW", "PARTIAL_UNALLOWABLE"]);
  });
  it("folds a category mismatch into the judgment finding instead of a second card", () => {
    const w = verifyServReview([{ ...base("L-1109"), coded_category_fits: false, best_category: "Equipment", allowability: "needs_review" }], rows, input.documents, input.terms);
    const mine = w.findings.filter((f) => f.rowIds[0] === "L-1109");
    expect(mine.map((f) => f.code)).toEqual(["NEEDS_REVIEW"]);
    expect(mine[0].title).toContain("looks like Equipment");
  });
  it("accepts a shared payroll register whose total equals the rows it supports", () => {
    const cs = sampleInput("community-schools");
    const pay = cs.ledger.filter((r) => r.documentId === "PAY-OCT");
    const quote = "Total charged to FSCS                               $9,208.33";
    const w = verifyServReview(pay.map((r) => ({ ...base(r.id), best_category: r.category, document_total: 9208.33, document_total_quote: quote })), pay, cs.documents, cs.terms, cs.ledger);
    expect(w.findings.filter((f) => f.code === "DOCUMENT_MISMATCH")).toEqual([]);
    expect(w.assessments["E-1001"].documentVerified).toBe(true);
  });
});
