"use client";

import { formatShortDate } from "@/engine/dates";
import { verifyJustification } from "@/engine/justification";
import { formatMoney, sumCents } from "@/engine/money";
import type { JustifyResult, ReviewResult } from "@/engine/review";
import type { Adjustment, RequestSummary } from "@/engine/totals";
import { budgetPositions, personalNames } from "@/lib/request";
import { CFR_SNAPSHOT_DATE } from "@/rules/cfr";
import { Money, Stamp } from "../parts";
import type { Resolution } from "./FindingsPanel";
import type { Loaded } from "./Workspace";

const RESOLUTION_LABEL: Record<Resolution, string> = { exclude: "Excluded from this draw", keep: "Kept after review", accept: "Amount removed" };

export function ReportView({
  data, review, summary, requestedCents, excluded, resolutions, adjustments, justification, justificationMeta, onClose,
}: {
  data: Loaded;
  review: ReviewResult;
  summary: RequestSummary;
  requestedCents: number;
  excluded: Set<string>;
  resolutions: Record<string, Resolution>;
  adjustments: Adjustment[];
  justification: string;
  justificationMeta: JustifyResult | null;
  onClose: () => void;
}) {
  const a = data.award;
  const generated = new Date();
  const rows = data.ledger.filter((r) => review.servRowIds.includes(r.id) || review.findings.some((f) => f.rowIds[0] === r.id));
  const positions = budgetPositions(a, data.budget, data.ledger, summary);
  const checks = justification && summary.totals.length
    ? verifyJustification(justification, {
        programName: a.programName, awardNumber: a.awardNumber, basis: a.paymentBasis, totals: summary.totals,
        startIso: summary.startIso, endIso: summary.endIso, personalNames: personalNames(data.ledger),
      })
    : [];
  const calls = [...review.calls, ...(justificationMeta?.calls ?? [])];

  function decision(rowId: string): string {
    const errs = review.findings.filter((f) => f.severity === "error" && f.rowIds[0] === rowId);
    if (errs.length) return `Removed: ${errs.map((e) => e.title.toLowerCase()).join("; ")}`;
    if (excluded.has(rowId)) return "Excluded after review";
    const adj = adjustments.filter((x) => x.rowId === rowId);
    if (adj.length) return `Included less ${formatMoney(sumCents(adj.map((x) => x.removeCents)), { forceCents: true })}`;
    return "Included";
  }

  function download() {
    const blob = new Blob(
      [JSON.stringify({ generatedAt: generated.toISOString(), award: a, summary, justification, checks, review, resolutions, adjustments, justificationMeta, cfrSnapshot: CFR_SNAPSHOT_DATE }, null, 2)],
      { type: "application/json" },
    );
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `drawwell-${a.awardNumber}-${a.requestDate}.json`;
    link.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="mx-auto max-w-5xl px-4 sm:px-6 py-8">
      <div className="no-print flex flex-wrap gap-3 mb-6">
        <button className="btn btn-quiet" onClick={onClose}>← Back to the review</button>
        <button className="btn btn-primary" onClick={() => window.print()}>Print or save as PDF</button>
        <button className="btn btn-quiet" onClick={download}>Download JSON</button>
      </div>

      <article className="card p-6 sm:p-10 text-[0.92rem]">
        <header className="border-b-2 border-ink pb-5">
          <div className="flex flex-wrap justify-between gap-3">
            <div className="eyebrow">Drawwell evidence report · G5 payment request</div>
            {data.sample && <Stamp tone="error" tilt>Synthetic sample records</Stamp>}
          </div>
          <h1 className="font-display text-3xl font-semibold mt-3">{a.programName} · {a.awardNumber}</h1>
          <p className="text-ink-soft mt-1">{a.recipient} · ALN {a.assistanceListing} · Budget period {formatShortDate(a.budgetPeriodStart)}–{formatShortDate(a.budgetPeriodEnd)}</p>
          <p className="text-ink-faint text-xs mt-1">Request date {formatShortDate(a.requestDate)} · {a.paymentBasis === "advance" ? `Advance, ${a.advanceWindowDays}-business-day window` : "Reimbursement"} · Generated {generated.toLocaleString()}</p>
        </header>

        <section className="mt-6 grid sm:grid-cols-3 gap-4">
          <div><div className="eyebrow">Selected</div><div className="text-lg"><Money cents={requestedCents} /></div></div>
          <div><div className="eyebrow">Removed</div><div className="text-lg text-seal"><Money cents={requestedCents - summary.totalCents} /></div></div>
          <div><div className="eyebrow">Requested from G5</div><div className="text-lg font-semibold"><Money cents={summary.totalCents} strong /></div></div>
        </section>

        <section className="mt-8">
          <h2 className="font-display text-xl font-semibold">Payment justification</h2>
          {justification ? (
            <>
              <p className="comment-box mt-2 rounded border border-slate/30 px-3 text-[0.86rem]">{justification}</p>
              <p className="text-xs text-ink-faint mt-1">
                {justification.length}/255 characters · {justificationMeta?.source === "serv" ? `Drafted by SERV (attempt ${justificationMeta.attempts})` : justificationMeta ? "Plain version from verified numbers" : "Written by the user"}
                {" · "}{checks.filter((c) => c.pass).length}/{checks.length} checks pass
                {checks.some((c) => !c.pass) ? `: failing ${checks.filter((c) => !c.pass).map((c) => c.label.toLowerCase()).join(", ")}` : ""}
              </p>
            </>
          ) : (
            <p className="text-sm text-amber mt-2">No justification written yet.</p>
          )}
        </section>

        <section className="mt-8">
          <h2 className="font-display text-xl font-semibold">Budget position</h2>
          <table className="w-full mt-2 text-sm">
            <thead><tr className="border-b border-ink text-left"><th className="py-1.5">Category</th><th className="text-right">Approved</th><th className="text-right">Drawn to date</th><th className="text-right">This request</th><th className="text-right">Remaining</th></tr></thead>
            <tbody>
              {positions.map((p) => (
                <tr key={p.category} className="border-b border-rule">
                  <td className="py-1.5">{p.category}</td>
                  <td className="text-right"><Money cents={p.approvedCents} /></td>
                  <td className="text-right"><Money cents={p.drawnCents} /></td>
                  <td className="text-right">{p.requestCents ? <Money cents={p.requestCents} /> : "—"}</td>
                  <td className={`text-right ${p.remainingCents < 0 ? "text-seal" : ""}`}><Money cents={p.remainingCents} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>

        <section className="mt-8">
          <h2 className="font-display text-xl font-semibold">Line-by-line trace</h2>
          <table className="w-full mt-2 text-[0.8rem]">
            <thead><tr className="border-b border-ink text-left align-bottom"><th className="py-1.5 pr-2">Row</th><th className="pr-2">Expense</th><th className="pr-2">Category</th><th className="pr-2 text-right">Amount</th><th className="pr-2">Document</th><th className="pr-2">SERV assessment</th><th>Decision</th></tr></thead>
            <tbody>
              {rows.map((r) => {
                const as = review.assessments[r.id];
                return (
                  <tr key={r.id} className="border-b border-rule align-top">
                    <td className="py-1.5 pr-2 font-mono">{r.id}</td>
                    <td className="pr-2">{r.payee}<div className="text-ink-faint">{r.description} · {formatShortDate(r.incurredDate)}</div></td>
                    <td className="pr-2">{r.category}</td>
                    <td className="pr-2 text-right"><Money cents={r.amountCents} /></td>
                    <td className="pr-2 font-mono">{r.documentId || "—"}{as?.documentVerified ? " ✓" : ""}</td>
                    <td className="pr-2">{as ? <><b>{as.allowability.replace("_", " ")}</b>: {as.reason}{as.citations.length ? <div className="text-ink-faint">{as.citations.map((c) => c.ref).join("; ")}</div> : null}</> : "Not sent to SERV"}</td>
                    <td>{decision(r.id)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </section>

        <section className="mt-8">
          <h2 className="font-display text-xl font-semibold">Findings and decisions</h2>
          <ol className="mt-2 space-y-3">
            {review.findings.filter((f) => f.severity !== "info").map((f) => (
              <li key={f.id} className="border-l-2 pl-3 border-rule-strong">
                <div className="font-semibold">
                  {f.severity === "error" ? "Fix" : "Judgment"} · {f.title}{" "}
                  <span className="font-mono text-xs text-ink-faint">{f.rowIds.join(", ")}</span>
                </div>
                <div>{f.detail}</div>
                {f.citations.map((c, i) => <div key={i} className="text-ink-soft text-xs mt-0.5">{c.ref}: “{c.quote}”</div>)}
                <div className="text-xs mt-1">
                  Source: {f.source === "code" ? "code check" : f.verified ? "SERV, evidence verified by code" : "SERV judgment"} · Decision:{" "}
                  {f.severity === "error" ? "removed from request" : resolutions[f.id] ? RESOLUTION_LABEL[resolutions[f.id]] : "open"}
                </div>
              </li>
            ))}
          </ol>
        </section>

        <section className="mt-8 text-xs text-ink-soft">
          <h2 className="font-display text-xl font-semibold text-ink">Method</h2>
          <p className="mt-2">
            Rules: 2 CFR Part 200 from the eCFR, current as of {CFR_SNAPSHOT_DATE}; ED payment justification memo and G5 walkthrough of Sept. 28, 2026.
            Code checks run on the ledger and budget. SERV Reasoning reviewed {review.servRowIds.length} rows; every citation and document quote shown here
            was found word for word in its source{review.stats ? ` (${review.stats.citationsVerified}/${review.stats.citationsReturned} citations, ${review.stats.documentQuotesVerified}/${review.stats.documentQuotesReturned} document quotes kept)` : ""}.
          </p>
          <ul className="mt-2 font-mono">
            {calls.map((c, i) => (
              <li key={i}>
                {c.purpose} · {c.modelId} · {(c.latencyMs / 1000).toFixed(1)}s · {c.promptTokens ?? "?"} in / {c.completionTokens ?? "?"} out
                {c.features.shadowAgent ? " · shadow agent" : ""}{c.features.promptGuard ? " · prompt guard" : ""}{c.outcome === "empty" ? " · returned empty, retried" : ""}{c.requestId ? ` · ${c.requestId}` : ""}
              </li>
            ))}
          </ul>
          <p className="mt-3">
            Drawwell helps prepare a payment request. It does not approve payments or determine allowability; the Department of Education and your award terms do.
          </p>
        </section>
      </article>
    </div>
  );
}
