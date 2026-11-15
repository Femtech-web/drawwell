import { cfrUrl, getSection, quoteAppearsIn, sectionText } from "@/rules/cfr";
import type { ServReviewRow } from "@/serv/schema";
import { formatMoney, moneyVariants } from "./money";
import type { Adjustment } from "./totals";
import { ED524_CATEGORIES, type AwardTerm, type Category, type Citation, type Finding, type LedgerRow, type SupportingDocument } from "./types";

export type Allowability = ServReviewRow["allowability"];

export interface RowAssessment {
  rowId: string;
  allowability: Allowability;
  reason: string;
  citations: Citation[];
  suggestedCategory: Category | null;
  documentTotalCents: number | null;
  documentVerified: boolean;
  injectionDetected: boolean;
  downgraded: boolean;
}

export interface VerificationStats {
  rowsExpected: number;
  rowsReturned: number;
  citationsReturned: number;
  citationsVerified: number;
  termRefsReturned: number;
  termRefsVerified: number;
  documentQuotesReturned: number;
  documentQuotesVerified: number;
  downgrades: number;
}

export interface Verified {
  assessments: Record<string, RowAssessment>;
  findings: Finding[];
  proposedAdjustments: Adjustment[];
  stats: VerificationStats;
}

const toCents = (n: number) => Math.round(n * 100);

function quoteShowsAmount(quote: string, cents: number): boolean {
  return moneyVariants(cents).some((v) => quote.replace(/\s/g, "").includes(v));
}

