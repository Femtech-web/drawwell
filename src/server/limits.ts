const WINDOW_MS = 10 * 60_000;
const PER_IP = Number(process.env.REVIEWS_PER_IP_PER_10_MIN ?? 8);
const DAILY_CAP = Number(process.env.DAILY_SERV_CALL_CAP ?? 150);

const hits = new Map<string, number[]>();
let day = new Date().toISOString().slice(0, 10);
let dailyCount = 0;

export function clientIp(req: Request): string {
  return req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || req.headers.get("x-real-ip") || "local";
}

/** Protects the SERV credit balance; counts are per server instance, which is enough for a public demo. */
export function takeToken(ip: string): string | null {
  const today = new Date().toISOString().slice(0, 10);
  if (today !== day) {
    day = today;
    dailyCount = 0;
  }
  if (dailyCount >= DAILY_CAP) return "Drawwell's daily SERV budget for the public demo is used up. Try again tomorrow, or run it locally with your own key.";
  const now = Date.now();
  const recent = (hits.get(ip) ?? []).filter((t) => now - t < WINDOW_MS);
  if (recent.length >= PER_IP) return "Too many reviews from this address in ten minutes. Wait a few minutes and try again.";
  recent.push(now);
  hits.set(ip, recent);
  dailyCount++;
  return null;
}
