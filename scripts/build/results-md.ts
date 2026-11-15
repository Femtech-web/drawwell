import { readFile, readdir, writeFile } from "node:fs/promises";

const ORDER = ["code-only", "single-call", "drawwell-plain", "drawwell"];
type S = Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any
const NAME: Record<string, string> = { "code-only": "Code rules only", "single-call": "One plain SERV call", "drawwell-plain": "Drawwell, SERV features off", drawwell: "Drawwell" };

async function main() {
  const dir = "docs/results/benchmark";
  const files = (await readdir(dir)).filter((f) => f.endsWith(".json")).sort();
  const latest = new Map<string, S>();
  for (const f of files) {
    const r = JSON.parse(await readFile(`${dir}/${f}`, "utf8"));
    latest.set(r.config, { ...r, file: f });
  }
  const runs = ORDER.map((c) => latest.get(c)).filter((r): r is S => !!r);
  const f = (a: number, b: number) => `${a}/${b}`;
  const rows: [string, (s: S) => string][] = [
    ["Defensible allowability", (s) => f(s.acceptable, s.rows)],
    ["Unanswered rows", (s) => String(s.unanswered)],
    ["Unsafe misses (lower is better)", (s) => String(s.unsafeMisses)],
    ["Over-calls (lower is better)", (s) => String(s.overCalls)],
    ["Held-out request", (s) => f(s.bySplit["held-out"].acceptable, s.bySplit["held-out"].rows)],
    ["Budget category", (s) => f(s.categoryCorrect, s.categoryLabeled)],
    ["Receipt mismatches found", (s) => f(s.mismatchFound, s.mismatchExpected)],
    ["False receipt mismatches", (s) => String(s.mismatchFalse)],
    ["Unallowable lines isolated (exact cents)", (s) => f(s.partialExact, s.partialExpected)],
    ["False partial removals", (s) => String(s.partialFalse)],
    ["Planted instructions flagged", (s) => f(s.injectionFlagged, s.injectionExpected)],
    ["Citations kept word for word", (s) => (s.citationsVerified === null ? (s.citationsReturned ? `${s.citationsReturned} unchecked` : "n/a") : f(s.citationsVerified, s.citationsReturned))],
    ["Time for 4 requests", (s) => `${Math.round(s.latencyMs / 1000)}s`],
    ["Estimated cost", (s) => `$${(s.estimatedCostUsd ?? 0).toFixed(3)}`],
  ];
  const head = `| | ${runs.map((r) => `${NAME[r.config]}${r.config === "code-only" ? "" : ` (${r.model})`}`).join(" | ")} |\n|---|${runs.map(() => "---").join("|")}|\n`;
  const body = rows.map(([label, get]) => `| ${label} | ${runs.map((r) => get(r.summary)).join(" | ")} |`).join("\n");
  const md = `${head}${body}\n\nRuns: ${runs.map((r) => `\`${r.file}\``).join(", ")}\n`;
  await writeFile("docs/results/benchmark-table.md", md);
  const readme = await readFile("README.md", "utf8");
  const marked = /<!-- results-table -->[\s\S]*?(<!-- \/results-table -->|$)/;
  const block = `<!-- results-table -->\n${md}<!-- /results-table -->`;
  if (readme.includes("<!-- results-table -->")) {
    const next = readme.includes("<!-- /results-table -->")
      ? readme.replace(/<!-- results-table -->[\s\S]*?<!-- \/results-table -->/, block)
      : readme.replace("<!-- results-table -->", block);
    await writeFile("README.md", next);
  }
  void marked;
  console.log(md);
}
main();
