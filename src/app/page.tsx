import Link from "next/link";
import { runChecks } from "@/engine/checks";
import { templateJustification } from "@/engine/justification";
import { summarizeRequest } from "@/engine/totals";
import { sampleInput } from "@/samples";
import { Stamp } from "@/components/parts";

function exampleJustification() {
  const input = sampleInput("upward-bound");
  const checks = runChecks(input);
  const blocked = new Set(checks.findings.filter((f) => f.severity === "error").map((f) => f.rowIds[0]));
  const s = summarizeRequest(checks.selected, blocked, []);
  return templateJustification({
    programName: input.award.programName, awardNumber: input.award.awardNumber, basis: input.award.paymentBasis,
    totals: s.totals, startIso: s.startIso, endIso: s.endIso, personalNames: [],
  });
}

const FACTS = [
  {
    k: "Nov 1, 2026",
    v: "Every Department of Education grant recipient must justify each G5 payment request: program name, expense categories and amounts, and expense dates, in 255 characters or fewer.",
    src: "K-12 Dive, reporting ED's Sept. 28 memo",
    href: "https://www.k12dive.com/news/education-department-wants-grantees-to-defend-the-spend-DOGE/831743/",
  },
  {
    k: "Flagged",
    v: "A justification ED questions comes back by email, and the payment waits until the request is updated.",
    src: "ED G5 walkthrough, Sept. 28, 2026",
    href: "https://www.ed.gov/media/document/g5-grantee-dashboard-submitting-payments-requests-and-payment-justifications-september-28-2026-114638.pdf",
  },
  {
    k: "Since 2025",
    v: "HHS has required the same with every drawdown. Head Start programs, which must spend drawn funds within three days, reported held-up payroll and rent.",
    src: "The American Prospect, May 2025",
    href: "https://prospect.org/2025/05/07/2025-05-07-congress-funded-head-start-trump-administration-holding-up-money/",
  },
];

export default function Home() {
  const example = exampleJustification();
  return (
    <div className="mx-auto max-w-7xl px-4 sm:px-6">
      <section className="pt-14 sm:pt-20 pb-12 grid lg:grid-cols-[1.1fr_0.9fr] gap-12 items-center">
        <div className="rise">
          <div className="eyebrow">For Department of Education grantees · G5 drawdowns</div>
          <h1 className="font-display text-[2.5rem] sm:text-[3.4rem] leading-[1.03] font-semibold mt-4">
            Every drawdown now needs a justification.
            <span className="block italic font-normal text-ink-soft mt-1">Make yours hold up.</span>
          </h1>
          <p className="mt-6 text-lg text-ink-soft max-w-xl">
            G5 gives you 255 characters to name the program, each expense category and amount, and the dates. Drawwell checks the request against your
            ledger, budget, receipts and 2 CFR 200 first, so the numbers you justify are ones you can defend.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Link href="/review" className="btn btn-primary text-base px-5 py-3">Review a sample drawdown</Link>
            <Link href="/how-it-works" className="btn btn-quiet text-base px-5 py-3">How it works</Link>
          </div>
          <p className="mt-4 text-sm text-ink-faint">No sign-up. Sample awards use fictional organizations and synthetic records.</p>
        </div>

        <div className="relative rise" style={{ animationDelay: "120ms" }}>
          <div className="card p-5 sm:p-6 rotate-[0.6deg]">
            <div className="flex items-center justify-between">
              <div className="eyebrow">G5 · Payment justification</div>
              <span className="font-mono text-xs tabular text-ink-soft">{example.length}/255</span>
            </div>
            <p className="comment-box mt-3 rounded border border-slate/30 px-3 text-[0.84rem]">{example}</p>
            <div className="mt-3 h-1.5 rounded bg-paper-deep overflow-hidden">
              <div className="h-full bg-ledger" style={{ width: `${(example.length / 255) * 100}%` }} />
            </div>
            <p className="mt-2 text-xs text-ink-faint">Built from the Upward Bound sample after code checks removed two rows.</p>
          </div>
          <div className="card p-4 mt-4 rotate-[-0.8deg] sm:ml-10 space-y-2.5 text-sm">
            <div className="flex items-center gap-2"><Stamp tone="error">Fix</Stamp> September tutoring invoice drawn a second time</div>
            <div className="flex items-center gap-2"><Stamp tone="error">Fix</Stamp> Receipt says $1,263.00, ledger says $1,236.00</div>
            <div className="flex items-center gap-2"><Stamp tone="review">Judgment</Stamp> $38 of wine on a family-night catering bill</div>
            <div className="flex items-center gap-2"><Stamp tone="review">Judgment</Stamp> $5,890 display panel coded as Supplies</div>
          </div>
        </div>
      </section>

      <section className="py-10 border-t border-rule">
        <div className="eyebrow">What changed</div>
        <div className="mt-5 grid md:grid-cols-3 gap-6">
          {FACTS.map((f) => (
            <div key={f.k}>
              <div className="font-display text-2xl font-semibold">{f.k}</div>
              <p className="mt-2 text-ink-soft">{f.v}</p>
              <a href={f.href} target="_blank" rel="noreferrer" className="mt-2 inline-block text-xs font-mono text-ink-faint underline underline-offset-2">{f.src}</a>
            </div>
          ))}
        </div>
      </section>

      <section className="py-12 border-t border-rule">
        <div className="eyebrow">What Drawwell does</div>
        <div className="mt-6 grid md:grid-cols-3 gap-5">
          <div className="card p-6">
            <Stamp tone="error">Code proves</Stamp>
            <h3 className="font-display text-xl font-semibold mt-4">Errors you can&apos;t argue with</h3>
            <p className="mt-2 text-sm text-ink-soft">
              Invoices drawn twice, costs outside the budget period, unpaid costs on reimbursement, advances drawn too early, receipts that don&apos;t match
              the ledger. Checked against your own records.
            </p>
          </div>
          <div className="card p-6">
            <Stamp tone="ok">SERV reasons</Stamp>
            <h3 className="font-display text-xl font-semibold mt-4">The rules, applied to each line</h3>
            <p className="mt-2 text-sm text-ink-soft">
              SERV Reasoning reads each expense, its receipt and your award terms against 2 CFR 200: budget category, allowability, the wine hidden in a
              catering bill. Drawwell keeps a citation only if the quoted rule text exists word for word.
            </p>
          </div>
          <div className="card p-6">
            <Stamp tone="review">You decide</Stamp>
            <h3 className="font-display text-xl font-semibold mt-4">Judgment stays yours</h3>
            <p className="mt-2 text-sm text-ink-soft">
              Costs that depend on exceptions, prior approval or your award are never marked unallowable automatically. You decide, and the evidence report
              records what you decided and why.
            </p>
          </div>
        </div>
      </section>

      <section className="py-10 border-t border-rule grid md:grid-cols-2 gap-8">
        <div>
          <div className="eyebrow">Who it&apos;s for</div>
          <p className="mt-3 font-display text-2xl leading-snug">
            The one-person finance office behind a TRIO program, a community school partnership or a charter network, drawing federal cash every two weeks.
          </p>
        </div>
        <div className="text-sm text-ink-soft space-y-3">
          <div className="eyebrow">Scope, honestly</div>
          <p>Department of Education G5 drawdowns, advance or reimbursement. Other agencies&apos; systems have different rules and limits.</p>
          <p>Drawwell does not submit anything to G5, and passing its checks is not approval. Allowability depends on your award terms; the Department decides.</p>
          <p>Your files are processed for the review and not stored. The public demo is for synthetic or de-identified records.</p>
        </div>
      </section>
    </div>
  );
}
