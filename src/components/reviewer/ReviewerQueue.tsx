"use client";

import Papa from "papaparse";
import { useMemo, useState } from "react";
import { formatMoney, parseMoney } from "@/engine/money";
import { QUEUE_COLUMNS, reviewSubmission, type Submission } from "@/engine/reviewer";
import { SAMPLE_QUEUE } from "@/samples/queue";
import { Stamp } from "../parts";

function parseQueue(text: string): { rows: Submission[]; issues: string[] } {
  const parsed = Papa.parse<Record<string, string>>(text.trim(), {
    header: true, skipEmptyLines: "greedy", transformHeader: (h) => h.trim().toLowerCase().replace(/\s+/g, "_"),
  });
  const missing = QUEUE_COLUMNS.filter((c) => !(parsed.meta.fields ?? []).includes(c));
  if (missing.length) return { rows: [], issues: [`Missing column${missing.length > 1 ? "s" : ""}: ${missing.join(", ")}.`] };
  const rows: Submission[] = [];
  const issues: string[] = [];
  parsed.data.slice(0, 500).forEach((r, i) => {
    const cents = parseMoney(r.amount ?? "");
    if (cents === null) issues.push(`Line ${i + 2}: amount "${r.amount}" is not a dollar amount.`);
    else rows.push({ grantee: r.grantee ?? "", program: (r.program ?? "").trim(), awardNumber: (r.award_number ?? "").trim(), amountCents: cents, justification: r.justification ?? "" });
  });
  return { rows, issues };
}

function toCsv(results: ReturnType<typeof reviewSubmission>[]): string {
  return Papa.unparse(results.map((r) => ({
    grantee: r.submission.grantee, program: r.submission.program, award_number: r.submission.awardNumber,
    amount: (r.submission.amountCents / 100).toFixed(2), status: r.ready ? "ready" : "follow up",
    issues: r.checks.filter((c) => !c.pass).map((c) => `${c.label}: ${c.detail}`).join(" | "),
    justification: r.submission.justification,
  })));
}

