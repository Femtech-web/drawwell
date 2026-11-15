import snapshot from "./2cfr200/all.json";

export interface CfrSection {
  section: string;
  heading: string;
  source: string;
  upToDateAsOf: string;
  paragraphs: string[];
}

export const CFR_SNAPSHOT_DATE: string = snapshot.upToDateAsOf;
export const CFR_SECTIONS: CfrSection[] = snapshot.sections as CfrSection[];
const BY_ID = new Map(CFR_SECTIONS.map((s) => [s.section, s]));

export function getSection(id: string): CfrSection | undefined {
  return BY_ID.get(id.replace(/^(2\s*CFR\s*)?§?\s*/i, "").trim());
}

export function normalizeForQuote(s: string): string {
  return s
    .toLowerCase()
    .replace(/[“”"]/g, '"')
    .replace(/[‘’']/g, "'")
    .replace(/[—–-]/g, "-")
    .replace(/§\s*/g, "§")
    .replace(/\s+/g, " ")
    .trim();
}

export const MIN_QUOTE_LENGTH = 20;

/** A quote counts only if it is long enough to mean something and appears word for word in the cited text. */
export function quoteAppearsIn(quote: string, text: string): boolean {
  const q = normalizeForQuote(quote).replace(/^\.{3}|\.{3}$/g, "").trim();
  if (q.length < MIN_QUOTE_LENGTH) return false;
  return normalizeForQuote(text).includes(q);
}

export function sectionText(section: CfrSection): string {
  return section.paragraphs.join("\n");
}

const DEFINITIONS_USED = [
  "Budget period", "Computing devices", "Equipment", "Improper payment",
  "Participant support costs", "Period of performance", "Supplies",
];

const PARAGRAPH_LIMITS: Record<string, number> = {
  "200.305": 8, "200.308": 12, "200.430": 8, "200.431": 4, "200.450": 6, "200.465": 4,
};

/** The subset of the snapshot SERV reads; citations are still verified against full sections. */
export function promptExcerpts(): { section: string; heading: string; text: string }[] {
  return CFR_SECTIONS.map((s) => {
    let paragraphs = s.paragraphs;
    if (s.section === "200.1") {
      paragraphs = paragraphs.filter((p) => DEFINITIONS_USED.some((d) => p.startsWith(`${d} means`)));
    } else if (PARAGRAPH_LIMITS[s.section]) {
      paragraphs = paragraphs.slice(0, PARAGRAPH_LIMITS[s.section]);
    }
    return { section: s.section, heading: s.heading, text: paragraphs.join("\n") };
  });
}

export function cfrUrl(section: string): string {
  return `https://www.ecfr.gov/current/title-2/section-${section}`;
}
