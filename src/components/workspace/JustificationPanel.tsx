"use client";

import { useMemo, useState } from "react";
import { formatShortDate } from "@/engine/dates";
import { justificationPasses, verifyJustification, type JustificationContext } from "@/engine/justification";
import type { JustifyResult, ReviewResult } from "@/engine/review";
import type { RequestSummary } from "@/engine/totals";
import { budgetPositions, personalNames, purposes } from "@/lib/request";
import { JUSTIFICATION_LIMIT } from "@/rules/guidance";
import { Money, SectionHeader, Stamp } from "../parts";
import type { Loaded } from "./Workspace";

export function JustificationPanel({
  data, summary, openReviewCount, result, text, onText, onResult,
}: {
  data: Loaded;
  summary: RequestSummary;
  review: ReviewResult;
  openReviewCount: number;
  result: JustifyResult | null;
  text: string;
  onText: (t: string) => void;
  onResult: (r: JustifyResult) => void;
}) {
  const [drafting, setDrafting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const positions = budgetPositions(data.award, data.budget, data.ledger, summary);
  const names = useMemo(() => personalNames(data.ledger), [data.ledger]);
  const ctx: JustificationContext | null = summary.totals.length
    ? {
        programName: data.award.programName, awardNumber: data.award.awardNumber, basis: data.award.paymentBasis,
        totals: summary.totals, startIso: summary.startIso, endIso: summary.endIso, personalNames: names,
      }
    : null;
  const checks = ctx && text ? verifyJustification(text, ctx) : [];
  const passes = checks.length > 0 && justificationPasses(checks);
  const stale = result && ctx && !justificationPasses(verifyJustification(result.text, ctx));

  async function draft() {
    if (!ctx) return;
    setDrafting(true);
    setError(null);
    try {
      const res = await fetch("/api/justify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ award: data.award, totals: ctx.totals, startIso: ctx.startIso, endIso: ctx.endIso, purposes: purposes(summary), personalNames: names }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? `Drafting failed (${res.status})`);
      onResult(json as JustifyResult);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setDrafting(false);
    }
  }

  const pct = Math.min(100, (text.length / JUSTIFICATION_LIMIT) * 100);

  return (
    <div>
      <SectionHeader step="Step 4" title="Write the G5 justification" />
      <div className="card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left border-b border-rule-strong bg-paper-deep/50">
                <th className="px-4 py-2.5 eyebrow font-normal">ED 524 category</th>
                <th className="px-4 py-2.5 eyebrow font-normal text-right">Approved</th>
                <th className="px-4 py-2.5 eyebrow font-normal text-right">Drawn to date</th>
                <th className="px-4 py-2.5 eyebrow font-normal text-right">This request</th>
                <th className="px-4 py-2.5 eyebrow font-normal text-right">Remaining</th>
              </tr>
            </thead>
            <tbody>
              {positions.map((p) => (
                <tr key={p.category} className={`border-b border-rule/70 ${p.requestCents ? "" : "text-ink-faint"}`}>
                  <td className="px-4 py-2">{p.category}</td>
                  <td className="px-4 py-2 text-right"><Money cents={p.approvedCents} /></td>
                  <td className="px-4 py-2 text-right"><Money cents={p.drawnCents} /></td>
                  <td className="px-4 py-2 text-right font-semibold">{p.requestCents ? <Money cents={p.requestCents} /> : "—"}</td>
                  <td className={`px-4 py-2 text-right ${p.remainingCents < 0 ? "text-seal font-semibold" : ""}`}><Money cents={p.remainingCents} /></td>
                </tr>
              ))}
              <tr className="bg-paper-deep/40">
                <td className="px-4 py-2.5 font-semibold">Request total</td>
                <td colSpan={2} className="px-4 py-2.5 text-xs text-ink-faint">
                  {summary.startIso ? `Expenses ${formatShortDate(summary.startIso)} – ${formatShortDate(summary.endIso)}` : ""}
                </td>
                <td className="px-4 py-2.5 text-right"><Money cents={summary.totalCents} strong /></td>
                <td />
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      <div className="mt-6 grid xl:grid-cols-[minmax(0,1fr)_320px] gap-6">
        <div className="card p-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <div className="eyebrow">G5 · Payment justification comment</div>
              <div className="text-sm text-ink-soft mt-1">{data.award.awardNumber} · {data.award.programName}</div>
            </div>
            <div className="flex gap-2">
              <button className="btn btn-primary text-sm" disabled={drafting || !ctx} onClick={draft}>
                {drafting ? "SERV is drafting…" : result ? "Redraft with SERV" : "Draft with SERV"}
              </button>
            </div>
          </div>
          {openReviewCount > 0 && (
            <p className="mt-3 text-xs text-amber">{openReviewCount} judgment item{openReviewCount > 1 ? "s are" : " is"} still open. Decide them first so the amounts are final.</p>
          )}
          <textarea
            className="comment-box mt-4 w-full min-h-[148px] rounded border border-slate/30 px-3 py-0 text-[0.86rem] text-ink focus:outline-none focus:ring-2 focus:ring-slate/40"
            value={text}
            onChange={(e) => { onText(e.target.value); setCopied(false); }}
            placeholder="Draft with SERV, or type the justification yourself. The checks on the right update as you type."
            maxLength={600}
          />
          <div className="mt-2 flex items-center gap-3">
            <div className="flex-1 h-1.5 rounded bg-paper-deep overflow-hidden">
              <div className={`h-full transition-all ${text.length > JUSTIFICATION_LIMIT ? "bg-seal" : "bg-ledger"}`} style={{ width: `${pct}%` }} />
            </div>
            <span className={`font-mono text-xs tabular ${text.length > JUSTIFICATION_LIMIT ? "text-seal" : "text-ink-soft"}`}>
              {text.length}/{JUSTIFICATION_LIMIT}
            </span>
          </div>
          <div className="mt-4 flex flex-wrap items-center gap-3">
            <button
              className="btn btn-quiet text-sm"
              disabled={!text}
              onClick={async () => { await navigator.clipboard.writeText(text); setCopied(true); }}
            >
              {copied ? "Copied" : "Copy for G5"}
            </button>
            {result && (
              <span className="text-xs text-ink-faint">
                {result.source === "serv"
                  ? `SERV draft, passed every check on attempt ${result.attempts} of 3.`
                  : `SERV's drafts did not pass the checks${result.servError ? ` (${result.servError})` : ""}; showing a plain version built from the verified numbers.`}
              </span>
            )}
            {stale && <span className="text-xs text-amber">Amounts changed since this draft. Redraft.</span>}
            {error && <span className="text-xs text-seal">{error}</span>}
          </div>
        </div>

        <div className="card p-5">
          <div className="eyebrow mb-3">Checks</div>
          {checks.length ? (
            <ul className="space-y-2.5">
              {checks.map((c) => (
                <li key={c.id} className="flex gap-2.5 text-sm">
                  <span className={`mt-0.5 font-mono text-xs ${c.pass ? "text-ledger" : c.required ? "text-seal" : "text-amber"}`}>{c.pass ? "✓" : c.required ? "✕" : "!"}</span>
                  <div>
                    <div className={c.pass ? "" : "font-medium"}>{c.label}</div>
                    <div className="text-xs text-ink-faint">{c.detail}</div>
                  </div>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-ink-faint">Checks appear when there is text in the comment box.</p>
          )}
          {passes && <div className="mt-4"><Stamp tone="ok" tilt>Ready to paste</Stamp></div>}
          <p className="mt-4 text-xs text-ink-faint">
            Requirements from ED&apos;s Sept. 28, 2026 memo and G5 walkthrough. Passing these checks doesn&apos;t guarantee approval; it means the required elements are present and the numbers match your records.
          </p>
        </div>
      </div>
    </div>
  );
}
