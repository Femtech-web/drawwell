import type { Metadata } from "next";
import { CFR_SECTIONS, CFR_SNAPSHOT_DATE, cfrUrl } from "@/rules/cfr";
import { ED_G5_GUIDANCE } from "@/rules/guidance";

export const metadata: Metadata = { title: "Sources · Drawwell" };

const NEED = [
  { t: "Education Department wants grantees to 'defend the spend'", p: "K-12 Dive, Oct. 1, 2026", u: "https://www.k12dive.com/news/education-department-wants-grantees-to-defend-the-spend-DOGE/831743/" },
  { t: "New Defend the Spend requirements could create delays and administrative burden for districts", p: "AASA via AESA, Oct. 6, 2026", u: "https://www.aesa.us/2026/10/06/new-defend-the-spend-requirements-could-create-delays-and-administrative-burden-for-districts/" },
  { t: "HHS Payment Management System justification field (TEGL 06-25)", p: "U.S. Department of Labor, 2025", u: "https://www.dol.gov/sites/dolgov/files/ETA/advisories/TEGL/2025/TEGL%2006-25/TEGL%2006-25.pdf" },
  { t: "Congress funded Head Start. The administration is holding up the money.", p: "The American Prospect, May 7, 2025", u: "https://prospect.org/2025/05/07/2025-05-07-congress-funded-head-start-trump-administration-holding-up-money/" },
  { t: "Defend the Spend: burden estimate infographic", p: "Council on Governmental Relations", u: "https://www.cogr.edu/sites/default/files/FINAL%20Infographic%20and%20Appendix.pdf" },
];

export default function SourcesPage() {
  return (
    <div className="mx-auto max-w-5xl px-4 sm:px-6 py-10">
      <div className="eyebrow">Check it yourself</div>
      <h1 className="font-display text-4xl font-semibold mt-2">Sources</h1>
      <p className="mt-3 text-ink-soft max-w-3xl">
        Everything Drawwell checks against, and the public record behind the problem. Rule text is a dated snapshot pulled from the eCFR API by
        <span className="font-mono text-xs"> scripts/rules/fetch-ecfr.ts</span>; SERV&apos;s citations are kept only when the quote appears word for word in it.
      </p>

      <section className="mt-10">
        <h2 className="font-display text-2xl font-semibold">Payment justification requirements</h2>
        <div className="mt-4 space-y-4">
          {ED_G5_GUIDANCE.map((g) => (
            <div key={g.id} className="card p-5">
              <a href={g.url} target="_blank" rel="noreferrer" className="font-semibold underline decoration-rule-strong underline-offset-2">{g.title}</a>
              <div className="text-xs text-ink-faint mt-1">{g.publisher} · {g.date}</div>
              <p className="text-xs text-ink-soft mt-2">{g.provenance}</p>
              <ul className="mt-3 space-y-1.5 text-sm">
                {g.points.map((p) => (
                  <li key={p.text}>{p.verbatim ? <span className="font-display italic">“{p.text}”</span> : p.text}</li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </section>

      <section className="mt-10">
        <h2 className="font-display text-2xl font-semibold">2 CFR Part 200 snapshot</h2>
        <p className="text-sm text-ink-soft mt-1">eCFR, current as of {CFR_SNAPSHOT_DATE}. {CFR_SECTIONS.length} sections.</p>
        <div className="card mt-4 divide-y divide-rule">
          {CFR_SECTIONS.map((s) => (
            <a key={s.section} href={cfrUrl(s.section)} target="_blank" rel="noreferrer" className="flex gap-4 px-4 py-2.5 text-sm hover:bg-paper-deep/30">
              <span className="font-mono text-xs w-16 shrink-0 pt-0.5">{s.section}</span>
              <span>{s.heading.replace(/^§\s*[\d.]+\s*/, "")}</span>
            </a>
          ))}
        </div>
      </section>

      <section className="mt-10">
        <h2 className="font-display text-2xl font-semibold">Why this matters</h2>
        <ul className="mt-4 space-y-3">
          {NEED.map((n) => (
            <li key={n.u}>
              <a href={n.u} target="_blank" rel="noreferrer" className="underline decoration-rule-strong underline-offset-2">{n.t}</a>
              <div className="text-xs text-ink-faint">{n.p}</div>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
