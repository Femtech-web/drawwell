"use client";

import { useEffect, useMemo, useState } from "react";
import { parseBudgetCsv, parseLedgerCsv } from "@/engine/csv";
import { formatShortDate } from "@/engine/dates";
import { sumCents } from "@/engine/money";
import type { JustifyResult, ReviewResult } from "@/engine/review";
import { summarizeRequest, type Adjustment } from "@/engine/totals";
import type { Award, AwardTerm, BudgetLine, Finding, LedgerRow, SupportingDocument } from "@/engine/types";
import { SAMPLE_SOURCES } from "@/samples/data.generated";
import { Money, SectionHeader, Stamp } from "../parts";
import { ExpenseTable } from "./ExpenseTable";
import { FindingsPanel, type Resolution } from "./FindingsPanel";
import { JustificationPanel } from "./JustificationPanel";
import { ReportView } from "./ReportView";
import { UploadPanel, type UploadResult } from "./UploadPanel";

export interface Loaded {
  sourceLabel: string;
  sample: boolean;
  award: Award;
  budgetCsv: string;
  ledgerCsv: string;
  budget: BudgetLine[];
  ledger: LedgerRow[];
  terms: AwardTerm[];
  documents: SupportingDocument[];
}

interface Status {
  servConfigured: boolean;
  model: string;
  features: { multipath: boolean; promptGuard: boolean; shadowAgent: boolean };
}

function loadSample(id: string): Loaded {
  const s = SAMPLE_SOURCES.find((x) => x.id === id)!;
  return {
    sourceLabel: s.label, sample: true, award: s.award, budgetCsv: s.budgetCsv, ledgerCsv: s.ledgerCsv,
    budget: parseBudgetCsv(s.budgetCsv).rows, ledger: parseLedgerCsv(s.ledgerCsv).rows, terms: s.terms, documents: s.documents,
  };
}

