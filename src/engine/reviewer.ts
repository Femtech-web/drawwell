import { JUSTIFICATION_LIMIT } from "@/rules/guidance";
import { normalizeDate } from "./dates";
import { parseMoney, sumCents } from "./money";
import { ED524_CATEGORIES, type Category } from "./types";

export interface Submission {
  grantee: string;
  program: string;
  awardNumber: string;
  amountCents: number;
  justification: string;
}

export interface ReviewerCheck {
  id: "length" | "program" | "categories" | "sum" | "dates" | "personal";
  label: string;
  pass: boolean;
  detail: string;
}

export interface ReviewerResult {
  submission: Submission;
  parsed: { category: Category; cents: number }[];
  dates: string[];
  checks: ReviewerCheck[];
  ready: boolean;
}

const CATEGORY_AMOUNT = new RegExp(
  `(${ED524_CATEGORIES.map((c) => c.replace(/ /g, "\\s+")).join("|")})\\s*[:=\\-–—]?\\s*\\$\\s?([\\d,]+(?:\\.\\d{1,2})?)`,
  "gi",
);
const DATE = /\b(\d{1,2}\/\d{1,2}\/(?:\d{4}|\d{2})|\d{4}-\d{2}-\d{2})\b/g;

/** A state reviewer has only the text and the requested amount, so the categories and dates are read from the text itself. */
export function reviewSubmission(s: Submission): ReviewerResult {
  const text = s.justification.trim();
  const parsed: ReviewerResult["parsed"] = [];
  for (const m of text.matchAll(CATEGORY_AMOUNT)) {
    const category = ED524_CATEGORIES.find((c) => c.toLowerCase() === m[1].replace(/\s+/g, " ").toLowerCase());
    const cents = parseMoney(m[2]);
    if (category && cents !== null) parsed.push({ category, cents });
  }
  const dates = [...text.matchAll(DATE)].map((m) => normalizeDate(m[1])).filter((d): d is string => !!d);
  const total = sumCents(parsed.map((p) => p.cents));
  const fmt = (c: number) => `$${(c / 100).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  const personal =
    /\b\d{3}-\d{2}-\d{4}\b/.test(text) || /[\w.+-]+@[\w-]+\.[\w.]+/.test(text) || /\(?\b\d{3}\)?[\s.-]\d{3}[\s.-]\d{4}\b/.test(text);
  const checks: ReviewerCheck[] = [
    { id: "length", label: `${JUSTIFICATION_LIMIT} characters or fewer`, pass: text.length > 0 && text.length <= JUSTIFICATION_LIMIT, detail: `${text.length} characters` },
    { id: "program", label: "Names the program", pass: !!s.program && text.toLowerCase().includes(s.program.toLowerCase()), detail: s.program ? `Looks for "${s.program}"` : "No program given" },
    {
      id: "categories", label: "Expense categories with amounts", pass: parsed.length > 0,
      detail: parsed.length ? parsed.map((p) => `${p.category} ${fmt(p.cents)}`).join("; ") : "No ED 524 category followed by an amount",
    },
    {
      id: "sum", label: "Amounts add up to the request", pass: parsed.length > 0 && total === s.amountCents,
      detail: parsed.length ? `${fmt(total)} named vs ${fmt(s.amountCents)} requested` : `${fmt(s.amountCents)} requested, nothing named`,
    },
    {
      id: "dates", label: "Start and end dates", pass: dates.length >= 2 && dates[0] <= dates[dates.length - 1],
      detail: dates.length >= 2 ? `${dates[0]} to ${dates[dates.length - 1]}` : dates.length ? "Only one date" : "No dates",
    },
    { id: "personal", label: "No personal information", pass: !personal, detail: personal ? "SSN, email or phone number found" : "None found" },
  ];
  return { submission: s, parsed, dates, checks, ready: checks.every((c) => c.pass) };
}

export const QUEUE_COLUMNS = ["grantee", "program", "award_number", "amount", "justification"] as const;
