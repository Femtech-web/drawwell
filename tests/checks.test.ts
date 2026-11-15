import { describe, expect, it } from "vitest";
import { businessDaysBetween } from "@/engine/dates";
import { runChecks } from "@/engine/checks";
import { sampleInput } from "@/samples";

const codes = (id: string) => runChecks(sampleInput(id)).findings.map((f) => `${f.severity}:${f.code}:${f.rowIds[0] ?? ""}`).sort();

describe("business days", () => {
  it("skips weekends", () => {
    expect(businessDaysBetween("2026-11-16", "2026-11-18")).toBe(2);
    expect(businessDaysBetween("2026-11-13", "2026-11-16")).toBe(1);
    expect(businessDaysBetween("2026-11-16", "2026-11-30")).toBe(10);
  });
});

describe("code checks on the samples", () => {
  it("Upward Bound: duplicate invoice, advance window, equipment threshold, supplies over budget", () => {
    expect(codes("upward-bound")).toEqual([
      "error:DUPLICATE_DOCUMENT:L-1112",
      "error:OUTSIDE_ADVANCE_WINDOW:L-1111",
      "review:EQUIPMENT_THRESHOLD:L-1110",
      "review:OVER_CATEGORY_BUDGET:L-1104",
    ]);
  });
  it("Community schools: out of period, unpaid on reimbursement, lookalike, travel over budget", () => {
    expect(codes("community-schools")).toEqual([
      "error:NOT_YET_PAID:E-1009",
      "error:OUTSIDE_BUDGET_PERIOD:E-1008",
      "review:OVER_CATEGORY_BUDGET:E-1005",
      "review:POSSIBLE_DUPLICATE:E-1007",
    ]);
  });
  it("Talent Search: only the planted instruction is flagged by code", () => {
    expect(codes("talent-search")).toEqual(["review:INSTRUCTION_IN_DATA:N-1105"]);
  });
  it("salary and fringe sharing one payroll register are not duplicates", () => {
    expect(codes("upward-bound").some((c) => c.includes("L-1101") || c.includes("L-1102"))).toBe(false);
  });
  it("blocks the whole request when it exceeds the award balance", () => {
    const input = sampleInput("talent-search");
    input.budget = input.budget.map((b) => ({ ...b, approvedCents: 1000 }));
    expect(runChecks(input).findings.some((f) => f.code === "OVER_AWARD_TOTAL" && f.severity === "error")).toBe(true);
  });
  it("every code citation quotes the eCFR snapshot", () => {
    for (const id of ["upward-bound", "community-schools", "talent-search"]) {
      for (const f of runChecks(sampleInput(id)).findings) for (const c of f.citations) expect(c.quote.length).toBeGreaterThan(20);
    }
  });
});