export function verifyServReview(
  raw: ServReviewRow[],
  rows: LedgerRow[],
  documents: SupportingDocument[],
  terms: AwardTerm[],
  ledger: LedgerRow[] = rows,
): Verified {
  const findings: Finding[] = [];
  const assessments: Record<string, RowAssessment> = {};
  const proposedAdjustments: Adjustment[] = [];
  const stats: VerificationStats = {
    rowsExpected: rows.length, rowsReturned: 0, citationsReturned: 0, citationsVerified: 0,
    termRefsReturned: 0, termRefsVerified: 0, documentQuotesReturned: 0, documentQuotesVerified: 0, downgrades: 0,
  };
  const rowById = new Map(rows.map((r) => [r.id, r]));
  const seen = new Set<string>();

  for (const entry of raw) {
    const row = rowById.get(entry.row_id);
    if (!row || seen.has(entry.row_id)) continue;
    seen.add(entry.row_id);
    stats.rowsReturned++;

    const citations: Citation[] = [];
    let rejected = 0;
    for (const c of entry.citations) {
      stats.citationsReturned++;
      const section = getSection(c.section);
      if (section && quoteAppearsIn(c.quote, sectionText(section))) {
        stats.citationsVerified++;
        citations.push({ kind: "cfr", ref: `2 CFR ${section.section}`, quote: c.quote.trim(), url: cfrUrl(section.section) });
      } else rejected++;
    }
    for (const t of entry.term_refs) {
      stats.termRefsReturned++;
      const term = terms.find((x) => x.id === t.term_id);
      if (term && quoteAppearsIn(t.quote, term.text)) {
        stats.termRefsVerified++;
        citations.push({ kind: "term", ref: `Award term ${term.id}: ${term.title}`, quote: t.quote.trim() });
      } else rejected++;
    }

    const doc = documents.find((d) => d.id === row.documentId);
    let partialVerified = false;
    if (doc && entry.partial_amount !== null && entry.partial_quote) {
      const cents = toCents(entry.partial_amount);
      const quoteOk = doc.text.includes(entry.partial_quote.trim()) && quoteShowsAmount(entry.partial_quote, cents);
      if (quoteOk && cents > 0 && cents < row.amountCents) {
        partialVerified = true;
        const reason = entry.partial_reason ?? "Part of this charge may be unallowable.";
        proposedAdjustments.push({ rowId: row.id, removeCents: cents, reason });
        findings.push({
          id: `PARTIAL_UNALLOWABLE:${row.id}`, code: "PARTIAL_UNALLOWABLE", severity: "review", source: "serv", rowIds: [row.id],
          title: `Remove ${formatMoney(cents, { forceCents: true })} from this charge?`,
          detail: reason,
          amountCents: cents,
          citations: [{ kind: "document", ref: doc.id, quote: entry.partial_quote.trim() }, ...citations.filter((c) => c.kind === "cfr")],
          verified: true,
        });
      }
    }

    let allowability = entry.allowability;
    let downgraded = false;
    const hasCfr = citations.some((c) => c.kind === "cfr");
    if (allowability === "likely_unallowable" && !hasCfr) {
      allowability = "needs_review";
      downgraded = true;
    }
    if (allowability === "allowable" && citations.length === 0) {
      allowability = "needs_review";
      downgraded = true;
    }
    // Once the unallowable line is split out, the row-level question is about the remainder.
    if (allowability === "likely_unallowable" && partialVerified) allowability = "needs_review";
    if (downgraded) stats.downgrades++;

    let documentTotalCents: number | null = null;
    let documentVerified = false;
    if (doc && entry.document_total !== null && entry.document_total_quote) {
      stats.documentQuotesReturned++;
      const cents = toCents(entry.document_total);
      if (doc.text.includes(entry.document_total_quote.trim()) && quoteShowsAmount(entry.document_total_quote, cents)) {
        stats.documentQuotesVerified++;
        documentTotalCents = cents;
        documentVerified = true;
        // A payroll register can support salary and fringe rows at once; its total then matches their sum.
        const sharing = ledger.filter((r) => r.documentId === row.documentId);
        const sharedTotal = sharing.reduce((sum, r) => sum + r.amountCents, 0);
        if (cents !== row.amountCents && !(sharing.length > 1 && cents === sharedTotal)) {
          findings.push({
            id: `DOCUMENT_MISMATCH:${row.id}`, code: "DOCUMENT_MISMATCH", severity: "error", source: "serv", rowIds: [row.id],
            title: "Document total doesn't match the ledger",
            detail: `${doc.id} shows ${formatMoney(cents, { forceCents: true })}; the ledger has ${formatMoney(row.amountCents, { forceCents: true })} (difference ${formatMoney(Math.abs(row.amountCents - cents), { forceCents: true })}). Correct the ledger or the document before drawing.`,
            amountCents: Math.abs(row.amountCents - cents),
            citations: [{ kind: "document", ref: doc.id, quote: entry.document_total_quote.trim() }],
            verified: true,
          });
        }
      }
    }

    const suggested = (ED524_CATEGORIES as readonly string[]).includes(entry.best_category) ? (entry.best_category as Category) : null;
    const miscoded = !entry.coded_category_fits && suggested && suggested !== row.category;
    if (miscoded && allowability === "allowable") {
      findings.push({
        id: `CATEGORY_MISMATCH:${row.id}`, code: "CATEGORY_MISMATCH", severity: "review", source: "serv", rowIds: [row.id],
        title: `Coded ${row.category}; looks like ${suggested}`,
        detail: entry.reason,
        citations: citations.filter((c) => c.kind === "cfr"),
      });
    }

    if (allowability !== "allowable") {
      findings.push({
        id: `ALLOWABILITY:${row.id}`, code: allowability === "likely_unallowable" ? "LIKELY_UNALLOWABLE" : "NEEDS_REVIEW",
        severity: "review", source: "serv", rowIds: [row.id],
        title: `${allowability === "likely_unallowable" ? "Likely unallowable: confirm before drawing" : partialVerified ? "Check the rest of this charge" : "Needs your judgment"}${miscoded ? ` · coded ${row.category}, looks like ${suggested}` : ""}`,
        detail: downgraded
          ? `${entry.reason} (SERV's ${entry.allowability === "allowable" ? "approval" : "conclusion"} had no citation Drawwell could verify, so it is shown for review.)`
          : entry.reason,
        amountCents: allowability === "likely_unallowable" ? row.amountCents : undefined,
        citations,
      });
    }
    if (rejected) {
      findings.push({
        id: `UNVERIFIED_CITATION:${row.id}`, code: "UNVERIFIED_CITATION", severity: "info", source: "code", rowIds: [row.id],
        title: `${rejected} citation${rejected > 1 ? "s" : ""} removed`,
        detail: "SERV quoted text Drawwell could not find word for word in the cited rule or award term, so it was not shown.",
        citations: [],
      });
    }

    assessments[row.id] = {
      rowId: row.id, allowability, reason: entry.reason, citations, suggestedCategory: suggested,
      documentTotalCents, documentVerified, injectionDetected: entry.injection_detected, downgraded,
    };
  }

  for (const row of rows) {
    if (!seen.has(row.id)) {
      findings.push({
        id: `NOT_ASSESSED:${row.id}`, code: "NOT_ASSESSED", severity: "review", source: "code", rowIds: [row.id],
        title: "SERV returned no assessment", detail: `${row.id} was sent for review but not returned. Check it by hand or run the review again.`,
        citations: [],
      });
    }
  }
  return { assessments, findings, proposedAdjustments, stats };
}
