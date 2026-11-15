import { reviewRequest } from "@/engine/review";
import { clientIp, takeToken } from "@/server/limits";
import { ReviewBodySchema, toReviewInput } from "@/server/input";
import { servConfigured } from "@/serv/client";

export const maxDuration = 300;

export async function POST(req: Request) {
  const parsed = ReviewBodySchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: "Invalid request", issues: parsed.error.issues.slice(0, 5) }, { status: 400 });
  const { input, issues } = toReviewInput(parsed.data);
  if (!input) return Response.json({ error: "The CSV files have problems", csvIssues: issues }, { status: 422 });
  if (!servConfigured()) return Response.json({ error: "SERV is not configured on this server." }, { status: 503 });
  const limited = takeToken(clientIp(req));
  if (limited) return Response.json({ error: limited }, { status: 429 });
  const started = Date.now();
  const result = await reviewRequest(input);
  console.log(`review rows=${input.selectedRowIds.length} serv=${result.calls.map((c) => `${c.modelId}:${c.latencyMs}ms`).join(",")} err=${result.servError ? "yes" : "no"} total=${Date.now() - started}ms`);
  return Response.json(result);
}