export function ReviewerQueue() {
  const [queue, setQueue] = useState<Submission[]>(SAMPLE_QUEUE);
  const [issues, setIssues] = useState<string[]>([]);
  const [onlyFollowUp, setOnlyFollowUp] = useState(false);
  const [open, setOpen] = useState<number | null>(null);
  const results = useMemo(() => queue.map(reviewSubmission), [queue]);
  const followUp = results.filter((r) => !r.ready).length;
  const shown = results.map((r, i) => ({ r, i })).filter(({ r }) => !onlyFollowUp || !r.ready);

  async function load(file: File | undefined) {
    if (!file) return;
    if (file.size > 500_000) return setIssues(["The file is larger than 500 KB."]);
    const { rows, issues } = parseQueue(await file.text());
    setIssues(issues);
    if (rows.length) setQueue(rows);
  }

  function download() {
    const url = URL.createObjectURL(new Blob([toCsv(results)], { type: "text/csv" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = "drawwell-reviewer-results.csv";
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="mx-auto max-w-7xl px-4 sm:px-6 py-8 sm:py-10">
      <div className="rise">
        <div className="eyebrow">For state education agencies</div>
        <h1 className="font-display text-3xl sm:text-4xl font-semibold mt-2 max-w-3xl leading-[1.1]">
          Review every district&apos;s justification before it goes to ED.
        </h1>
        <p className="mt-3 max-w-3xl text-ink-soft">
          Federal education money reaches districts through the state, so the state sees each drawdown justification first. Load the queue as a
          CSV and Drawwell checks each one against ED&apos;s required elements: the program, every expense category with an amount, amounts that add
          up to the request, the start and end dates, 255 characters, and no personal information. It runs entirely in your browser; nothing is
          uploaded.
        </p>
      </div>

      <div className="mt-8 flex flex-col lg:flex-row lg:items-center gap-4 justify-between">
        <div className="flex flex-wrap gap-2">
          <Stamp tone="ok">{results.length - followUp} ready</Stamp>
          <Stamp tone={followUp ? "error" : "ok"}>{followUp} need follow-up</Stamp>
          <Stamp tone="muted">{formatMoney(results.reduce((s, r) => s + r.submission.amountCents, 0), { forceCents: true })} in the queue</Stamp>
        </div>
        <div className="flex flex-wrap items-center gap-3 text-sm">
          <label className="flex items-center gap-2 text-ink-soft">
            <input type="checkbox" className="accent-[var(--color-ink)] size-4" checked={onlyFollowUp} onChange={(e) => setOnlyFollowUp(e.target.checked)} />
            Only follow-ups
          </label>
          <label className="btn btn-quiet text-sm cursor-pointer">
            Load a queue (CSV)
            <input type="file" name="queue" accept=".csv,text/csv" className="sr-only" onChange={(e) => load(e.target.files?.[0])} />
          </label>
          <button className="btn btn-quiet text-sm" onClick={() => { setQueue(SAMPLE_QUEUE); setIssues([]); }}>Sample queue</button>
          <button className="btn btn-primary text-sm" onClick={download}>Download results</button>
        </div>
      </div>
      <p className="mt-2 text-xs text-ink-faint">
        Columns: {QUEUE_COLUMNS.join(", ")}. The sample queue uses fictional districts and synthetic submissions.
      </p>
      {issues.length > 0 && (
        <ul className="mt-4 border border-seal/30 bg-seal-wash/50 rounded p-3 text-sm space-y-1">
          {issues.slice(0, 8).map((m) => <li key={m}>{m}</li>)}
        </ul>
      )}

      <div className="card mt-5 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left border-b border-rule-strong bg-paper-deep/50">
                <th className="px-4 py-2.5 eyebrow font-normal">Grantee</th>
                <th className="px-4 py-2.5 eyebrow font-normal">Program</th>
                <th className="px-4 py-2.5 eyebrow font-normal text-right">Requested</th>
                <th className="px-4 py-2.5 eyebrow font-normal">Justification</th>
                <th className="px-4 py-2.5 eyebrow font-normal">Status</th>
              </tr>
            </thead>
            <tbody>
              {shown.map(({ r, i }) => {
                const failing = r.checks.filter((c) => !c.pass);
                return (
                  <tr key={i} className="border-b border-rule/70 align-top hover:bg-paper-deep/25 cursor-pointer" onClick={() => setOpen(open === i ? null : i)}>
                    <td className="px-4 py-3 min-w-44">
                      <div className="font-medium">{r.submission.grantee}</div>
                      <div className="font-mono text-xs text-ink-faint">{r.submission.awardNumber}</div>
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">{r.submission.program}</td>
                    <td className="px-4 py-3 text-right font-mono tabular whitespace-nowrap">{formatMoney(r.submission.amountCents, { forceCents: true })}</td>
                    <td className="px-4 py-3 min-w-[320px]">
                      <div className="font-mono text-[0.78rem] text-ink-soft">{r.submission.justification}</div>
                      {open === i && (
                        <ul className="mt-3 space-y-1.5">
                          {r.checks.map((c) => (
                            <li key={c.id} className="flex gap-2 text-xs">
                              <span className={`font-mono ${c.pass ? "text-ledger" : "text-seal"}`}>{c.pass ? "✓" : "✕"}</span>
                              <span className={c.pass ? "text-ink-soft" : "text-ink font-medium"}>{c.label}</span>
                              <span className="text-ink-faint">· {c.detail}</span>
                            </li>
                          ))}
                        </ul>
                      )}
                    </td>
                    <td className="px-4 py-3 min-w-48">
                      {r.ready ? <Stamp tone="ok">Ready</Stamp> : <Stamp tone="error">Follow up</Stamp>}
                      {failing.length > 0 && (
                        <ul className="mt-2 space-y-0.5 text-xs text-seal">
                          {failing.map((c) => <li key={c.id}>{c.label}</li>)}
                        </ul>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
      <p className="mt-4 text-xs text-ink-faint max-w-3xl">
        Click a row to see every check. These are the elements ED&apos;s Sept. 28, 2026 memo and G5 walkthrough require; a row marked ready has them all,
        which is not the same as approval. Category names must match ED Form 524 (&quot;Fringe Benefits&quot;, not &quot;Fringe&quot;).
      </p>
    </div>
  );
}
