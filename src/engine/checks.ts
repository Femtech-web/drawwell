import { cfrUrl, getSection, sectionText } from "@/rules/cfr";
import { businessDaysBetween, daysBetween, formatShortDate } from "./dates";
import { findInjection } from "./injection";
import { formatMoney, sumCents } from "./money";
import type { Category, Citation, Finding, LedgerRow, ReviewInput } from "./types";

/** Shorter than a monthly billing cycle, so recurring monthly invoices are not flagged. */
export const POSSIBLE_DUPLICATE_WINDOW_DAYS = 21;
export const EQUIPMENT_CAP_CENTS = 1_000_000;

function cfr(section: string, startsWith: string, through?: string): Citation {
  const s = getSection(section);
  const text = s ? sectionText(s) : "";
  const at = text.indexOf(startsWith);
  const end = through ? text.indexOf(through, at) + through.length : text.indexOf(".", at + startsWith.length) + 1;
  if (!s || at < 0 || end <= at) throw new Error(`Rule snapshot is missing ${section}: "${startsWith}"`);
  return { kind: "cfr", ref: `2 CFR ${section}`, quote: text.slice(at, end), url: cfrUrl(section) };
}

export function equipmentThresholdCents(capitalizationThreshold: number): number {
  return Math.min(Math.round(capitalizationThreshold * 100), EQUIPMENT_CAP_CENTS);
}

export interface CheckResult {
  findings: Finding[];
  selected: LedgerRow[];
  drawnToDateByCategory: Partial<Record<Category, number>>;
}

