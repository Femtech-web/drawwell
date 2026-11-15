import { mkdir, writeFile } from "node:fs/promises";
import { servChat, ServError, type ServFeatures } from "../../src/serv/client";

const SYSTEM = `You classify grant expenses. Return JSON matching the schema. For each row decide whether the cost is "allowable", "needs_review" or "likely_unallowable" under 2 CFR 200, and quote the rule text you rely on from the provided rules.`;
const USER = JSON.stringify({
  rules: {
    "200.423": "The cost of alcoholic beverages is unallowable.",
    "200.453": "(a) Costs incurred for materials, supplies, and fabricated parts necessary for the performance of a Federal award are allowable.",
  },
  rows: [
    { id: "A", description: "Two bottles of house wine for family night", amount: 38 },
    { id: "B", description: "Printer paper and toner for tutoring center", amount: 142.5 },
  ],
});
const SCHEMA = {
  name: "smoke_rows",
  schema: {
    type: "object",
    additionalProperties: false,
    required: ["rows"],
    properties: {
      rows: {
        type: "array",
        items: {
          type: "object",
          additionalProperties: false,
          required: ["id", "allowability", "section", "quote"],
          properties: {
            id: { type: "string", enum: ["A", "B"] },
            allowability: { type: "string", enum: ["allowable", "needs_review", "likely_unallowable"] },
            section: { type: "string", enum: ["200.423", "200.453"] },
            quote: { type: "string" },
          },
        },
      },
    },
  },
};

const HINT = "Each row id appears exactly once and each quote is copied word for word from the provided rules.";
const base = (model: string): ServFeatures => ({ model, multipath: false, kronos: false, promptGuard: false, shadow: null });

const MODEL = process.argv[2] ?? "gpt-5.4-mini";
const EXTRA_MODELS = (process.argv[3] ?? "").split(",").filter(Boolean);

const cases: { name: string; features: ServFeatures; schema: boolean }[] = [
  { name: "plain", features: base(MODEL), schema: false },
  { name: "json_schema", features: base(MODEL), schema: true },
  { name: "multipath+schema", features: { ...base(MODEL), multipath: true }, schema: true },
  { name: "kronos+schema", features: { ...base(MODEL), kronos: true }, schema: true },
  { name: "shadow+schema", features: { ...base(MODEL), shadow: { hint: HINT, maxIterations: 2 } }, schema: true },
  { name: "prompt_guard+schema", features: { ...base(MODEL), promptGuard: true }, schema: true },
  { name: "full", features: { ...base(MODEL), multipath: true, promptGuard: true, shadow: { hint: HINT, maxIterations: 2 } }, schema: true },
  ...EXTRA_MODELS.map((m) => ({
    name: `full:${m}`,
    features: { ...base(m), multipath: true, promptGuard: true, shadow: { hint: HINT, maxIterations: 2 } },
    schema: true,
  })),
];

async function main() {
  const results = [];
  for (const c of cases) {
    const started = Date.now();
    try {
      const r = await servChat({ system: SYSTEM, user: USER, features: c.features, schema: c.schema ? SCHEMA : undefined, timeoutMs: 180_000 });
      let parsed: unknown = null;
      let parseOk = false;
      try {
        parsed = JSON.parse(r.content);
        parseOk = true;
      } catch {}
      const rows = (parsed as { rows?: { id: string; allowability: string }[] })?.rows ?? [];
      const correct = rows.find((x) => x.id === "A")?.allowability === "likely_unallowable" && rows.find((x) => x.id === "B")?.allowability === "allowable";
      results.push({
        case: c.name, ok: true, modelId: r.modelId, servedModel: r.servedModel, latencyMs: r.latencyMs,
        usage: r.usage, finishReason: r.finishReason, parseOk: c.schema ? parseOk : null,
        correct: c.schema ? correct : null, contentPreview: r.content.slice(0, 300),
      });
      console.log(`PASS ${c.name.padEnd(22)} ${r.latencyMs}ms parse=${parseOk} correct=${correct} tokens=${r.usage?.totalTokens ?? "?"}`);
    } catch (e) {
      const err = e as ServError;
      results.push({ case: c.name, ok: false, latencyMs: Date.now() - started, status: err.status ?? null, error: err.message, body: err.body?.slice(0, 600) ?? null });
      console.log(`FAIL ${c.name.padEnd(22)} ${err.status ?? ""} ${err.message} ${err.body?.slice(0, 300) ?? ""}`);
    }
  }
  await mkdir("docs/results", { recursive: true });
  const file = `docs/results/serv-smoke-${MODEL}.json`;
  await writeFile(file, JSON.stringify({ ranAt: new Date().toISOString(), model: MODEL, results }, null, 2) + "\n");
  console.log(`wrote ${file}`);
}

main();
