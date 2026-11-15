import { modelId, servChat, type ServFeatures, type ServResponse } from "@/serv/client";
import { JUSTIFY_SHADOW_HINT, JUSTIFY_SYSTEM, REVIEW_SHADOW_HINT, REVIEW_SYSTEM, justifyUserMessage, reviewUserMessage } from "@/serv/prompts";
import { JUSTIFY_SCHEMA, reviewSchema, type ServReviewRow } from "@/serv/schema";
import { equipmentThresholdCents, runChecks } from "./checks";
import { justificationPasses, templateJustification, verifyJustification, type JustificationCheck, type JustificationContext } from "./justification";
import type { Adjustment } from "./totals";
import type { Finding, ReviewInput } from "./types";
import { verifyServReview, type RowAssessment, type VerificationStats } from "./verify";

export const DEFAULT_MODEL = process.env.SERV_MODEL ?? "gpt-5.4-mini";

export function reviewFeatures(model = DEFAULT_MODEL): ServFeatures {
  return {
    model,
    multipath: process.env.SERV_MULTIPATH !== "0",
    kronos: false,
    promptGuard: process.env.SERV_PROMPT_GUARD !== "0",
    shadow: process.env.SERV_SHADOW === "0" ? null : { hint: REVIEW_SHADOW_HINT, maxIterations: 2 },
  };
}

export interface ServCallRecord {
  purpose: "review" | "justify";
  modelId: string;
  servedModel: string;
  latencyMs: number;
  promptTokens: number | null;
  completionTokens: number | null;
  requestId: string | null;
  features: { multipath: boolean; kronos: boolean; promptGuard: boolean; shadowAgent: boolean };
  attempt: number;
  outcome: "ok" | "empty" | "error";
}

function record(purpose: ServCallRecord["purpose"], r: ServResponse, f: ServFeatures, attempt: number): ServCallRecord {
  return {
    outcome: r.content.trim() ? "ok" : "empty",
    purpose, modelId: r.modelId, servedModel: r.servedModel, latencyMs: r.latencyMs,
    promptTokens: r.usage?.promptTokens ?? null, completionTokens: r.usage?.completionTokens ?? null,
    requestId: r.requestId, attempt,
    features: { multipath: f.multipath, kronos: f.kronos, promptGuard: f.promptGuard, shadowAgent: !!f.shadow },
  };
}

export interface ReviewResult {
  findings: Finding[];
  assessments: Record<string, RowAssessment>;
  proposedAdjustments: Adjustment[];
  servRowIds: string[];
  stats: VerificationStats | null;
  calls: ServCallRecord[];
  servError: string | null;
}

export async function reviewRequest(input: ReviewInput, features = reviewFeatures()): Promise<ReviewResult> {
  const checks = runChecks(input);
  const blocked = new Set(checks.findings.filter((f) => f.severity === "error").map((f) => f.rowIds[0]));
  const forServ = checks.selected.filter((r) => !blocked.has(r.id));
  const result: ReviewResult = {
    findings: checks.findings, assessments: {}, proposedAdjustments: [], servRowIds: forServ.map((r) => r.id),
    stats: null, calls: [], servError: null,
  };
  if (!forServ.length) return result;

  const system = REVIEW_SYSTEM;
  const user = reviewUserMessage({
    award: input.award, budget: input.budget, rows: forServ, documents: input.documents, terms: input.terms,
    equipmentThresholdCents: equipmentThresholdCents(input.award.capitalizationThreshold),
  });
  const schema = reviewSchema(forServ.map((r) => r.id), input.terms.map((t) => t.id));
  // Full features were the most accurate on the benchmark but slow and sometimes empty; each fallback has its own
  // time budget so a review ends inside the route's 300 s, finishing on the measured features-off configuration.
  const plans: { features: ServFeatures; timeoutMs: number }[] = [
    { features, timeoutMs: 150_000 },
    ...(features.promptGuard ? [{ features: { ...features, promptGuard: false }, timeoutMs: 90_000 }] : []),
    ...(features.multipath || features.shadow ? [{ features: { ...features, promptGuard: false, multipath: false, shadow: null }, timeoutMs: 45_000 }] : []),
  ];
  for (let i = 0; i < plans.length; i++) {
    const started = Date.now();
    try {
      const res = await servChat({ system, user, features: plans[i].features, schema, timeoutMs: plans[i].timeoutMs });
      result.calls.push(record("review", res, plans[i].features, i + 1));
      if (!res.content.trim()) continue;
      const parsed = JSON.parse(res.content) as { rows: ServReviewRow[] };
      const verified = verifyServReview(parsed.rows ?? [], forServ, input.documents, input.terms, input.ledger);
      result.findings = [...checks.findings, ...verified.findings];
      result.assessments = verified.assessments;
      result.proposedAdjustments = verified.proposedAdjustments;
      result.stats = verified.stats;
      result.servError = null;
      return result;
    } catch (e) {
      result.servError = e instanceof Error ? e.message : String(e);
      const f = plans[i].features;
      result.calls.push({
        purpose: "review", modelId: modelId(f), servedModel: "", latencyMs: Date.now() - started, promptTokens: null,
        completionTokens: null, requestId: null, attempt: i + 1, outcome: "error",
        features: { multipath: f.multipath, kronos: f.kronos, promptGuard: f.promptGuard, shadowAgent: !!f.shadow },
      });
    }
  }
  result.servError ??= "SERV returned no content";
  return result;
}

export interface JustifyResult {
  text: string;
  checks: JustificationCheck[];
  source: "serv" | "template";
  attempts: number;
  calls: ServCallRecord[];
  servError: string | null;
}

export const MAX_JUSTIFY_ATTEMPTS = 3;

export async function draftJustification(
  input: Pick<ReviewInput, "award">,
  ctx: JustificationContext,
  purposes: { category: string; examples: string[] }[],
  features = reviewFeatures(),
): Promise<JustifyResult> {
  let f: ServFeatures = { ...features, multipath: false, shadow: features.shadow ? { hint: JUSTIFY_SHADOW_HINT, maxIterations: 2 } : null };
  const calls: ServCallRecord[] = [];
  let failures: string[] | undefined;
  let last = "";
  let servError: string | null = null;
  for (let attempt = 1; attempt <= MAX_JUSTIFY_ATTEMPTS; attempt++) {
    try {
      const res = await servChat({
        system: JUSTIFY_SYSTEM,
        user: justifyUserMessage({ award: input.award, totals: ctx.totals, startIso: ctx.startIso, endIso: ctx.endIso, purposes, failures }),
        features: f,
        schema: JUSTIFY_SCHEMA,
        timeoutMs: 120_000,
      });
      calls.push(record("justify", res, f, attempt));
      if (!res.content.trim()) {
        f = { ...f, promptGuard: false };
        continue;
      }
      last = (JSON.parse(res.content) as { justification: string }).justification.trim();
      const checks = verifyJustification(last, ctx);
      if (justificationPasses(checks)) return { text: last, checks, source: "serv", attempts: attempt, calls, servError: null };
      failures = checks.filter((c) => !c.pass && c.required).map((c) => `${c.label}: ${c.detail}`);
    } catch (e) {
      servError = e instanceof Error ? e.message : String(e);
      break;
    }
  }
  const text = templateJustification(ctx);
  return { text, checks: verifyJustification(text, ctx), source: "template", attempts: calls.length, calls, servError };
}