export function Workspace() {
  const [data, setData] = useState<Loaded | null>(null);
  const [uploading, setUploading] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [status, setStatus] = useState<Status | null>(null);
  const [review, setReview] = useState<ReviewResult | null>(null);
  const [reviewing, setReviewing] = useState(false);
  const [reviewError, setReviewError] = useState<string | null>(null);
  const [elapsed, setElapsed] = useState(0);
  const [resolutions, setResolutions] = useState<Record<string, Resolution>>({});
  const [justification, setJustification] = useState<JustifyResult | null>(null);
  const [justText, setJustText] = useState("");
  const [showReport, setShowReport] = useState(false);

  useEffect(() => {
    fetch("/api/status").then((r) => r.json()).then(setStatus).catch(() => setStatus(null));
  }, []);

  useEffect(() => {
    if (!reviewing) return;
    const t0 = Date.now();
    const id = setInterval(() => setElapsed(Math.round((Date.now() - t0) / 1000)), 500);
    return () => clearInterval(id);
  }, [reviewing]);

  function start(next: Loaded) {
    setData(next);
    setUploading(false);
    setSelected(new Set(next.ledger.filter((r) => !r.drawnIn).map((r) => r.id)));
    setReview(null);
    setReviewError(null);
    setResolutions({});
    setJustification(null);
    setJustText("");
    setShowReport(false);
  }

  function onUploaded(u: UploadResult) {
    start({ sourceLabel: "Your files", sample: false, ...u });
  }

  const reviewedRows = useMemo(() => new Set(review ? [...review.servRowIds, ...review.findings.flatMap((f) => f.rowIds)] : []), [review]);

  const blockedRows = useMemo(() => {
    const s = new Set<string>();
    review?.findings.filter((f) => f.severity === "error" && f.rowIds.length).forEach((f) => s.add(f.rowIds[0]));
    return s;
  }, [review]);

  const excluded = useMemo(() => {
    const s = new Set<string>(blockedRows);
    for (const [fid, r] of Object.entries(resolutions)) {
      if (r === "exclude") {
        const f = review?.findings.find((x) => x.id === fid);
        f?.rowIds.slice(0, f.code === "OVER_CATEGORY_BUDGET" ? 0 : 1).forEach((id) => s.add(id));
      }
    }
    return s;
  }, [blockedRows, resolutions, review]);

  const acceptedAdjustments: Adjustment[] = useMemo(
    () => (review?.proposedAdjustments ?? []).filter((a) => resolutions[`PARTIAL_UNALLOWABLE:${a.rowId}`] === "accept"),
    [review, resolutions],
  );

  const selectedRows = useMemo(() => (data ? data.ledger.filter((r) => selected.has(r.id)) : []), [data, selected]);
  const summary = useMemo(() => summarizeRequest(selectedRows, excluded, acceptedAdjustments), [selectedRows, excluded, acceptedAdjustments]);
  const requestedCents = sumCents(selectedRows.map((r) => r.amountCents));

  const openReview = (review?.findings ?? []).filter((f) => f.severity === "review" && !resolutions[f.id] && !f.rowIds.every((id) => excluded.has(id) && f.rowIds.length > 0));
  const errorCount = (review?.findings ?? []).filter((f) => f.severity === "error").length;

  async function runReview() {
    if (!data) return;
    setReviewing(true);
    setReviewError(null);
    setReview(null);
    setResolutions({});
    setJustification(null);
    setJustText("");
    try {
      const res = await fetch("/api/review", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          award: data.award, budgetCsv: data.budgetCsv, ledgerCsv: data.ledgerCsv, terms: data.terms,
          documents: data.documents, selectedRowIds: [...selected],
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? `Review failed (${res.status})`);
      setReview(json as ReviewResult);
      if ((json as ReviewResult).servError) setReviewError(`SERV did not complete: ${(json as ReviewResult).servError}. Code checks are shown; run the review again for SERV's assessment.`);
      requestAnimationFrame(() => document.getElementById("findings")?.scrollIntoView({ behavior: "smooth", block: "start" }));
    } catch (e) {
      setReviewError(e instanceof Error ? e.message : String(e));
    } finally {
      setReviewing(false);
    }
  }

  function resolve(f: Finding, r: Resolution | null) {
    setResolutions((prev) => {
      const next = { ...prev };
      if (r) next[f.id] = r;
      else delete next[f.id];
      return next;
    });
    setJustification(null);
  }

  if (showReport && data && review) {
    return (
      <ReportView
        data={data} review={review} summary={summary} requestedCents={requestedCents} excluded={excluded}
        resolutions={resolutions} adjustments={acceptedAdjustments} justification={justText} justificationMeta={justification}
        onClose={() => setShowReport(false)}
      />
    );
  }

  return (
    <div className="mx-auto max-w-7xl px-4 sm:px-6 py-8 sm:py-10">
      <div className="rise">
        <div className="eyebrow">Department of Education · G5 payment request</div>
        <h1 className="font-display text-3xl sm:text-4xl font-semibold mt-2 max-w-3xl leading-[1.1]">
          Prepare a drawdown you can defend, line by line.
        </h1>
        <p className="mt-3 max-w-2xl text-ink-soft">
          Pick the expenses for this request. Drawwell checks them against your budget, ledger history, receipts and 2 CFR 200,
          separates proven errors from judgment calls, and helps you write the 255-character justification G5 now requires.
        </p>
        {status && !status.servConfigured && (
          <p className="mt-4 text-sm text-seal">SERV is not configured on this server, so reviews will not run.</p>
        )}
      </div>

      <section className="mt-10">
        <SectionHeader step="Step 1" title="Choose the award">
          {data && !uploading && (
            <button className="btn btn-quiet text-sm" onClick={() => { setData(null); setUploading(false); }}>
              Change award
            </button>
          )}
        </SectionHeader>
        {!data && !uploading && (
          <div className="grid md:grid-cols-2 xl:grid-cols-4 gap-4">
            {SAMPLE_SOURCES.map((s, i) => (
              <button
                key={s.id}
                onClick={() => start(loadSample(s.id))}
                className="card text-left p-5 flex flex-col justify-start hover:-translate-y-0.5 hover:shadow-lg transition rise"
                style={{ animationDelay: `${i * 70}ms` }}
              >
                <div className="flex items-center justify-between">
                  <span className="font-mono text-xs text-ink-faint">{s.award.awardNumber}</span>
                  <Stamp tone="muted">Sample</Stamp>
                </div>
                <div className="font-display text-xl font-semibold mt-3 leading-snug">{s.label}</div>
                <p className="text-sm text-ink-soft mt-2">{s.summary}</p>
                <div className="mt-auto pt-4 text-xs text-ink-faint">{s.award.recipient}</div>
              </button>
            ))}
            <button onClick={() => setUploading(true)} className="card text-left p-5 flex flex-col justify-start border-dashed hover:bg-paper-deep/40 transition rise" style={{ animationDelay: "210ms" }}>
              <div className="flex items-center justify-between">
                <span className="font-mono text-xs text-ink-faint">CSV</span>
                <Stamp tone="muted">Your data</Stamp>
              </div>
              <div className="font-display text-xl font-semibold mt-3">Use your own files</div>
              <p className="text-sm text-ink-soft mt-2">Upload your approved budget and a ledger export. Receipts and award terms are optional.</p>
              <div className="mt-4 text-xs text-ink-faint">Checked in your browser first. Sent to SERV only when you run the review.</div>
            </button>
          </div>
        )}
        {uploading && <UploadPanel onLoaded={onUploaded} onCancel={() => setUploading(false)} />}
        {data && <AwardSummary data={data} />}
      </section>

      {data && (
        <div className="mt-12 grid lg:grid-cols-[minmax(0,1fr)_300px] gap-8 items-start">
          <div className="min-w-0 space-y-14">
            <section>
              <SectionHeader step="Step 2" title="Select the expenses for this request">
                <span className="text-sm text-ink-faint">{selected.size} of {data.ledger.filter((r) => !r.drawnIn).length} undrawn rows selected</span>
              </SectionHeader>
              <ExpenseTable
                data={data} selected={selected} onToggle={(id) => {
                  setSelected((prev) => {
                    const n = new Set(prev);
                    if (n.has(id)) n.delete(id);
                    else n.add(id);
                    return n;
                  });
                  setReview(null);
                  setJustification(null);
                }}
                review={review} excluded={excluded} reviewedRows={reviewedRows}
              />
              <div className="mt-5 flex flex-col sm:flex-row sm:items-center gap-3">
                <button className="btn btn-primary" disabled={reviewing || !selected.size || status?.servConfigured === false} onClick={runReview}>
                  {reviewing ? `Reviewing… ${elapsed}s` : review ? "Run the review again" : "Run the review"}
                </button>
                <span className="text-sm text-ink-faint">
                  Code checks run first, then one live SERV Reasoning call
                  {status ? ` (${status.model}${status.features.multipath ? ", Multipath" : ""}${status.features.shadowAgent ? ", Shadow Agent" : ""}${status.features.promptGuard ? ", Prompt Guard" : ""})` : ""}.
                </span>
              </div>
              {reviewing && <ReviewProgress elapsed={elapsed} />}
              {reviewError && <p className="mt-4 text-sm text-seal">{reviewError}</p>}
            </section>

            {review && (
              <section id="findings" className="scroll-mt-20">
                <FindingsPanel review={review} data={data} resolutions={resolutions} excluded={excluded} onResolve={resolve} />
              </section>
            )}

            {review && (
              <section>
                <JustificationPanel
                  data={data} summary={summary} review={review} openReviewCount={openReview.length}
                  result={justification} text={justText} onText={setJustText} onResult={(r) => { setJustification(r); setJustText(r.text); }}
                />
              </section>
            )}

            {review && (
              <section>
                <SectionHeader step="Step 5" title="Keep the evidence" />
                <div className="card p-5 flex flex-col md:flex-row md:items-center gap-4 justify-between">
                  <p className="text-sm text-ink-soft max-w-xl">
                    If ED emails asking for more explanation, answer from the evidence report: every dollar in the request traced to its ledger row,
                    document, rule and your decision, with the SERV calls that produced each assessment.
                  </p>
                  <button className="btn btn-primary shrink-0" onClick={() => { setShowReport(true); window.scrollTo(0, 0); }}>
                    Open evidence report
                  </button>
                </div>
              </section>
            )}
          </div>

          <aside className="lg:sticky lg:top-20 space-y-4">
            <div className="card p-5">
              <div className="eyebrow">This request</div>
              <dl className="mt-3 space-y-2 text-sm">
                <div className="flex justify-between"><dt className="text-ink-soft">Selected</dt><dd><Money cents={requestedCents} /></dd></div>
                <div className="flex justify-between"><dt className="text-ink-soft">Removed</dt><dd className="text-seal"><Money cents={requestedCents - summary.totalCents} /></dd></div>
                <div className="flex justify-between border-t border-rule pt-2 text-base"><dt className="font-semibold">Ready to draw</dt><dd><Money cents={summary.totalCents} strong /></dd></div>
              </dl>
              {summary.startIso && (
                <p className="mt-3 text-xs text-ink-faint">Expenses {formatShortDate(summary.startIso)} to {formatShortDate(summary.endIso)} · {data.award.paymentBasis}</p>
              )}
              {review && (
                <div className="mt-4 flex flex-wrap gap-2">
                  <Stamp tone={errorCount ? "error" : "ok"}>{errorCount} to fix</Stamp>
                  <Stamp tone={openReview.length ? "review" : "ok"}>{openReview.length} open</Stamp>
                  <Stamp tone="muted">{Object.keys(resolutions).length} decided</Stamp>
                </div>
              )}
            </div>
            {review?.calls.length ? (
              <div className="card p-5 text-xs text-ink-soft space-y-1.5">
                <div className="eyebrow mb-2">SERV calls</div>
                {[...review.calls, ...(justification?.calls ?? [])].map((c, i) => (
                  <div key={i} className="flex justify-between gap-2">
                    <span className="font-mono truncate" title={`${c.modelId}${c.features.promptGuard ? " + prompt guard" : ""}${c.features.shadowAgent ? " + shadow agent" : ""}`}>
                      {c.purpose}{c.outcome === "empty" ? " · empty, retried" : c.outcome === "error" ? " · failed, retried" : ""} · {c.modelId}{c.features.promptGuard ? " +guard" : ""}
                    </span>
                    <span className="tabular shrink-0">{(c.latencyMs / 1000).toFixed(1)}s</span>
                  </div>
                ))}
                {review.stats && (
                  <p className="pt-2 text-ink-faint">
                    {review.stats.citationsVerified} of {review.stats.citationsReturned} citations and {review.stats.documentQuotesVerified} of {review.stats.documentQuotesReturned} document quotes verified word for word.
                  </p>
                )}
              </div>
            ) : null}
          </aside>
        </div>
      )}
    </div>
  );
}

