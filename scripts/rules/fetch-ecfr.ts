import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";

const SECTIONS = [
  "200.1", "200.302", "200.305", "200.308", "200.403", "200.404", "200.405", "200.407",
  "200.420", "200.421", "200.423", "200.430", "200.431", "200.432", "200.438", "200.439",
  "200.441", "200.442", "200.445", "200.450", "200.453", "200.456", "200.465", "200.474", "200.475",
];

const OUT = join(process.cwd(), "src/rules/2cfr200");

function decode(s: string) {
  return s
    .replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"').replace(/&#8212;/g, "—").replace(/&#8217;/g, "’")
    .replace(/&#x([0-9a-f]+);/gi, (_, h) => String.fromCodePoint(parseInt(h, 16)))
    .replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(Number(d)));
}

function toParagraphs(xml: string) {
  const heading = decode((xml.match(/<HEAD>([\s\S]*?)<\/HEAD>/) ?? [])[1] ?? "").replace(/\s+/g, " ").trim();
  const paragraphs = [...xml.matchAll(/<P>([\s\S]*?)<\/P>/g)]
    .map((m) => decode(m[1].replace(/<[^>]+>/g, "")).replace(/\s+/g, " ").trim())
    .filter(Boolean);
  return { heading, paragraphs };
}

async function main() {
  const titles = await (await fetch("https://www.ecfr.gov/api/versioner/v1/titles.json")).json();
  const t2 = titles.titles.find((t: { number: number }) => t.number === 2);
  const date: string = t2.up_to_date_as_of;
  await mkdir(OUT, { recursive: true });
  const all: Record<string, unknown>[] = [];
  for (const section of SECTIONS) {
    const url = `https://www.ecfr.gov/api/versioner/v1/full/${date}/title-2.xml?part=200&section=${section}`;
    const res = await fetch(url, { headers: { "accept-encoding": "gzip" } });
    if (!res.ok) throw new Error(`${section}: HTTP ${res.status}`);
    const { heading, paragraphs } = toParagraphs(await res.text());
    if (!paragraphs.length) throw new Error(`${section}: no paragraphs parsed`);
    const record = {
      section,
      heading,
      source: `https://www.ecfr.gov/current/title-2/section-${section}`,
      api: url,
      upToDateAsOf: date,
      latestAmendedOn: t2.latest_amended_on,
      paragraphs,
    };
    await writeFile(join(OUT, `${section}.json`), JSON.stringify(record, null, 2) + "\n");
    all.push(record);
    console.log(`${section}  ${paragraphs.length} paragraphs  ${heading}`);
  }
  await writeFile(join(OUT, "all.json"), JSON.stringify({ upToDateAsOf: date, sections: all }) + "\n");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
