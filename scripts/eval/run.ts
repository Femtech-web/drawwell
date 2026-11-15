import { mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { runChecks } from "../../src/engine/checks";
import { parseBudgetCsv, parseLedgerCsv } from "../../src/engine/csv";
import { findInjection } from "../../src/engine/injection";
import { reviewFeatures, reviewRequest, type ReviewResult } from "../../src/engine/review";
import { servChat, type ServFeatures } from "../../src/serv/client";
import { reviewSchema, type ServReviewRow } from "../../src/serv/schema";
import type { ReviewInput } from "../../src/engine/types";

type Allow = "allowable" | "needs_review" | "likely_unallowable";
interface RowLabel { expected: Allow; acceptable: Allow[]; category?: string; mismatch?: boolean; partialCents?: number; injection?: boolean }
interface RequestLabel { id: string; split: string; code: string[]; rows: Record<string, RowLabel> }
interface RowPrediction { allowability: Allow | null; category: string | null; mismatch: boolean; partialCents: number | null; injection: boolean }
interface RunOutput { predictions: Record<string, RowPrediction>; codeFindings: string[]; latencyMs: number; promptTokens: number; completionTokens: number; citationsReturned: number; citationsVerified: number | null; error: string | null }

const PRICES: Record<string, [number, number]> = {
  "gpt-5.4-mini": [1.0, 6.0], "gpt-5.4": [3.25, 20], "gpt-5.4-nano": [0.25, 1.6], "gpt-6-luna": [0.13, 0.65],
  "gpt-6-sol": [2.6, 13], "claude-haiku-4.5": [1.25, 6.5], "claude-sonnet-5.5": [2.4, 12], "gemini-3.1-flash-lite": [0.3, 1.8],
};

async function loadRequest(id: string): Promise<ReviewInput> {
  const dir = ["fixtures/awards", "fixtures/benchmark"].map((d) => join(d, id));
  for (const d of dir) {
    try {
      const meta = JSON.parse(await readFile(join(d, "award.json"), "utf8"));
      const docs = (await readdir(join(d, "docs"))).filter((f) => f.endsWith(".txt"));
      const documents = await Promise.all(docs.map(async (f) => ({ id: f.replace(/\.txt$/, ""), text: (await readFile(join(d, "docs", f), "utf8")).trimEnd() })));
      const ledger = parseLedgerCsv(await readFile(join(d, "ledger.csv"), "utf8")).rows;
      return {
        award: meta.award, terms: meta.terms, documents, ledger,
        budget: parseBudgetCsv(await readFile(join(d, "budget.csv"), "utf8")).rows,
        selectedRowIds: ledger.filter((r) => !r.drawnIn).map((r) => r.id),
      };
    } catch {}
  }
  throw new Error(`request ${id} not found`);
}

function codeKeys(findings: { severity: string; code: string; rowIds: string[] }[]) {
  return findings.filter((f) => f.severity !== "info" && !["NEEDS_REVIEW", "LIKELY_UNALLOWABLE", "CATEGORY_MISMATCH", "PARTIAL_UNALLOWABLE", "DOCUMENT_MISMATCH", "NOT_ASSESSED"].includes(f.code))
    .map((f) => `${f.severity}:${f.code}:${f.rowIds[0] ?? ""}`).sort();
}

function fromReview(input: ReviewInput, r: ReviewResult, ms: number): RunOutput {
  const predictions: Record<string, RowPrediction> = {};
  for (const id of r.servRowIds) {
    const a = r.assessments[id];
    const row = input.ledger.find((x) => x.id === id)!;
    predictions[id] = {
      allowability: a?.allowability ?? null,
      category: a?.suggestedCategory ?? row.category,
      mismatch: r.findings.some((f) => f.code === "DOCUMENT_MISMATCH" && f.rowIds[0] === id),
      partialCents: r.proposedAdjustments.find((x) => x.rowId === id)?.removeCents ?? null,
      injection: !!a?.injectionDetected || r.findings.some((f) => f.code === "INSTRUCTION_IN_DATA" && f.rowIds[0] === id),
    };
  }
  return {
    predictions, codeFindings: codeKeys(r.findings), latencyMs: ms,
    promptTokens: r.calls.reduce((s, c) => s + (c.promptTokens ?? 0), 0), completionTokens: r.calls.reduce((s, c) => s + (c.completionTokens ?? 0), 0),
    citationsReturned: r.stats?.citationsReturned ?? 0, citationsVerified: r.stats?.citationsVerified ?? 0, error: r.servError,
  };
}

/** A generic red-flag list a careful bookkeeper might use. Written after the demo rows existed, so it is optimistic there. */
const KEYWORDS: [RegExp, Allow][] = [
  [/\b(wine|beer|liquor|cocktails?|alcohol|bar)\b/i, "likely_unallowable"],
  [/\bfundrais\w*/i, "likely_unallowable"],
  [/\blobby\w*/i, "needs_review"],
  [/\b(entertainment|party|celebration|appreciation|gift cards?|incentives?|personal)\b/i, "needs_review"],
  [/\b(business|first)[ -]class\b/i, "needs_review"],
];

function codeOnly(input: ReviewInput): RunOutput {
  const t0 = Date.now();
  const c = runChecks(input);
  const blocked = new Set(c.findings.filter((f) => f.severity === "error").map((f) => f.rowIds[0]));
  const predictions: Record<string, RowPrediction> = {};
  for (const row of c.selected.filter((r) => !blocked.has(r.id))) {
    const doc = input.documents.find((d) => d.id === row.documentId);
    const text = `${row.description} ${doc?.text ?? ""}`;
    const hit = KEYWORDS.find(([re]) => re.test(text));
    const total = doc?.text.match(/(?:TOTAL|BALANCE|AMOUNT DUE|Total charged|Batch total)[^\n$]*\$\s?([\d,]+\.\d{2})/i);
    const totalCents = total ? Math.round(Number(total[1].replace(/,/g, "")) * 100) : null;
    predictions[row.id] = {
      allowability: hit ? hit[1] : "allowable", category: row.category,
      mismatch: totalCents !== null && totalCents !== row.amountCents, partialCents: null,
      injection: !!findInjection(text),
    };
  }
  return { predictions, codeFindings: codeKeys(c.findings), latencyMs: Date.now() - t0, promptTokens: 0, completionTokens: 0, citationsReturned: 0, citationsVerified: null, error: null };
}

const SINGLE_SYSTEM = "You review grant expenses for a U.S. Department of Education grantee. For each row, decide the best ED 524 budget category and whether the cost is allowable under 2 CFR 200, and check the supporting document. Return the schema.";

async function singleCall(input: ReviewInput, model: string): Promise<RunOutput> {
  const c = runChecks(input);
  const blocked = new Set(c.findings.filter((f) => f.severity === "error").map((f) => f.rowIds[0]));
  const rows = c.selected.filter((r) => !blocked.has(r.id));
  const features: ServFeatures = { model, multipath: false, kronos: false, promptGuard: false, shadow: null };
  const user = JSON.stringify({ rows: rows.map((r) => ({ row_id: r.id, payee: r.payee, description: r.description, coded_category: r.category, amount: r.amountCents / 100, document: input.documents.find((d) => d.id === r.documentId)?.text ?? null })) });
  const t0 = Date.now();
  try {
    const res = await servChat({ system: SINGLE_SYSTEM, user, features, schema: reviewSchema(rows.map((r) => r.id), input.terms.map((t) => t.id)) });
    const raw = (JSON.parse(res.content) as { rows: ServReviewRow[] }).rows;
    const predictions: Record<string, RowPrediction> = {};
    for (const e of raw) {
      const row = rows.find((r) => r.id === e.row_id);
      if (!row) continue;
      predictions[e.row_id] = {
        allowability: e.allowability, category: e.coded_category_fits ? row.category : e.best_category,
        mismatch: e.document_total !== null && Math.round(e.document_total * 100) !== row.amountCents,
        partialCents: e.partial_amount !== null ? Math.round(e.partial_amount * 100) : null, injection: e.injection_detected,
      };
    }
    return { predictions, codeFindings: codeKeys(c.findings), latencyMs: Date.now() - t0, promptTokens: res.usage?.promptTokens ?? 0, completionTokens: res.usage?.completionTokens ?? 0, citationsReturned: raw.reduce((s, e) => s + e.citations.length, 0), citationsVerified: null, error: null };
  } catch (e) {
    return { predictions: {}, codeFindings: codeKeys(c.findings), latencyMs: Date.now() - t0, promptTokens: 0, completionTokens: 0, citationsReturned: 0, citationsVerified: null, error: String(e) };
  }
}

function score(label: RequestLabel, out: RunOutput) {
  const rows = Object.entries(label.rows).map(([id, l]) => {
    const p = out.predictions[id];
    const a = p?.allowability ?? null;
    return {
      id, expected: l.expected, got: a,
      acceptable: a !== null && l.acceptable.includes(a),
      exact: a === l.expected,
      unsafeMiss: a === "allowable" && !l.acceptable.includes("allowable"),
      overCall: a === "likely_unallowable" && !l.acceptable.includes("likely_unallowable"),
      category: l.category ? { expected: l.category, got: p?.category ?? null, ok: p?.category === l.category } : null,
      mismatch: l.mismatch !== undefined || p?.mismatch ? { expected: !!l.mismatch, got: !!p?.mismatch } : null,
      partial: l.partialCents !== undefined || p?.partialCents ? { expected: l.partialCents ?? null, got: p?.partialCents ?? null } : null,
      injection: l.injection ? { got: !!p?.injection, notAllowed: a !== "allowable" || l.acceptable.includes("allowable") } : null,
    };
  });
  const codeExpected = new Set(label.code);
  const codeGot = new Set(out.codeFindings);
  return {
    rows,
    code: { expected: label.code, got: out.codeFindings, missed: label.code.filter((c) => !codeGot.has(c)), extra: out.codeFindings.filter((c) => !codeExpected.has(c)) },
  };
}

async function main() {
  const config = process.argv[2] ?? "drawwell";
  const model = process.argv[3] ?? process.env.SERV_MODEL ?? "gpt-5.4-mini";
  const only = process.argv[4];
  const labels = JSON.parse(await readFile("fixtures/benchmark/labels.json", "utf8")) as { requests: RequestLabel[] };
  const results: (ReturnType<typeof score> & { request: string; split: string; latencyMs: number; promptTokens: number; completionTokens: number; citationsReturned: number; citationsVerified: number | null; error: string | null })[] = [];
  for (const label of labels.requests.filter((r) => !only || r.id === only)) {
    const input = await loadRequest(label.id);
    let out: RunOutput;
    const t0 = Date.now();
    if (config === "code-only") out = codeOnly(input);
    else if (config === "single-call") out = await singleCall(input, model);
    else {
      const base = reviewFeatures(model);
      const features = config === "drawwell-plain" ? { ...base, multipath: false, promptGuard: false, shadow: null } : base;
      out = fromReview(input, await reviewRequest(input, features), Date.now() - t0);
    }
    const s = score(label, out);
    results.push({ request: label.id, split: label.split, ...s, latencyMs: out.latencyMs, promptTokens: out.promptTokens, completionTokens: out.completionTokens, citationsReturned: out.citationsReturned, citationsVerified: out.citationsVerified, error: out.error });
    const ok = s.rows.filter((r) => r.acceptable).length;
    console.log(`${config} ${label.id.padEnd(18)} acceptable ${ok}/${s.rows.length}  unsafe ${s.rows.filter((r) => r.unsafeMiss).length}  over ${s.rows.filter((r) => r.overCall).length}  code missed ${s.code.missed.length} extra ${s.code.extra.length}  ${(out.latencyMs / 1000).toFixed(1)}s${out.error ? `  ERROR ${out.error.slice(0, 120)}` : ""}`);
  }
  const all = results.flatMap((r) => r.rows);
  const [pin, pout] = PRICES[model] ?? [0, 0];
  const promptTokens = results.reduce((s, r) => s + r.promptTokens, 0);
  const completionTokens = results.reduce((s, r) => s + r.completionTokens, 0);
  const summary = {
    rows: all.length,
    acceptable: all.filter((r) => r.acceptable).length,
    exact: all.filter((r) => r.exact).length,
    unanswered: all.filter((r) => r.got === null).length,
    unsafeMisses: all.filter((r) => r.unsafeMiss).length,
    overCalls: all.filter((r) => r.overCall).length,
    categoryCorrect: all.filter((r) => r.category?.ok).length,
    categoryLabeled: all.filter((r) => r.category).length,
    mismatchFound: all.filter((r) => r.mismatch?.expected && r.mismatch.got).length,
    mismatchExpected: all.filter((r) => r.mismatch?.expected).length,
    mismatchFalse: all.filter((r) => r.mismatch && !r.mismatch.expected && r.mismatch.got).length,
    partialExact: all.filter((r) => r.partial?.expected && r.partial.got === r.partial.expected).length,
    partialExpected: all.filter((r) => r.partial?.expected).length,
    partialFalse: all.filter((r) => r.partial && !r.partial.expected && r.partial.got).length,
    injectionFlagged: all.filter((r) => r.injection?.got).length,
    injectionExpected: all.filter((r) => r.injection).length,
    codeMissed: results.reduce((s, r) => s + r.code.missed.length, 0),
    codeExtra: results.reduce((s, r) => s + r.code.extra.length, 0),
    citationsReturned: results.reduce((s, r) => s + r.citationsReturned, 0),
    citationsVerified: config.startsWith("drawwell") ? results.reduce((s, r) => s + (r.citationsVerified ?? 0), 0) : null,
    latencyMs: results.reduce((s, r) => s + r.latencyMs, 0),
    promptTokens, completionTokens,
    estimatedCostUsd: Number(((promptTokens * pin + completionTokens * pout) / 1e6).toFixed(4)),
    errors: results.filter((r) => r.error).length,
    bySplit: Object.fromEntries(["demo", "held-out"].map((sp) => {
      const rs = results.filter((r) => r.split === sp).flatMap((r) => r.rows);
      return [sp, { rows: rs.length, acceptable: rs.filter((r) => r.acceptable).length, unsafeMisses: rs.filter((r) => r.unsafeMiss).length, overCalls: rs.filter((r) => r.overCall).length }];
    })),
  };
  const ranAt = new Date().toISOString();
  await mkdir("docs/results/benchmark", { recursive: true });
  const file = `docs/results/benchmark/${ranAt.replace(/[:.]/g, "-")}-${config}-${model}.json`;
  await writeFile(file, JSON.stringify({ ranAt, config, model, features: config.startsWith("drawwell") ? reviewFeatures(model) : null, summary, results }, null, 2) + "\n");
  console.log(JSON.stringify(summary));
  console.log(`wrote ${file}`);
}

main();
