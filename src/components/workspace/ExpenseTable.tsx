"use client";

import { Fragment, useState } from "react";
import { formatShortDate } from "@/engine/dates";
import { sumCents } from "@/engine/money";
import type { ReviewResult } from "@/engine/review";
import type { LedgerRow } from "@/engine/types";
import { CitationList, Money, Stamp } from "../parts";
import type { Loaded } from "./Workspace";

function rowStatus(row: LedgerRow, review: ReviewResult | null, excluded: Set<string>, reviewed: Set<string>) {
  if (!review || !reviewed.has(row.id)) return null;
  const mine = review.findings.filter((f) => f.rowIds[0] === row.id || (f.code !== "OVER_CATEGORY_BUDGET" && f.rowIds.includes(row.id)));
  if (mine.some((f) => f.severity === "error")) return <Stamp tone="error">Fix</Stamp>;
  if (excluded.has(row.id)) return <Stamp tone="muted">Excluded</Stamp>;
  const a = review.assessments[row.id];
  if (mine.some((f) => f.severity === "review") || (a && a.allowability !== "allowable")) return <Stamp tone="review">Review</Stamp>;
  if (a) return <Stamp tone="ok">Clear</Stamp>;
  return <Stamp tone="muted">Checked</Stamp>;
}

export function ExpenseTable({
  data, selected, onToggle, review, excluded, reviewedRows,
}: {
  data: Loaded;
  selected: Set<string>;
  onToggle: (id: string) => void;
  review: ReviewResult | null;
  excluded: Set<string>;
  reviewedRows: Set<string>;
}) {
  const [open, setOpen] = useState<string | null>(null);
  const undrawn = data.ledger.filter((r) => !r.drawnIn);
  const drawn = data.ledger.filter((r) => r.drawnIn);

  return (
    <div className="card overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left border-b border-rule-strong bg-paper-deep/50">
              <th className="w-10 px-3 py-2.5"><span className="sr-only">Include</span></th>
              <th className="px-3 py-2.5 eyebrow font-normal">Row</th>
              <th className="px-3 py-2.5 eyebrow font-normal">Incurred</th>
              <th className="px-3 py-2.5 eyebrow font-normal">Payee · description</th>
              <th className="px-3 py-2.5 eyebrow font-normal">Category</th>
              <th className="px-3 py-2.5 eyebrow font-normal text-right">Amount</th>
              <th className="px-3 py-2.5 eyebrow font-normal">Status</th>
            </tr>
          </thead>
          <tbody>
            {undrawn.map((r) => {
              const doc = data.documents.find((d) => d.id === r.documentId);
              const a = review?.assessments[r.id];
              const isOpen = open === r.id;
              return (
                <Fragment key={r.id}>
                  <tr className={`border-b border-rule/70 ${selected.has(r.id) ? "" : "opacity-50"} ${isOpen ? "bg-paper-deep/40" : "hover:bg-paper-deep/25"}`}>
                    <td className="px-3 py-2.5">
                      <input type="checkbox" className="accent-[var(--color-ink)] size-4" checked={selected.has(r.id)} onChange={() => onToggle(r.id)} aria-label={`Include ${r.id}`} />
                    </td>
                    <td className="px-3 py-2.5 font-mono text-xs whitespace-nowrap">
                      <button className="underline decoration-rule-strong underline-offset-2" onClick={() => setOpen(isOpen ? null : r.id)}>{r.id}</button>
                    </td>
                    <td className="px-3 py-2.5 tabular whitespace-nowrap text-ink-soft">{formatShortDate(r.incurredDate)}</td>
                    <td className="px-3 py-2.5 min-w-[260px]">
                      <div className="font-medium">{r.payee}</div>
                      <div className="text-ink-soft text-[0.82rem]">{r.description}</div>
                    </td>
                    <td className="px-3 py-2.5 whitespace-nowrap">
                      {r.category}
                      {a?.suggestedCategory && a.suggestedCategory !== r.category && (
                        <div className="text-[0.72rem] text-amber">SERV: {a.suggestedCategory}?</div>
                      )}
                    </td>
                    <td className="px-3 py-2.5 text-right whitespace-nowrap"><Money cents={r.amountCents} /></td>
                    <td className="px-3 py-2.5">{rowStatus(r, review, excluded, reviewedRows)}</td>
                  </tr>
                  {isOpen && (
                    <tr className="border-b border-rule bg-paper-deep/30">
                      <td />
                      <td colSpan={6} className="px-3 py-4">
                        <div className="grid md:grid-cols-2 gap-5">
                          <div>
                            <div className="eyebrow mb-1.5">
                              {r.status === "paid" ? `Paid ${formatShortDate(r.paymentDate)}` : `Scheduled ${formatShortDate(r.paymentDate)}`} · {r.account} · {r.documentId || "no document"}
                            </div>
                            {doc ? (
                              <pre className="font-mono text-[0.74rem] leading-relaxed whitespace-pre-wrap bg-card border border-rule rounded p-3 max-h-72 overflow-auto">{doc.text}</pre>
                            ) : (
                              <p className="text-sm text-ink-faint">No supporting document supplied.</p>
                            )}
                          </div>
                          <div>
                            <div className="eyebrow mb-1.5">SERV assessment</div>
                            {a ? (
                              <>
                                <div className="flex gap-2 items-center">
                                  <Stamp tone={a.allowability === "allowable" ? "ok" : "review"}>{a.allowability.replace("_", " ")}</Stamp>
                                  {a.documentVerified && <Stamp tone="ok">Receipt total verified</Stamp>}
                                  {a.injectionDetected && <Stamp tone="error">Hidden instructions</Stamp>}
                                </div>
                                <p className="text-sm mt-2">{a.reason}</p>
                                <CitationList citations={a.citations} />
                              </>
                            ) : (
                              <p className="text-sm text-ink-faint">{review ? "Not sent to SERV (blocked by a code check or not selected)." : "Run the review to see SERV's assessment."}</p>
                            )}
                          </div>
                        </div>
                      </td>
                    </tr>
                  )}
                </Fragment>
              );
            })}
          </tbody>
        </table>
      </div>
      {drawn.length > 0 && (
        <details className="border-t border-rule">
          <summary className="px-4 py-3 text-sm text-ink-soft cursor-pointer select-none hover:bg-paper-deep/30">
            Already drawn this budget period: {drawn.length} rows · <Money cents={sumCents(drawn.map((r) => r.amountCents))} />
          </summary>
          <div className="overflow-x-auto">
            <table className="w-full text-[0.8rem] text-ink-soft">
              <tbody>
                {drawn.map((r) => (
                  <tr key={r.id} className="border-t border-rule/60">
                    <td className="px-4 py-1.5 font-mono">{r.id}</td>
                    <td className="px-3 py-1.5 tabular">{formatShortDate(r.incurredDate)}</td>
                    <td className="px-3 py-1.5">{r.payee} · {r.description}</td>
                    <td className="px-3 py-1.5">{r.category}</td>
                    <td className="px-3 py-1.5 text-right"><Money cents={r.amountCents} /></td>
                    <td className="px-3 py-1.5 font-mono">{r.drawnIn}</td>
                    <td className="px-3 py-1.5 font-mono">{r.documentId}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </details>
      )}
    </div>
  );
}
