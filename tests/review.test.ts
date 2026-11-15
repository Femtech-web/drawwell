import { afterEach, describe, expect, it, vi } from "vitest";
import { reviewFeatures, reviewRequest } from "@/engine/review";
import { sampleInput } from "@/samples";

const reply = (content: string) =>
  new Response(JSON.stringify({ id: "test", model: "gpt-5.4-mini", choices: [{ message: { content }, finish_reason: "stop" }], usage: { prompt_tokens: content ? 10 : 0, completion_tokens: content ? 5 : 0, total_tokens: content ? 15 : 0 } }), { status: 200 });

const row = (id: string) => ({
  row_id: id, coded_category_fits: true, best_category: "Personnel", allowability: "allowable", reason: "ok",
  citations: [{ section: "200.453", quote: "Costs incurred for materials, supplies, and fabricated parts necessary for the performance of a Federal award are allowable." }],
  term_refs: [], document_total: null, document_total_quote: null, partial_amount: null, partial_quote: null, partial_reason: null, injection_detected: false,
});

afterEach(() => vi.unstubAllGlobals());

describe("SERV empty responses", () => {
  it("retries without Prompt Guard and records both attempts", async () => {
    vi.stubEnv("SERV_API_KEY", "test-key");
    const input = sampleInput("talent-search");
    const ids = input.selectedRowIds;
    const bodies: { model: string; tools?: { function: { name: string } }[] }[] = [];
    const fetchMock = vi.fn(async (_url: string, init: RequestInit) => {
      bodies.push(JSON.parse(String(init.body)));
      return bodies.length === 1 ? reply("") : reply(JSON.stringify({ rows: ids.map(row) }));
    });
    vi.stubGlobal("fetch", fetchMock);
    const r = await reviewRequest(input, reviewFeatures("gpt-5.4-mini"));
    expect(r.servError).toBeNull();
    expect(r.calls.map((c) => [c.outcome, c.features.promptGuard])).toEqual([["empty", true], ["ok", false]]);
    expect(bodies[0].tools?.some((t) => t.function.name === "serv_prompt_guard")).toBe(true);
    expect(bodies[1].tools?.some((t) => t.function.name === "serv_prompt_guard")).toBe(false);
    expect(Object.keys(r.assessments).sort()).toEqual([...ids].sort());
  });

  it("keeps the code findings and reports the failure when every attempt is empty", async () => {
    vi.stubEnv("SERV_API_KEY", "test-key");
    vi.stubGlobal("fetch", vi.fn(async () => reply("")));
    const r = await reviewRequest(sampleInput("talent-search"), reviewFeatures("gpt-5.4-mini"));
    expect(r.calls).toHaveLength(3);
    expect(r.servError).toBe("SERV returned no content");
    expect(r.findings.some((f) => f.code === "INSTRUCTION_IN_DATA")).toBe(true);
  });
});