export function runChecks(input: ReviewInput): CheckResult {
  const { award, budget, ledger, documents } = input;
  const findings: Finding[] = [];
  const add = (f: Omit<Finding, "id">) => findings.push({ ...f, id: `${f.code}:${f.rowIds.join(",") || "request"}` });
  const byId = new Map(ledger.map((r) => [r.id, r]));
  const docIds = new Set(documents.map((d) => d.id));

  const unknown = input.selectedRowIds.filter((id) => !byId.has(id));
  if (unknown.length) {
    add({
      code: "UNKNOWN_ROW", severity: "error", source: "code", rowIds: unknown,
      title: "Selected rows are not in the ledger",
      detail: `${unknown.join(", ")} could not be found in the uploaded ledger.`, citations: [],
    });
  }
  const selected = input.selectedRowIds.map((id) => byId.get(id)).filter((r): r is LedgerRow => !!r);
  if (!selected.length) {
    add({
      code: "EMPTY_REQUEST", severity: "error", source: "code", rowIds: [],
      title: "No expenses selected", detail: "Select at least one ledger row for this payment request.", citations: [],
    });
  }

  const drawnRows = ledger.filter((r) => r.drawnIn);
  const threshold = equipmentThresholdCents(award.capitalizationThreshold);

  for (const row of selected) {
    if (row.drawnIn) {
      add({
        code: "ALREADY_DRAWN", severity: "error", source: "code", rowIds: [row.id],
        title: "Already drawn",
        detail: `${row.id} (${row.payee}, ${formatMoney(row.amountCents)}) is recorded as paid by drawdown ${row.drawnIn}. Drawing it again would be a duplicate payment.`,
        amountCents: row.amountCents,
        citations: [cfr("200.1", "The term improper payment includes", "any duplicate payment")],
      });
      continue;
    }

    if (row.documentId) {
      // One document can support several rows (salary and fringe share a payroll register); a repeat needs the same amount too.
      const sameCharge = (d: LedgerRow) => d.id !== row.id && d.documentId === row.documentId && d.amountCents === row.amountCents;
      const priorSameDoc = drawnRows.find(sameCharge);
      const twiceInRequest = selected.find((d) => sameCharge(d) && !d.drawnIn);
      if (priorSameDoc) {
        add({
          code: "DUPLICATE_DOCUMENT", severity: "error", source: "code", rowIds: [row.id, priorSameDoc.id],
          title: "Same invoice already drawn",
          detail: `${row.id} cites document ${row.documentId}, which ${priorSameDoc.id} already used in drawdown ${priorSameDoc.drawnIn}.`,
          amountCents: row.amountCents,
          citations: [cfr("200.1", "The term improper payment includes", "any duplicate payment")],
        });
        continue;
      }
      if (twiceInRequest && row.id > twiceInRequest.id) {
        add({
          code: "DUPLICATE_DOCUMENT", severity: "error", source: "code", rowIds: [row.id, twiceInRequest.id],
          title: "Same invoice twice in this request",
          detail: `${row.id} and ${twiceInRequest.id} both cite document ${row.documentId}.`,
          amountCents: row.amountCents,
          citations: [cfr("200.1", "The term improper payment includes", "any duplicate payment")],
        });
        continue;
      }
    }

    const lookalike = row.payeeType !== "internal" && ledger.find(
      (o) => o.id !== row.id && o.payee === row.payee && o.amountCents === row.amountCents &&
        o.documentId !== row.documentId && Math.abs(daysBetween(o.incurredDate, row.incurredDate)) <= POSSIBLE_DUPLICATE_WINDOW_DAYS &&
        (o.drawnIn || input.selectedRowIds.includes(o.id)),
    );
    if (lookalike && (lookalike.drawnIn || row.id > lookalike.id)) {
      add({
        code: "POSSIBLE_DUPLICATE", severity: "review", source: "code", rowIds: [row.id, lookalike.id],
        title: "Looks like a repeat charge",
        detail: `${row.id} and ${lookalike.id} are both ${formatMoney(row.amountCents)} to ${row.payee} within ${POSSIBLE_DUPLICATE_WINDOW_DAYS} days, with different document numbers. Confirm these are separate purchases.`,
        citations: [],
      });
    }

    if (row.incurredDate < award.budgetPeriodStart || row.incurredDate > award.budgetPeriodEnd) {
      add({
        code: "OUTSIDE_BUDGET_PERIOD", severity: "error", source: "code", rowIds: [row.id],
        title: "Outside the budget period",
        detail: `${row.id} was incurred on ${formatShortDate(row.incurredDate)}, outside the budget period ${formatShortDate(award.budgetPeriodStart)}–${formatShortDate(award.budgetPeriodEnd)}.`,
        amountCents: row.amountCents,
        citations: [cfr("200.403", "All other costs must be incurred during the approved budget period")],
      });
    }

    if (award.paymentBasis === "reimbursement") {
      if (row.status !== "paid" || row.paymentDate > award.requestDate) {
        add({
          code: "NOT_YET_PAID", severity: "error", source: "code", rowIds: [row.id],
          title: "Not paid yet",
          detail: `This award is on reimbursement, so a request can include only costs already paid. ${row.id} is ${row.status === "paid" ? `dated to be paid ${formatShortDate(row.paymentDate)}` : "still scheduled"}.`,
          amountCents: row.amountCents,
          citations: [],
        });
      }
    } else if (row.status === "scheduled") {
      if (row.paymentDate < award.requestDate) {
        add({
          code: "STALE_SCHEDULED", severity: "review", source: "code", rowIds: [row.id],
          title: "Scheduled date has passed",
          detail: `${row.id} is marked scheduled for ${formatShortDate(row.paymentDate)}, before this request. Confirm whether it was paid.`,
          citations: [],
        });
      } else {
        const wait = businessDaysBetween(award.requestDate, row.paymentDate);
        if (wait > award.advanceWindowDays) {
          add({
            code: "OUTSIDE_ADVANCE_WINDOW", severity: "error", source: "code", rowIds: [row.id],
            title: "Not an immediate cash need",
            detail: `${row.id} is scheduled ${wait} business days after the request; your cash procedures allow ${award.advanceWindowDays}. Draw it closer to the payment date.`,
            amountCents: row.amountCents,
            citations: [cfr("200.305", "Advance payments to a recipient or subrecipient must be limited to the minimum amounts needed")],
          });
        }
      }
    }

    const line = budget.find((b) => b.category === row.category);
    if (!line || line.approvedCents === 0) {
      add({
        code: "NO_APPROVED_BUDGET", severity: "review", source: "code", rowIds: [row.id],
        title: `No approved ${row.category} budget`,
        detail: `${row.id} is coded to ${row.category}, which has no approved funds on this award. It may need a budget revision or prior approval.`,
        citations: [cfr("200.308", "The recipient or subrecipient must request prior approvals")],
      });
    }

    if (row.category === "Supplies" && row.amountCents >= threshold) {
      add({
        code: "EQUIPMENT_THRESHOLD", severity: "review", source: "code", rowIds: [row.id],
        title: "Could be equipment",
        detail: `${row.id} is ${formatMoney(row.amountCents)} coded to Supplies. If any single item costs ${formatMoney(threshold)} or more, it is equipment and may need prior approval.`,
        citations: [cfr("200.1", "Equipment means")],
      });
    }

    if (documents.length && (!row.documentId || !docIds.has(row.documentId))) {
      add({
        code: "MISSING_DOCUMENT", severity: "review", source: "code", rowIds: [row.id],
        title: "No supporting document",
        detail: row.documentId
          ? `${row.id} cites ${row.documentId}, which is not among the supplied documents.`
          : `${row.id} has no document reference.`,
        citations: [cfr("200.403", "Be adequately documented")],
      });
    }

    const doc = documents.find((d) => d.id === row.documentId);
    const injected = findInjection(row.description) ?? (doc ? findInjection(doc.text) : null);
    if (injected) {
      add({
        code: "INSTRUCTION_IN_DATA", severity: "review", source: "code", rowIds: [row.id],
        title: "Instructions hidden in the record",
        detail: `The ${findInjection(row.description) ? "ledger description" : `document ${row.documentId}`} contains text addressed to an AI reviewer ("${injected}"). Drawwell treats it as data; check this item by hand.`,
        citations: [],
      });
    }
  }

  if (!documents.length && selected.length) {
    add({
      code: "NO_DOCUMENTS", severity: "info", source: "code", rowIds: [],
      title: "No supporting documents supplied",
      detail: "SERV reviewed ledger descriptions only. Add receipts or invoices to reconcile amounts.", citations: [],
    });
  }

  const drawnToDateByCategory: Partial<Record<Category, number>> = {};
  for (const r of drawnRows) {
    if (r.incurredDate >= award.budgetPeriodStart && r.incurredDate <= award.budgetPeriodEnd) {
      drawnToDateByCategory[r.category] = (drawnToDateByCategory[r.category] ?? 0) + r.amountCents;
    }
  }
  const blocked = new Set(findings.filter((f) => f.severity === "error").flatMap((f) => f.rowIds.slice(0, 1)));
  const fresh = selected.filter((r) => !blocked.has(r.id));
  for (const line of budget) {
    const requested = sumCents(fresh.filter((r) => r.category === line.category).map((r) => r.amountCents));
    if (!requested || line.approvedCents === 0) continue;
    const after = (drawnToDateByCategory[line.category] ?? 0) + requested;
    if (after > line.approvedCents) {
      add({
        code: "OVER_CATEGORY_BUDGET", severity: "review", source: "code",
        rowIds: fresh.filter((r) => r.category === line.category).map((r) => r.id),
        title: `${line.category} over approved budget`,
        detail: `${line.category} drawn to date plus this request is ${formatMoney(after)}, ${formatMoney(after - line.approvedCents)} over the approved ${formatMoney(line.approvedCents)}. Check whether your award allows this transfer between categories.`,
        amountCents: after - line.approvedCents,
        citations: [cfr("200.308", "The recipient or subrecipient must request prior approvals")],
      });
    }
  }
  const approvedTotal = sumCents(budget.map((b) => b.approvedCents));
  const drawnTotal = sumCents(Object.values(drawnToDateByCategory) as number[]);
  const requestTotal = sumCents(fresh.map((r) => r.amountCents));
  if (requestTotal && drawnTotal + requestTotal > approvedTotal) {
    add({
      code: "OVER_AWARD_TOTAL", severity: "error", source: "code", rowIds: [],
      title: "More than the award's remaining balance",
      detail: `Drawn to date ${formatMoney(drawnTotal)} plus this request ${formatMoney(requestTotal)} exceeds the approved budget ${formatMoney(approvedTotal)}.`,
      amountCents: drawnTotal + requestTotal - approvedTotal,
      citations: [],
    });
  }

  return { findings, selected, drawnToDateByCategory };
}
