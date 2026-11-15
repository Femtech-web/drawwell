import { extractPdfText } from "@/server/pdf";

export const maxDuration = 60;

const MAX_FILES = 20;
const MAX_BYTES = 2_000_000;

export interface ExtractedFile {
  id: string;
  text: string | null;
  pages: number;
  error: string | null;
}

export async function POST(req: Request) {
  const form = await req.formData().catch(() => null);
  const files = (form?.getAll("files") ?? []).filter((f): f is File => f instanceof File);
  if (!files.length) return Response.json({ error: "No PDF files received." }, { status: 400 });
  if (files.length > MAX_FILES) return Response.json({ error: `At most ${MAX_FILES} PDFs at a time.` }, { status: 413 });
  const results: ExtractedFile[] = [];
  for (const file of files) {
    const id = file.name.replace(/\.[^.]+$/, "");
    if (file.size > MAX_BYTES) {
      results.push({ id, text: null, pages: 0, error: "Larger than 2 MB." });
      continue;
    }
    try {
      const { text, pages } = await extractPdfText(new Uint8Array(await file.arrayBuffer()));
      results.push(text.length < 10
        ? { id, text: null, pages, error: "No text layer: scanned or photographed PDFs aren't read yet." }
        : { id, text: text.slice(0, 20_000), pages, error: null });
    } catch {
      results.push({ id, text: null, pages: 0, error: "Not a readable PDF." });
    }
  }
  console.log(`extract files=${files.length} ok=${results.filter((r) => r.text).length}`);
  return Response.json({ files: results });
}
