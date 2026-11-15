"use client";

import { useState } from "react";
import { parseBudgetCsv, parseLedgerCsv, type CsvIssue } from "@/engine/csv";
import { isIsoDate } from "@/engine/dates";
import type { Award, AwardTerm, BudgetLine, LedgerRow, SupportingDocument } from "@/engine/types";

export interface UploadResult {
  award: Award;
  budgetCsv: string;
  ledgerCsv: string;
  budget: BudgetLine[];
  ledger: LedgerRow[];
  terms: AwardTerm[];
  documents: SupportingDocument[];
}

const today = () => new Date().toISOString().slice(0, 10);

function Field({ label, children, hint }: { label: string; children: React.ReactNode; hint?: string }) {
  return (
    <label className="block">
      <span className="eyebrow">{label}</span>
      <div className="mt-1">{children}</div>
      {hint && <span className="text-xs text-ink-faint">{hint}</span>}
    </label>
  );
}

const input = "w-full rounded border border-rule-strong bg-card px-2.5 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-slate/30";

export function UploadPanel({ onLoaded, onCancel }: { onLoaded: (u: UploadResult) => void; onCancel: () => void }) {
  const [award, setAward] = useState<Award>({
    awardNumber: "", programName: "", assistanceListing: "", recipient: "",
    budgetPeriodStart: "", budgetPeriodEnd: "", paymentBasis: "advance",
    advanceWindowDays: 3, capitalizationThreshold: 5000, requestDate: today(),
  });
  const [budgetCsv, setBudgetCsv] = useState("");
  const [ledgerCsv, setLedgerCsv] = useState("");
  const [docs, setDocs] = useState<SupportingDocument[]>([]);
  const [termsText, setTermsText] = useState("");
  const [issues, setIssues] = useState<(CsvIssue | { file: "award"; line: 0; message: string })[]>([]);
  const set = <K extends keyof Award>(k: K, v: Award[K]) => setAward((a) => ({ ...a, [k]: v }));

  async function readFile(f: File | undefined, cb: (s: string) => void) {
    if (!f) return;
    if (f.size > 200_000) {
      setIssues([{ file: "award", line: 0, message: `${f.name} is larger than 200 KB.` }]);
      return;
    }
    cb(await f.text());
  }

  async function readDocs(files: FileList | null) {
    if (!files) return;
    const out: SupportingDocument[] = [];
    for (const f of Array.from(files).slice(0, 60)) {
      if (f.size <= 20_000) out.push({ id: f.name.replace(/\.[^.]+$/, ""), text: (await f.text()).trimEnd() });
    }
    setDocs(out);
  }

  function check() {
    const problems: typeof issues = [];
    if (!award.awardNumber.trim()) problems.push({ file: "award", line: 0, message: "Enter the award number." });
    if (!award.programName.trim()) problems.push({ file: "award", line: 0, message: "Enter the program name exactly as it should appear in the justification." });
    for (const k of ["budgetPeriodStart", "budgetPeriodEnd", "requestDate"] as const) {
      if (!isIsoDate(award[k])) problems.push({ file: "award", line: 0, message: `${k === "requestDate" ? "Request date" : "Budget period dates"} must be valid dates.` });
    }
    const b = parseBudgetCsv(budgetCsv);
    const l = parseLedgerCsv(ledgerCsv);
    if (!budgetCsv) problems.push({ file: "award", line: 0, message: "Choose your budget CSV." });
    else problems.push(...b.issues);
    if (!ledgerCsv) problems.push({ file: "award", line: 0, message: "Choose your ledger CSV." });
    else problems.push(...l.issues);
    setIssues(problems);
    if (problems.length) return;
    const terms = termsText.split(/\n\s*\n/).map((t) => t.trim()).filter(Boolean).slice(0, 20).map((text, i) => ({
      id: `T-${i + 1}`, title: text.split(/[.:\n]/)[0].slice(0, 80), text: text.slice(0, 4000),
    }));
    onLoaded({ award: { ...award, assistanceListing: award.assistanceListing || "—", recipient: award.recipient || "—" }, budgetCsv, ledgerCsv, budget: b.rows, ledger: l.rows, terms, documents: docs });
  }

  return (
    <div className="card p-5 sm:p-6 rise">
      <div className="grid lg:grid-cols-2 gap-8">
        <div className="space-y-4">
          <div className="font-display text-xl font-semibold">Award details</div>
          <div className="grid sm:grid-cols-2 gap-4">
            <Field label="Award number"><input className={input} value={award.awardNumber} onChange={(e) => set("awardNumber", e.target.value)} placeholder="P047A260000" /></Field>
            <Field label="Program name"><input className={input} value={award.programName} onChange={(e) => set("programName", e.target.value)} placeholder="Upward Bound" /></Field>
            <Field label="Assistance listing"><input className={input} value={award.assistanceListing} onChange={(e) => set("assistanceListing", e.target.value)} placeholder="84.047A" /></Field>
            <Field label="Recipient"><input className={input} value={award.recipient} onChange={(e) => set("recipient", e.target.value)} /></Field>
            <Field label="Budget period start"><input type="date" name="budgetPeriodStart" className={input} value={award.budgetPeriodStart} onChange={(e) => set("budgetPeriodStart", e.target.value)} /></Field>
            <Field label="Budget period end"><input type="date" name="budgetPeriodEnd" className={input} value={award.budgetPeriodEnd} onChange={(e) => set("budgetPeriodEnd", e.target.value)} /></Field>
            <Field label="Payment method" hint="From your Grant Award Notification or G5.">
              <select className={input} value={award.paymentBasis} onChange={(e) => set("paymentBasis", e.target.value as Award["paymentBasis"])}>
                <option value="advance">Advance (immediate cash needs)</option>
                <option value="reimbursement">Reimbursement (costs already paid)</option>
              </select>
            </Field>
            <Field label="Request date"><input type="date" name="requestDate" className={input} value={award.requestDate} onChange={(e) => set("requestDate", e.target.value)} /></Field>
            {award.paymentBasis === "advance" && (
              <Field label="Disbursement window" hint="Business days, from your written cash procedures.">
                <input type="number" min={0} max={30} className={input} value={award.advanceWindowDays} onChange={(e) => set("advanceWindowDays", Number(e.target.value))} />
              </Field>
            )}
            <Field label="Capitalization level" hint="§200.1 uses the lesser of this and $10,000.">
              <input type="number" min={0} className={input} value={award.capitalizationThreshold} onChange={(e) => set("capitalizationThreshold", Number(e.target.value))} />
            </Field>
          </div>
        </div>
        <div className="space-y-4">
          <div className="font-display text-xl font-semibold">Records</div>
          <Field label="Approved budget (CSV)" hint="Columns: category, approved. Categories as on ED Form 524.">
            <input type="file" name="budget" accept=".csv,text/csv" className="text-sm" onChange={(e) => readFile(e.target.files?.[0], setBudgetCsv)} />
          </Field>
          <Field label="Ledger export (CSV)" hint="One row per expense; mark rows already drawn in drawn_in.">
            <input type="file" name="ledger" accept=".csv,text/csv" className="text-sm" onChange={(e) => readFile(e.target.files?.[0], setLedgerCsv)} />
          </Field>
          <Field label="Receipts and invoices (optional, .txt)" hint="File name must match the ledger's document column.">
            <input type="file" name="documents" accept=".txt,text/plain" multiple className="text-sm" onChange={(e) => readDocs(e.target.files)} />
          </Field>
          <Field label="Award terms (optional)" hint="Paste relevant terms; separate each with a blank line.">
            <textarea className={`${input} min-h-24`} value={termsText} onChange={(e) => setTermsText(e.target.value)} />
          </Field>
          <p className="text-xs text-ink-faint">
            Templates: <a className="underline" href="/templates/budget.csv" download>budget.csv</a> ·{" "}
            <a className="underline" href="/templates/ledger.csv" download>ledger.csv</a>. Use fictional or de-identified data in this public demo.
            Files are checked in your browser; they reach Drawwell&apos;s server and SERV only when you run the review, and Drawwell does not store them.
          </p>
        </div>
      </div>
      {issues.length > 0 && (
        <ul className="mt-6 border border-seal/30 bg-seal-wash/50 rounded p-4 text-sm space-y-1">
          {issues.slice(0, 12).map((i, n) => (
            <li key={n}><span className="font-mono text-xs text-seal mr-2">{i.file}{i.line ? `:${i.line}` : ""}</span>{i.message}</li>
          ))}
          {issues.length > 12 && <li className="text-xs text-ink-faint">and {issues.length - 12} more</li>}
        </ul>
      )}
      <div className="mt-6 flex gap-3">
        <button className="btn btn-primary" onClick={check}>Check files and continue</button>
        <button className="btn btn-quiet" onClick={onCancel}>Back to samples</button>
      </div>
    </div>
  );
}
