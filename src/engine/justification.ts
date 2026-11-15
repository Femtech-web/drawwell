import { JUSTIFICATION_LIMIT } from "@/rules/guidance";
import { formatShortDate } from "./dates";
import { formatMoney, moneyVariants, sumCents } from "./money";
import { ED524_CATEGORIES, type Category, type PaymentBasis } from "./types";

export interface CategoryTotal {
  category: Category;
  cents: number;
}

export interface JustificationContext {
  programName: string;
  awardNumber: string;
  basis: PaymentBasis;
  totals: CategoryTotal[];
  startIso: string;
  endIso: string;
  personalNames: string[];
}

export interface JustificationCheck {
  id: string;
  label: string;
  pass: boolean;
  required: boolean;
  detail: string;
}

const escapeRe = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

function dateVariants(iso: string): string[] {
  const [y, m, d] = iso.split("-");
  const mm = String(Number(m));
  const dd = String(Number(d));
  return [`${m}/${d}/${y.slice(2)}`, `${m}/${d}/${y}`, `${mm}/${dd}/${y.slice(2)}`, `${mm}/${dd}/${y}`, iso];
}

function amountAfterCategory(text: string, category: Category, cents: number): boolean {
  return moneyVariants(cents).some((v) =>
    new RegExp(`${escapeRe(category)}\\s*[:=\\-–—]?\\s*\\$\\s?${escapeRe(v)}(?![\\d,]|\\.\\d)`, "i").test(text),
  );
}

export function verifyJustification(text: string, ctx: JustificationContext): JustificationCheck[] {
  const checks: JustificationCheck[] = [];
  const total = sumCents(ctx.totals.map((t) => t.cents));
  const push = (c: JustificationCheck) => checks.push(c);

  push({
    id: "length", required: true, label: `${JUSTIFICATION_LIMIT} characters or fewer`,
    pass: text.length > 0 && text.length <= JUSTIFICATION_LIMIT,
    detail: `${text.length} of ${JUSTIFICATION_LIMIT} characters.`,
  });
  push({
    id: "program", required: true, label: "Names the program",
    pass: text.toLowerCase().includes(ctx.programName.toLowerCase()),
    detail: `Must include "${ctx.programName}".`,
  });
  const missing = ctx.totals.filter((t) => !amountAfterCategory(text, t.category, t.cents));
  push({
    id: "categories", required: true, label: "Every category with its exact amount",
    pass: missing.length === 0,
    detail: missing.length
      ? `Missing or wrong: ${missing.map((t) => `${t.category} ${formatMoney(t.cents)}`).join("; ")}.`
      : ctx.totals.map((t) => `${t.category} ${formatMoney(t.cents)}`).join("; "),
  });
  const extra = ED524_CATEGORIES.filter(
    (c) => !ctx.totals.some((t) => t.category === c) && new RegExp(`\\b${escapeRe(c)}\\b`, "i").test(text),
  );
  push({
    id: "no-extra-categories", required: true, label: "No categories outside this request",
    pass: extra.length === 0,
    detail: extra.length ? `Mentions ${extra.join(", ")}, which has no amount in this request.` : "Only requested categories are named.",
  });
  push({
    id: "sum", required: true, label: "Amounts add up to the request",
    pass: missing.length === 0,
    detail: `Request total ${formatMoney(total, { forceCents: true })}.`,
  });
  const hasStart = dateVariants(ctx.startIso).some((v) => text.includes(v));
  const hasEnd = dateVariants(ctx.endIso).some((v) => text.includes(v));
  push({
    id: "dates", required: true, label: "Start and end dates of the expenses",
    pass: hasStart && hasEnd,
    detail: `Expected ${formatShortDate(ctx.startIso)} and ${formatShortDate(ctx.endIso)}.`,
  });
  const basisPass = ctx.basis === "advance"
    ? /\b(advance|planned|immediate|upcoming|due)\b/i.test(text)
    : /reimburs/i.test(text);
  push({
    id: "basis", required: false, label: ctx.basis === "advance" ? "Says what the advance will pay" : "Says it reimburses paid costs",
    pass: basisPass,
    detail: ctx.basis === "advance" ? "G5 asks for the purpose and planned use of the payment." : "Make clear these costs were already paid.",
  });
  const pii =
    /\b\d{3}-\d{2}-\d{4}\b/.test(text) ||
    /[\w.+-]+@[\w-]+\.[\w.]+/.test(text) ||
    /\(?\b\d{3}\)?[\s.-]\d{3}[\s.-]\d{4}\b/.test(text) ||
    ctx.personalNames.some((n) => n && text.toLowerCase().includes(n.toLowerCase()));
  push({
    id: "no-personal-data", required: true, label: "No personal information",
    pass: !pii,
    detail: pii ? "Remove names, SSNs, emails or phone numbers." : "No names, SSNs, emails or phone numbers found.",
  });
  return checks;
}

export function justificationPasses(checks: JustificationCheck[]): boolean {
  return checks.every((c) => c.pass || !c.required);
}

/** Plain fallback built from verified numbers only; offered when SERV's drafts fail the checks. */
export function templateJustification(ctx: JustificationContext): string {
  const parts = ctx.totals.map((t) => `${t.category} ${formatMoney(t.cents)}`).join("; ");
  const dates = `${formatShortDate(ctx.startIso)}-${formatShortDate(ctx.endIso)}`;
  const tail = ctx.basis === "advance" ? `Planned disbursements for expenses ${dates}.` : `Reimbursement of costs paid ${dates}.`;
  const full = `${ctx.programName} ${ctx.awardNumber}: ${parts}. ${tail}`;
  return full.length <= JUSTIFICATION_LIMIT ? full : `${ctx.programName}: ${parts}. ${tail}`;
}
