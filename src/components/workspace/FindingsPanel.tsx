"use client";

import { formatMoney } from "@/engine/money";
import type { ReviewResult } from "@/engine/review";
import type { Finding } from "@/engine/types";
import { CitationList, SectionHeader, SourceBadge, Stamp } from "../parts";
import type { Loaded } from "./Workspace";

export type Resolution = "exclude" | "keep" | "accept";

const ORDER = (f: Finding) => f.rowIds[0] ?? "~";

function FindingCard({
  f, data, resolution, onResolve, tone,
}: {
  f: Finding;
  data: Loaded;
  resolution?: Resolution;
  onResolve?: (f: Finding, r: Resolution | null) => void;
  tone: "error" | "review" | "info";
}) {
  const row = data.ledger.find((r) => r.id === f.rowIds[0]);
  const border = tone === "error" ? "border-l-seal" : tone === "review" ? "border-l-amber" : "border-l-slate";
  return (
    <article className={`card border-l-4 ${border} p-4 sm:p-5 ${resolution ? "opacity-70" : ""}`}>
      <div className="flex flex-wrap items-center gap-2">
        <h3 className="font-semibold text-[1.02rem] mr-1">{f.title}</h3>
        <SourceBadge finding={f} />
        {f.rowIds.map((id) => (
          <span key={id} className="font-mono text-xs text-ink-faint">{id}</span>
        ))}
        {f.amountCents ? <span className="ml-auto font-mono text-sm tabular">{formatMoney(f.amountCents, { forceCents: true })}</span> : null}
      </div>
      {row && <div className="text-sm text-ink-faint mt-0.5">{row.payee} · {row.description}</div>}
      <p className="text-sm mt-2 text-ink">{f.detail}</p>
      <CitationList citations={f.citations} />
      {tone === "error" && (
        <p className="mt-3 text-xs text-seal font-medium">Removed from this request. Correct the record and include it in a later draw.</p>
      )}
      {tone === "review" && onResolve && (
        <div className="mt-4 flex flex-wrap items-center gap-2">
          {resolution ? (
            <>
              <Stamp tone="ok" tilt>
                {resolution === "accept" ? "Amount removed" : resolution === "exclude" ? "Excluded from draw" : "Kept after review"}
              </Stamp>
              <button className="text-xs underline text-ink-faint ml-2" onClick={() => onResolve(f, null)}>Undo</button>
            </>
          ) : f.code === "PARTIAL_UNALLOWABLE" ? (
            <>
              <button className="btn btn-primary text-sm py-1.5" onClick={() => onResolve(f, "accept")}>Remove {formatMoney(f.amountCents ?? 0, { forceCents: true })}</button>
              <button className="btn btn-quiet text-sm py-1.5" onClick={() => onResolve(f, "keep")}>Keep full amount</button>
            </>
          ) : f.code === "OVER_CATEGORY_BUDGET" ? (
            <>
              <button className="btn btn-quiet text-sm py-1.5" onClick={() => onResolve(f, "keep")}>Our award allows this transfer</button>
              <span className="text-xs text-ink-faint">Or deselect rows in Step 2.</span>
            </>
          ) : (
            <>
              <button className="btn btn-quiet text-sm py-1.5" onClick={() => onResolve(f, "exclude")}>Exclude from this draw</button>
              <button className="btn btn-quiet text-sm py-1.5" onClick={() => onResolve(f, "keep")}>Keep, I&apos;ve checked it</button>
            </>
          )}
        </div>
      )}
    </article>
  );
}

export function FindingsPanel({
  review, data, resolutions, excluded, onResolve,
}: {
  review: ReviewResult;
  data: Loaded;
  resolutions: Record<string, Resolution>;
  excluded: Set<string>;
  onResolve: (f: Finding, r: Resolution | null) => void;
}) {
  const errors = review.findings.filter((f) => f.severity === "error").sort((a, b) => ORDER(a).localeCompare(ORDER(b)));
  const reviews = review.findings
    .filter((f) => f.severity === "review" && !(f.rowIds.length === 1 && excluded.has(f.rowIds[0]) && !resolutions[f.id]))
    .sort((a, b) => ORDER(a).localeCompare(ORDER(b)));
  const infos = review.findings.filter((f) => f.severity === "info");
  const flagged = new Set(review.findings.filter((f) => f.severity !== "info").flatMap((f) => f.rowIds));
  const clear = Object.values(review.assessments).filter((a) => a.allowability === "allowable" && !flagged.has(a.rowId));

  return (
    <div>
      <SectionHeader step="Step 3" title="What the review found">
        <div className="flex gap-2">
          <Stamp tone="error">{errors.length} proven</Stamp>
          <Stamp tone="review">{reviews.length} judgment</Stamp>
          <Stamp tone="ok">{clear.length} clear</Stamp>
        </div>
      </SectionHeader>

      <div className="space-y-8">
        <div>
          <h3 className="font-display text-lg font-semibold">Fix before submitting</h3>
          <p className="text-sm text-ink-soft mb-3">Proven by code against your own records, or found by SERV and confirmed by code in the document text.</p>
          {errors.length ? (
            <div className="space-y-3">{errors.map((f) => <FindingCard key={f.id} f={f} data={data} tone="error" />)}</div>
          ) : (
            <p className="text-sm text-ledger">Nothing to fix. No duplicates, out-of-period costs, payment-method problems or document mismatches.</p>
          )}
        </div>

        <div>
          <h3 className="font-display text-lg font-semibold">Needs your judgment</h3>
          <p className="text-sm text-ink-soft mb-3">
            These depend on your award terms, prior approvals or facts not in the records. Drawwell never calls these unallowable on its own; you decide.
          </p>
          {reviews.length ? (
            <div className="space-y-3">
              {reviews.map((f) => <FindingCard key={f.id} f={f} data={data} tone="review" resolution={resolutions[f.id]} onResolve={onResolve} />)}
            </div>
          ) : (
            <p className="text-sm text-ledger">No judgment calls.</p>
          )}
        </div>

        {clear.length > 0 && (
          <div>
            <h3 className="font-display text-lg font-semibold">Checked and clear</h3>
            <p className="text-sm text-ink-soft mb-3">SERV found these allowable and Drawwell verified the rule it cited.</p>
            <div className="card divide-y divide-rule">
              {clear.map((a) => {
                const row = data.ledger.find((r) => r.id === a.rowId)!;
                return (
                  <details key={a.rowId} className="group">
                    <summary className="px-4 py-3 flex flex-wrap items-center gap-3 cursor-pointer text-sm hover:bg-paper-deep/30">
                      <span className="font-mono text-xs text-ink-faint w-14">{a.rowId}</span>
                      <span className="flex-1 min-w-[200px]">{row.description}</span>
                      {a.documentVerified && <Stamp tone="ok">Receipt matches</Stamp>}
                      <span className="font-mono tabular">{formatMoney(row.amountCents, { forceCents: true })}</span>
                    </summary>
                    <div className="px-4 pb-4 pl-[4.5rem]">
                      <p className="text-sm">{a.reason}</p>
                      <CitationList citations={a.citations} />
                    </div>
                  </details>
                );
              })}
            </div>
          </div>
        )}

        {infos.length > 0 && (
          <ul className="text-xs text-ink-faint space-y-1">
            {infos.map((f) => <li key={f.id}>{f.title}{f.rowIds.length ? ` (${f.rowIds.join(", ")})` : ""}: {f.detail}</li>)}
          </ul>
        )}
      </div>
    </div>
  );
}
