import { describe, expect, it } from "vitest";
import { parseBudgetCsv, parseLedgerCsv } from "@/engine/csv";
import { formatMoney, parseMoney } from "@/engine/money";

const HEADER = "row_id,incurred_date,payment_date,status,payee,payee_type,description,account,budget_category,amount,document,drawn_in";

describe("money", () => {
  it("parses dollars into exact cents", () => {
    expect(parseMoney("$1,236.00")).toBe(123600);
    expect(parseMoney("0.1")).toBe(10);
    expect(parseMoney("6461.54")).toBe(646154);
    expect(parseMoney("12.345")).toBeNull();
    expect(parseMoney("abc")).toBeNull();
  });
  it("formats cents", () => {
    expect(formatMoney(646154)).toBe("$6,461.54");
    expect(formatMoney(123600)).toBe("$1,236");
    expect(formatMoney(123600, { forceCents: true })).toBe("$1,236.00");
  });
});

describe("budget csv", () => {
  it("rejects categories outside ED 524 with the line number", () => {
    const r = parseBudgetCsv("category,approved\nPersonnel,100\nSnacks,20\n");
    expect(r.rows).toHaveLength(1);
    expect(r.issues[0]).toMatchObject({ line: 3 });
    expect(r.issues[0].message).toContain("Snacks");
  });
  it("reports missing columns", () => {
    expect(parseBudgetCsv("name,amount\nPersonnel,1\n").issues[0].message).toContain("category");
  });
});

describe("ledger csv", () => {
  it("accepts M/D/YYYY dates and quoted commas", () => {
    const r = parseLedgerCsv(`${HEADER}\nL-1,11/4/2026,11/6/2026,paid,"Barnes & Noble, Inc",vendor,"Workbooks, 40",6420,Supplies,"1,236.00",R-1,\n`);
    expect(r.issues).toEqual([]);
    expect(r.rows[0]).toMatchObject({ incurredDate: "2026-11-04", amountCents: 123600, payee: "Barnes & Noble, Inc" });
  });
  it("flags each bad field with its line", () => {
    const r = parseLedgerCsv(`${HEADER}\nL-1,2026-13-01,2026-11-06,paid,X,vendor,d,a,Supplies,1,,\nL-2,2026-11-01,2026-11-06,pending,X,vendor,d,a,Supplies,1,,\nL-1,2026-11-01,2026-11-06,paid,X,vendor,d,a,Supplies,1,,\n`);
    expect(r.issues.map((i) => i.line)).toEqual([2, 3]);
    expect(r.rows.map((x) => x.id)).toEqual(["L-1"]);
  });
  it("reports missing columns by name", () => {
    expect(parseLedgerCsv("row_id,amount\nL-1,5\n").issues[0].message).toContain("incurred_date");
  });
});
