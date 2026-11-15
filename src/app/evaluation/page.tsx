import type { Metadata } from "next";
import { Stamp } from "@/components/parts";
import { ALL_RUN_FILES, BENCHMARK_RUNS } from "@/results/data.generated";

export const metadata: Metadata = { title: "Evaluation · Drawwell" };

const CONFIG_LABEL: Record<string, { name: string; what: string }> = {
  "code-only": { name: "Code rules only", what: "Drawwell's code checks plus a generic red-flag keyword list. No model." },
  "single-call": { name: "One plain SERV call", what: "One SERV call with a minimal prompt and the documents. No rule text, no award terms, no verification." },
  "drawwell-plain": { name: "Drawwell, SERV features off", what: "Full Drawwell prompt, rule excerpts, award terms and code verification, on the base model without Multipath, Shadow Agent or Prompt Guard." },
  drawwell: { name: "Drawwell", what: "The shipped pipeline: rule excerpts, award terms, Multipath, Shadow Agent, Prompt Guard, strict schema, code verification." },
};
const ORDER = ["code-only", "single-call", "drawwell-plain", "drawwell"];

type Run = (typeof BENCHMARK_RUNS)[number];
type RowResult = { id: string; expected: string; got: string | null; acceptable: boolean; unsafeMiss: boolean; overCall: boolean };
const frac = (a: number, b: number) => (b ? `${a}/${b}` : "—");

