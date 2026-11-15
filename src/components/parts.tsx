import type { ReactNode } from "react";
import { formatMoney } from "@/engine/money";
import type { Citation, Finding } from "@/engine/types";

export function Money({ cents, strong, cents2 }: { cents: number; strong?: boolean; cents2?: boolean }) {
  return <span className={`tabular font-mono ${strong ? "font-semibold" : ""}`}>{formatMoney(cents, { forceCents: cents2 ?? true })}</span>;
}

const STAMP_TONE = {
  error: "text-seal",
  review: "text-amber",
  info: "text-slate",
  ok: "text-ledger",
  muted: "text-ink-faint",
} as const;

export function Stamp({ tone, children, tilt }: { tone: keyof typeof STAMP_TONE; children: ReactNode; tilt?: boolean }) {
  return <span className={`stamp ${STAMP_TONE[tone]} ${tilt ? "stamp-tilt" : ""}`}>{children}</span>;
}

export function SectionHeader({ step, title, children }: { step: string; title: string; children?: ReactNode }) {
  return (
    <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-2 mb-4">
      <div>
        <div className="eyebrow">{step}</div>
        <h2 className="font-display text-2xl sm:text-[1.7rem] font-semibold leading-tight mt-1">{title}</h2>
      </div>
      {children}
    </div>
  );
}

export function SourceBadge({ finding }: { finding: Finding }) {
  if (finding.source === "code") return <Stamp tone="muted">Code check</Stamp>;
  if (finding.verified) return <Stamp tone="ok">SERV · evidence verified</Stamp>;
  return <Stamp tone="muted">SERV judgment</Stamp>;
}

export function CitationList({ citations }: { citations: Citation[] }) {
  if (!citations.length) return null;
  return (
    <ul className="mt-3 space-y-2">
      {citations.map((c, i) => (
        <li key={i} className="border-l-2 border-rule-strong pl-3">
          <div className="text-[0.72rem] font-mono uppercase tracking-wide text-ink-faint">
            {c.url ? (
              <a className="underline decoration-rule-strong underline-offset-2 hover:text-ink" href={c.url} target="_blank" rel="noreferrer">
                {c.ref}
              </a>
            ) : (
              c.ref
            )}
            {c.kind === "document" && " · document"}
          </div>
          <blockquote className={`text-sm text-ink-soft ${c.kind === "document" ? "font-mono text-[0.8rem] whitespace-pre-wrap" : "font-display italic text-[0.98rem]"}`}>
            {c.kind === "document" ? c.quote : `“${c.quote}”`}
          </blockquote>
        </li>
      ))}
    </ul>
  );
}
