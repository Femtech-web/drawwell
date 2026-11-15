import { servChat, ServError } from "../../src/serv/client";
import { reviewFeatures } from "../../src/engine/review";
import { REVIEW_SYSTEM, reviewUserMessage } from "../../src/serv/prompts";
import { reviewSchema } from "../../src/serv/schema";
import { equipmentThresholdCents } from "../../src/engine/checks";
import { sampleInput } from "../../src/samples";

async function main() {
  const input = sampleInput(process.argv[3] ?? "talent-search");
  const rows = input.ledger.filter((r) => !r.drawnIn);
  const want = new Set((process.argv[2] ?? "").split(","));
  const f = reviewFeatures("gpt-5.4-mini");
  const features = { ...f, multipath: want.has("multipath"), promptGuard: want.has("guard"), shadow: want.has("shadow") ? f.shadow : null };
  try {
    const r = await servChat({
      system: REVIEW_SYSTEM,
      user: reviewUserMessage({ award: input.award, budget: input.budget, rows, documents: input.documents, terms: input.terms, equipmentThresholdCents: equipmentThresholdCents(5000) }),
      features, schema: reviewSchema(rows.map((r) => r.id), input.terms.map((t) => t.id)),
    });
    console.log("OK", r.latencyMs, r.finishReason, JSON.stringify(r.usage), "content length", r.content.length, r.content.slice(0, 200));
  } catch (e) {
    const err = e as ServError;
    console.log("ERR", err.status, err.message, err.body);
  }
}
main();