function AwardSummary({ data }: { data: Loaded }) {
  const a = data.award;
  const approved = sumCents(data.budget.map((b) => b.approvedCents));
  const items: [string, string][] = [
    ["Award", a.awardNumber],
    ["Program", `${a.programName} (${a.assistanceListing})`],
    ["Recipient", a.recipient],
    ["Budget period", `${formatShortDate(a.budgetPeriodStart)} – ${formatShortDate(a.budgetPeriodEnd)}`],
    ["Payment method", a.paymentBasis === "advance" ? `Advance · ${a.advanceWindowDays}-business-day window` : "Reimbursement of paid costs"],
    ["Equipment threshold", `$${Math.min(a.capitalizationThreshold, 10000).toLocaleString()}`],
    ["Request date", formatShortDate(a.requestDate)],
  ];
  return (
    <div className="card p-5 rise">
      <div className="flex flex-wrap items-center gap-3 justify-between">
        <div className="font-display text-xl font-semibold">{data.sourceLabel}</div>
        <div className="flex gap-2">
          {data.sample && <Stamp tone="muted">Synthetic records</Stamp>}
          <Stamp tone="muted">{data.documents.length} documents · {data.terms.length} award terms</Stamp>
        </div>
      </div>
      <dl className="mt-4 grid sm:grid-cols-2 lg:grid-cols-4 gap-x-6 gap-y-3">
        {items.map(([k, v]) => (
          <div key={k}>
            <dt className="eyebrow">{k}</dt>
            <dd className="text-sm mt-0.5">{v}</dd>
          </div>
        ))}
        <div>
          <dt className="eyebrow">Approved budget</dt>
          <dd className="text-sm mt-0.5"><Money cents={approved} cents2={false} /></dd>
        </div>
      </dl>
    </div>
  );
}

const STEPS = [
  "Code checks: duplicates, budget period, payment method, budget lines",
  "SERV Reasoning: budget category, allowability under 2 CFR 200, receipts against the ledger",
  "Shadow Agent: SERV validates its draft against the rules before answering",
  "Drawwell verifies every citation and document quote word for word",
];

function ReviewProgress({ elapsed }: { elapsed: number }) {
  return (
    <div className="mt-5 card p-5">
      <div className="h-1 bg-paper-deep rounded scanbar" />
      <div className="mt-4 text-sm font-semibold">Running · {elapsed}s</div>
      <ol className="mt-2 space-y-1.5 text-sm text-ink-soft">
        {STEPS.map((s, i) => (
          <li key={s}><span className="font-mono text-xs mr-2 text-ink-faint">{i + 1}</span>{s}</li>
        ))}
      </ol>
    </div>
  );
}
