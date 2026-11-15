import type { Metadata } from "next";
import { Stamp } from "@/components/parts";
import { SMOKE_RUNS } from "@/results/data.generated";

export const metadata: Metadata = { title: "How it works · Drawwell" };

const STEPS = [
  { who: "You", tone: "muted" as const, t: "Choose the award and the expenses", d: "A sample award, or your approved budget and a ledger export as CSV, with receipts and award terms if you have them. Files are checked in the browser first, with line numbers for anything malformed." },
  { who: "Code", tone: "error" as const, t: "Prove what can be proven", d: "Invoices already drawn, the same invoice twice, costs outside the budget period, unpaid costs on a reimbursement award, advances drawn before the cash is needed, categories over the approved budget, items above the equipment threshold, text addressed to an AI. Rows with proven errors never reach the model." },
  { who: "SERV", tone: "ok" as const, t: "Apply the rules to each line", d: "One SERV Reasoning call reads every remaining row with its receipt, the award terms and the 2 CFR 200 text. For each row it decides whether the coded budget category fits, whether the cost is allowable or needs judgment, what the receipt actually totals, and whether part of the charge is unallowable." },
  { who: "Code", tone: "error" as const, t: "Verify SERV's evidence", d: "Every citation must appear word for word in the cited section or award term, or it is removed. A receipt total counts only if the quoted line is in the document and shows that amount. A conclusion that loses its citations falls back to review. The model can never create a blocking error by itself." },
  { who: "You", tone: "muted" as const, t: "Decide the judgment calls", d: "Exclude a row, remove the unallowable part of a charge, or keep it after checking. Drawwell does not mark ambiguous costs unallowable for you." },
  { who: "SERV + Code", tone: "ok" as const, t: "Write the 255-character justification", d: "SERV drafts it from the final, code-computed totals. Code checks length, program name, every category with its exact amount, the dates and personal information, and sends failures back to SERV up to three times. You can edit it; the checks rerun as you type." },
];

export default function HowItWorks() {
  const smoke = SMOKE_RUNS.flatMap((s) => s.results.map((r: { case: string; ok: boolean; latencyMs: number; parseOk: boolean | null; correct: boolean | null; modelId?: string; status?: number }) => ({ model: s.model, ...r })));
  return (
    <div className="mx-auto max-w-5xl px-4 sm:px-6 py-10">
      <div className="eyebrow">Pipeline</div>
      <h1 className="font-display text-4xl font-semibold mt-2">How it works</h1>
      <p className="mt-3 text-ink-soft max-w-3xl">
        Drawwell splits the work by what each part can be trusted with. Code handles arithmetic and your own records. SERV Reasoning handles the parts
        that need reading and judgment. You make the calls that depend on your award.
      </p>

      <ol className="mt-10 relative border-l-2 border-rule-strong ml-3 space-y-8">
        {STEPS.map((s, i) => (
          <li key={i} className="pl-8 relative">
            <span className="absolute -left-[13px] top-0.5 size-6 rounded-full bg-card border-2 border-rule-strong text-[0.7rem] font-mono flex items-center justify-center">{i + 1}</span>
            <div className="flex items-center gap-3"><Stamp tone={s.tone}>{s.who}</Stamp><h2 className="font-display text-xl font-semibold">{s.t}</h2></div>
            <p className="mt-2 text-ink-soft">{s.d}</p>
          </li>
        ))}
      </ol>

      <section className="mt-14">
        <h2 className="font-display text-2xl font-semibold">Why SERV Reasoning</h2>
        <div className="mt-4 grid md:grid-cols-2 gap-4 text-sm">
          <div className="card p-5">
            <div className="font-semibold">Multipath</div>
            <p className="text-ink-soft mt-1">The cost principles are a policy matrix: a cost is unallowable unless an exception applies, the award includes it, or prior approval exists. SERV&apos;s Multipath is built for system prompts with branches, exceptions and competing rules.</p>
          </div>
          <div className="card p-5">
            <div className="font-semibold">Shadow Agent</div>
            <p className="text-ink-soft mt-1">Before answering, SERV validates its draft against a testable hint: every row answered once, quotes copied word for word, no &quot;likely unallowable&quot; when the cited rule has an exception that could apply.</p>
          </div>
          <div className="card p-5">
            <div className="font-semibold">Prompt Guard</div>
            <p className="text-ink-soft mt-1">Receipts and ledger descriptions are written by other people. Drawwell declares them as data, Prompt Guard protects the instructions, and code flags text aimed at an AI independently.</p>
          </div>
          <div className="card p-5">
            <div className="font-semibold">Strict schema</div>
            <p className="text-ink-soft mt-1">Row IDs, budget categories and CFR sections are enums built from your request, so SERV can only answer about rows, categories and sections that exist.</p>
          </div>
        </div>
        {smoke.length > 0 && (
          <div className="card mt-6 overflow-x-auto">
            <div className="px-4 pt-4 eyebrow">Tested feature combinations (scripts/smoke/serv.ts)</div>
            <table className="w-full text-sm mt-2">
              <tbody>
                {smoke.map((r, i) => (
                  <tr key={i} className="border-t border-rule/70">
                    <td className="px-4 py-2 font-mono text-xs">{r.model}</td>
                    <td className="px-4 py-2">{r.case}</td>
                    <td className="px-4 py-2">{r.ok ? <Stamp tone="ok">Works</Stamp> : <Stamp tone="error">Failed {r.status ?? ""}</Stamp>}</td>
                    <td className="px-4 py-2 tabular font-mono text-xs">{(r.latencyMs / 1000).toFixed(1)}s</td>
                    <td className="px-4 py-2 text-xs text-ink-faint">{r.parseOk === null ? "" : r.parseOk ? "valid JSON" : "invalid JSON"}{r.correct === null ? "" : r.correct ? " · correct" : " · wrong answer"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="mt-14 grid md:grid-cols-2 gap-8 text-sm text-ink-soft">
        <div>
          <h2 className="font-display text-2xl font-semibold text-ink">Privacy and security</h2>
          <ul className="mt-3 space-y-2 list-disc pl-5">
            <li>No database. Records live in your browser and go to the server only for the review call.</li>
            <li>The server sends the selected rows, their documents and your award terms to SERV, then discards them. Logs record timings and counts, never content.</li>
            <li>The SERV API key stays on the server. Reviews are rate-limited per address with a daily cap.</li>
            <li>Sample awards are fictional organizations with synthetic records. Use synthetic or de-identified data in the public demo.</li>
          </ul>
        </div>
        <div>
          <h2 className="font-display text-2xl font-semibold text-ink">Scope</h2>
          <ul className="mt-3 space-y-2 list-disc pl-5">
            <li>Department of Education G5 drawdowns, advance or reimbursement. Other agencies&apos; systems have different limits.</li>
            <li>Rule text covers the 2 CFR 200 sections most drawdowns touch. Program statutes and EDGAR program rules are not loaded; supply them as award terms.</li>
            <li>Advance timing uses the window from your written cash procedures, which you set.</li>
            <li>Drawwell prepares a request. It doesn&apos;t submit to G5, and passing its checks is not approval.</li>
          </ul>
        </div>
      </section>
    </div>
  );
}
