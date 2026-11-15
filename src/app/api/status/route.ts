import { connection } from "next/server";
import { DEFAULT_MODEL, reviewFeatures } from "@/engine/review";
import { servConfigured } from "@/serv/client";

export async function GET() {
  await connection();
  const f = reviewFeatures(DEFAULT_MODEL);
  return Response.json({
    servConfigured: servConfigured(),
    model: DEFAULT_MODEL,
    features: { multipath: f.multipath, promptGuard: f.promptGuard, shadowAgent: !!f.shadow },
  });
}
