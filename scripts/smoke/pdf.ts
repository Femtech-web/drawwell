import { readFile } from "node:fs/promises";
import { extractPdfText } from "../../src/server/pdf";

async function main() {
  for (const f of process.argv.slice(2)) {
    const r = await extractPdfText(new Uint8Array(await readFile(f)));
    console.log(`== ${f} pages=${r.pages}\n${r.text}\n`);
  }
}
main();