export default function EvaluationPage() {
  const runs: Run[] = [...BENCHMARK_RUNS].sort((a, b) => ORDER.indexOf(a.config) - ORDER.indexOf(b.config));
  const metrics: { label: string; hint: string; get: (r: Run) => string }[] = [
    { label: "Defensible answer", hint: "Allowability within the labeled acceptable set", get: (r) => frac(r.summary.acceptable, r.summary.rows) },
    { label: "Best answer", hint: "Matches the labeled best answer", get: (r) => frac(r.summary.exact, r.summary.rows) },
    { label: "Unanswered rows", hint: "No assessment returned, after retries. Lower is better.", get: (r) => String(r.summary.unanswered) },
    { label: "Unsafe misses", hint: "Called allowable when it should not be. Lower is better.", get: (r) => String(r.summary.unsafeMisses) },
    { label: "Over-calls", hint: "Called likely unallowable when a careful reviewer would not. Lower is better.", get: (r) => String(r.summary.overCalls) },
    { label: "Held-out request", hint: "Defensible answers on the request never used while writing prompts", get: (r) => frac(r.summary.bySplit["held-out"].acceptable, r.summary.bySplit["held-out"].rows) },
    { label: "Budget category", hint: "Best ED 524 category", get: (r) => frac(r.summary.categoryCorrect, r.summary.categoryLabeled) },
    { label: "Receipt mismatches found", hint: "Ledger amount differs from the document", get: (r) => frac(r.summary.mismatchFound, r.summary.mismatchExpected) },
    { label: "False mismatches", hint: "Flagged a mismatch that is not there. Lower is better.", get: (r) => String(r.summary.mismatchFalse) },
    { label: "Unallowable lines isolated", hint: "Exact cents of the alcohol line inside a larger receipt", get: (r) => frac(r.summary.partialExact, r.summary.partialExpected) },
    { label: "False partial removals", hint: "Proposed removing part of a charge that is fine. Lower is better.", get: (r) => String(r.summary.partialFalse) },
    { label: "Planted instructions flagged", hint: "By code or SERV", get: (r) => frac(r.summary.injectionFlagged, r.summary.injectionExpected) },
    {
      label: "Citations kept", hint: "Quotes found word for word in the cited rule or term",
      get: (r) => (r.summary.citationsVerified === null ? (r.summary.citationsReturned ? `${r.summary.citationsReturned} unchecked` : "—") : frac(r.summary.citationsVerified, r.summary.citationsReturned)),
    },
    { label: "Code findings", hint: "Duplicates, periods, payment method, budget lines", get: (r) => (r.summary.codeMissed || r.summary.codeExtra ? `${r.summary.codeMissed} missed, ${r.summary.codeExtra} extra` : "all matched") },
    { label: "Time, 4 requests", hint: "Wall clock, run one after another", get: (r) => `${(r.summary.latencyMs / 1000).toFixed(0)}s` },
    { label: "Estimated cost", hint: "Token counts × SERV's published prices", get: (r) => `$${(r.summary.estimatedCostUsd ?? 0).toFixed(3)}` },
  ];
  const failures = runs.flatMap((r) =>
    r.results.flatMap((q: { request: string; rows: RowResult[] }) =>
      q.rows.filter((x) => !x.acceptable).map((x) => ({ config: r.config as string, request: q.request, ...x })),
    ),
  );

  return (
    <div className="mx-auto max-w-7xl px-4 sm:px-6 py-10">
      <div className="eyebrow">Frozen benchmark · graded in code</div>
      <h1 className="font-display text-4xl font-semibold mt-2">Evaluation</h1>
      <p className="mt-3 max-w-3xl text-ink-soft">
        Four synthetic drawdown requests, 37 labeled expense rows: duplicates, budget overruns, out-of-period costs, receipts that disagree with the
        ledger, alcohol inside catering and hotel bills, costs that depend on award terms, an invented citation and planted instructions. Labels were
        written from the 2 CFR 200 snapshot and the award terms before any SERV run. The Charter Schools Program request was held out of prompt
        development. Every run is listed, failures included.
      </p>

      {runs.length === 0 ? (
        <p className="mt-8 text-ink-faint">No runs recorded yet.</p>
      ) : (
        <div className="card mt-8 overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-rule-strong bg-paper-deep/50 text-left align-bottom">
                <th className="px-4 py-3 eyebrow font-normal w-64">Metric</th>
                {runs.map((r) => (
                  <th key={`${r.config}${r.model}`} className="px-4 py-3 min-w-40">
                    <div className="font-display text-base font-semibold">{CONFIG_LABEL[r.config]?.name ?? r.config}</div>
                    <div className="font-mono text-[0.7rem] text-ink-faint font-normal">{r.config === "code-only" ? "no model" : r.model}</div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {metrics.map((m) => (
                <tr key={m.label} className="border-b border-rule/70">
                  <td className="px-4 py-2.5">
                    <div className="font-medium">{m.label}</div>
                    <div className="text-xs text-ink-faint">{m.hint}</div>
                  </td>
                  {runs.map((r) => (
                    <td key={`${r.config}${r.model}`} className="px-4 py-2.5 font-mono tabular">{m.get(r)}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <div className="mt-6 grid md:grid-cols-2 xl:grid-cols-4 gap-4">
        {ORDER.filter((c) => runs.some((r) => r.config === c)).map((c) => (
          <div key={c} className="card p-4 text-sm">
            <div className="font-semibold">{CONFIG_LABEL[c].name}</div>
            <p className="text-ink-soft mt-1">{CONFIG_LABEL[c].what}</p>
          </div>
        ))}
      </div>

      <section className="mt-12">
        <h2 className="font-display text-2xl font-semibold">Every row that missed</h2>
        <p className="text-sm text-ink-soft mt-1">Rows whose allowability fell outside the labeled acceptable set.</p>
        <div className="card mt-4 overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-rule-strong text-left bg-paper-deep/50">
                {["Configuration", "Request", "Row", "Expected", "Got", "Kind"].map((h) => (
                  <th key={h} className="px-4 py-2 eyebrow font-normal">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {failures.map((f, i) => (
                <tr key={i} className="border-b border-rule/60">
                  <td className="px-4 py-2">{CONFIG_LABEL[f.config]?.name ?? f.config}</td>
                  <td className="px-4 py-2 font-mono text-xs">{f.request}</td>
                  <td className="px-4 py-2 font-mono text-xs">{f.id}</td>
                  <td className="px-4 py-2">{f.expected.replace("_", " ")}</td>
                  <td className="px-4 py-2">{f.got?.replace("_", " ") ?? "no answer"}</td>
                  <td className="px-4 py-2">
                    {f.unsafeMiss ? <Stamp tone="error">Unsafe miss</Stamp> : f.overCall ? <Stamp tone="review">Over-call</Stamp> : <Stamp tone="muted">Other</Stamp>}
                  </td>
                </tr>
              ))}
              {failures.length === 0 && (
                <tr><td colSpan={6} className="px-4 py-3 text-ink-faint">No misses recorded.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      <section className="mt-12 grid md:grid-cols-2 gap-8 text-sm text-ink-soft">
        <div>
          <h2 className="font-display text-2xl font-semibold text-ink">Read this with care</h2>
          <ul className="mt-3 space-y-2 list-disc pl-5">
            <li>37 rows is small. It shows how the pipeline behaves on known traps, not how it performs on real ledgers.</li>
            <li>The builder wrote the labels. Rows where careful reviewers could differ accept more than one answer, so &quot;defensible&quot; is lenient; unsafe misses and over-calls are the stricter signals.</li>
            <li>Three of the four requests are the demo samples and were seen while writing prompts. Compare the held-out row.</li>
            <li>The keyword baseline was written after the demo rows existed, so it is optimistic on them.</li>
            <li>Every configuration that uses a model routes through SERV; none runs without SERV&apos;s base reasoning step.</li>
          </ul>
        </div>
        <div>
          <h2 className="font-display text-2xl font-semibold text-ink">Reproduce it</h2>
          <pre className="mt-3 font-mono text-xs bg-card border border-rule rounded p-3 overflow-x-auto">{`pnpm bench code-only
pnpm bench single-call gpt-5.4-mini
pnpm bench drawwell-plain gpt-5.4-mini
pnpm bench drawwell gpt-5.4-mini`}</pre>
          <p className="mt-3">Labels: <span className="font-mono text-xs">fixtures/benchmark/labels.json</span>. Raw runs:</p>
          <ul className="mt-1 font-mono text-[0.7rem] text-ink-faint space-y-0.5 break-all">
            {ALL_RUN_FILES.map((f) => <li key={f}>{f}</li>)}
          </ul>
        </div>
      </section>
    </div>
  );
}
