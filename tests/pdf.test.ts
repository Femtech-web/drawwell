import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";
import { POST } from "@/app/api/extract/route";
import { verifyServReview } from "@/engine/verify";
import { extractPdfText } from "@/server/pdf";
import { sampleInput } from "@/samples";

const pdf = (name: string) => readFile(`public/templates/receipts-pdf/${name}.pdf`);

describe("PDF receipts", () => {
  it("extracts the receipt's text, totals included", async () => {
    const { text, pages } = await extractPdfText(new Uint8Array(await pdf("RCPT-BN-2291")));
    expect(pages).toBe(1);
    expect(text).toContain("TOTAL $1,263.00");
    expect(text).toContain("40 x Official SAT Study Guide");
  });

  it("the extract route reads PDFs and explains the ones it can't", async () => {
    const form = new FormData();
    form.append("files", new File([await pdf("RCPT-MESA-1106")], "RCPT-MESA-1106.pdf", { type: "application/pdf" }));
    form.append("files", new File([await readFile("fixtures/blank.pdf")], "SCAN-001.pdf", { type: "application/pdf" }));
    form.append("files", new File(["not a pdf"], "NOTES.pdf", { type: "application/pdf" }));
    const res = await POST(new Request("http://localhost/api/extract", { method: "POST", body: form }));
    const { files } = (await res.json()) as { files: { id: string; text: string | null; error: string | null }[] };
    expect(files.map((f) => f.id)).toEqual(["RCPT-MESA-1106", "SCAN-001", "NOTES"]);
    expect(files[0].text).toContain("House red wine (2 btl) @ 19.00 38.00");
    expect(files[1]).toMatchObject({ text: null, error: expect.stringContaining("No text layer") });
    expect(files[2]).toMatchObject({ text: null, error: "Not a readable PDF." });
  });

  it("SERV's quotes are verified against PDF text the same way", async () => {
    const input = sampleInput("upward-bound");
    const { text } = await extractPdfText(new Uint8Array(await pdf("RCPT-BN-2291")));
    const documents = [{ id: "RCPT-BN-2291", text }];
    const rows = input.ledger.filter((r) => r.id === "L-1104");
    const v = verifyServReview([{
      row_id: "L-1104", coded_category_fits: true, best_category: "Supplies", allowability: "allowable", reason: "ok",
      citations: [{ section: "200.453", quote: "Costs incurred for materials, supplies, and fabricated parts necessary for the performance of a Federal award are allowable." }],
      term_refs: [], document_total: 1263, document_total_quote: "TOTAL $1,263.00", partial_amount: null, partial_quote: null, partial_reason: null, injection_detected: false,
    }], rows, documents, input.terms, input.ledger);
    expect(v.findings.find((f) => f.code === "DOCUMENT_MISMATCH")).toMatchObject({ severity: "error", verified: true, amountCents: 2700 });
  });
});
