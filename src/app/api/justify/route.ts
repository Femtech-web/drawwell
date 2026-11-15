import { z } from "zod";
import { draftJustification } from "@/engine/review";
import { ED524_CATEGORIES } from "@/engine/types";
import { clientIp, takeToken } from "@/server/limits";
import { AwardSchema } from "@/server/input";
import { servConfigured } from "@/serv/client";
import { isIsoDate } from "@/engine/dates";

export const maxDuration = 180;

const Body = z.object({
  award: AwardSchema,
  totals: z.array(z.object({ category: z.enum(ED524_CATEGORIES), cents: z.number().int().positive() })).min(1).max(10),
  startIso: z.string().refine(isIsoDate),
  endIso: z.string().refine(isIsoDate),
  purposes: z.array(z.object({ category: z.string().max(40), examples: z.array(z.string().max(160)).max(4) })).max(10),
  personalNames: z.array(z.string().max(80)).max(100),
});

export async function POST(req: Request) {
  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: "Invalid request" }, { status: 400 });
  if (!servConfigured()) return Response.json({ error: "SERV is not configured on this server." }, { status: 503 });
  const limited = takeToken(clientIp(req));
  if (limited) return Response.json({ error: limited }, { status: 429 });
  const { award, totals, startIso, endIso, purposes, personalNames } = parsed.data;
  const result = await draftJustification(
    { award },
    { programName: award.programName, awardNumber: award.awardNumber, basis: award.paymentBasis, totals, startIso, endIso, personalNames },
    purposes,
  );
  console.log(`justify attempts=${result.attempts} source=${result.source}`);
  return Response.json(result);
}
