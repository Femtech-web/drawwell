const PATTERNS = [
  /ignore (all |any )?(previous|prior|above|earlier) (instructions|rules|guidance)/i,
  /disregard (the |all |any )?(previous|prior|above|system|rules|instructions)/i,
  /(mark|classify|treat|label|approve) (this|these|it|all)( \w+){0,3} as (allowable|approved|compliant)/i,
  /\b(system|assistant|developer)\s*(prompt|message|override)?\s*:/i,
  /you are (now )?(an?|the) (ai|assistant|reviewer|auditor)/i,
  /do not (flag|report|mention)/i,
  /new instructions?/i,
];

/** Returns the matched phrase if the text looks like it is giving orders to an AI reviewer. */
export function findInjection(text: string): string | null {
  for (const p of PATTERNS) {
    const m = text.match(p);
    if (m) return m[0];
  }
  return null;
}
