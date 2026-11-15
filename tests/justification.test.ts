import { describe, expect, it } from "vitest";
import { justificationPasses, templateJustification, verifyJustification, type JustificationContext } from "@/engine/justification";

const ctx: JustificationContext = {
  programName: "Upward Bound",
  awardNumber: "P047A26DEMO",
  basis: "advance",
  totals: [
    { category: "Personnel", cents: 646154 },
    { category: "Fringe Benefits", cents: 193846 },
    { category: "Supplies", cents: 418800 },
  ],
  startIso: "2026-10-25",
  endIso: "2026-11-13",
  personalNames: ["Kendra Ortiz"],
};
const failed = (text: string) => verifyJustification(text, ctx).filter((c) => !c.pass && c.required).map((c) => c.id);

describe("justification checks", () => {
  it("accepts a complete justification", () => {
    const t = "Upward Bound P047A26DEMO: Personnel $6,461.54; Fringe Benefits $1,938.46; Supplies $4,188. Planned disbursements for staff payroll and lab Chromebooks, expenses 10/25/26-11/13/26.";
    expect(failed(t)).toEqual([]);
  });
  it("catches a vague justification like HHS's 'payroll' example", () => {
    expect(failed("payroll")).toEqual(["program", "categories", "sum", "dates"]);
  });
  it("catches a wrong amount and an extra category", () => {
    const t = "Upward Bound: Personnel $6,461; Fringe Benefits $1,938.46; Supplies $4,188; Equipment $5,890. Expenses 10/25/26-11/13/26.";
    expect(failed(t)).toEqual(expect.arrayContaining(["categories", "no-extra-categories"]));
  });
  it("does not let $4,188 match $4,188.50", () => {
    const t = "Upward Bound: Personnel $6,461.54; Fringe Benefits $1,938.46; Supplies $4,188.50. Expenses 10/25/26-11/13/26.";
    expect(failed(t)).toContain("categories");
  });
  it("enforces 255 characters", () => {
    const t = "Upward Bound: Personnel $6,461.54; Fringe Benefits $1,938.46; Supplies $4,188. Expenses 10/25/26-11/13/26. " + "x".repeat(200);
    expect(failed(t)).toContain("length");
  });
  it("rejects personal names and SSNs", () => {
    const t = "Upward Bound: Personnel $6,461.54; Fringe Benefits $1,938.46; Supplies $4,188. Kendra Ortiz 123-45-6789. 10/25/26-11/13/26.";
    expect(failed(t)).toContain("no-personal-data");
  });
  it("template fallback passes its own checks", () => {
    const t = templateJustification(ctx);
    expect(justificationPasses(verifyJustification(t, ctx))).toBe(true);
    expect(t.length).toBeLessThanOrEqual(255);
  });
});
