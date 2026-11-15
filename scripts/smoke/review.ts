import { mkdir, writeFile } from "node:fs/promises";
import { reviewFeatures, reviewRequest } from "../../src/engine/review";
import { sampleInput } from "../../src/samples";

async function main() {
  const id = process.argv[2] ?? "upward-bound";
  const model = process.argv[3] ?? "gpt-5.4-mini";
  const off = process.argv[4] === "plain";
  const base = reviewFeatures(model);
  const features = off ? { ...base, multipath: false, promptGuard: false, shadow: null } : base;
  const t0 = Date.now();
  const r = await reviewRequest(sampleInput(id), features);
  console.log(`${id} ${model} ${off ? "plain" : "full"} ${Date.now() - t0}ms servError=${r.servError}`);
  for (const c of r.calls) console.log(`call ${c.modelId} ${c.latencyMs}ms in=${c.promptTokens} out=${c.completionTokens}`);
  console.log("stats", JSON.stringify(r.stats));
  for (const f of r.findings) console.log(f.severity.padEnd(6), f.code.padEnd(20), f.rowIds.join(","), "|", f.detail.slice(0, 140));
  for (const [rid, a] of Object.entries(r.assessments)) console.log("  ", rid, a.allowability.padEnd(18), a.suggestedCategory, a.documentVerified ? "docOK" : "", a.injectionDetected ? "INJ" : "", "|", a.reason.slice(0, 110));
  await mkdir("docs/results/runs", { recursive: true });
  await writeFile(`docs/results/runs/${new Date().toISOString().replace(/[:.]/g, "-")}-${id}-${model}${off ? "-plain" : ""}.json`, JSON.stringify(r, null, 2) + "\n");
}
main();
