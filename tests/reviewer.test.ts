import { describe, expect, it } from "vitest";
import { reviewSubmission } from "@/engine/reviewer";
import { SAMPLE_QUEUE } from "@/samples/queue";

const failing = (justification: string, amountCents = 1036100, program = "Title I") =>
  reviewSubmission({ grantee: "x", program, awardNumber: "S010A26DEMO", amountCents, justification }).checks.filter((c) => !c.pass).map((c) => c.id);

describe("state reviewer check", () => {
  it("passes a complete justification", () => {
    expect(failing("Title I S010A26DEMO: Personnel $8,200; Fringe Benefits $2,161. Expenses 10/01/26-10/31/26. Reimbursement of paid salaries for reading interventionists.")).toEqual([]);
  });
  it("flags HHS's 'payroll' example on every element", () => {
    expect(failing("payroll")).toEqual(["program", "categories", "sum", "dates"]);
  });
  it("catches amounts that don't add up to the request", () => {
    expect(failing("Title I: Personnel $8,200; Fringe Benefits $2,000. 10/01/26-10/31/26.")).toEqual(["sum"]);
  });
  it("needs both dates in order", () => {
    expect(failing("Title I: Personnel $8,200; Fringe Benefits $2,161. Expenses through 10/31/26.")).toEqual(["dates"]);
    expect(failing("Title I: Personnel $8,200; Fringe Benefits $2,161. 10/31/26-10/01/26.")).toEqual(["dates"]);
  });
  it("catches length and personal information", () => {
    expect(failing(`Title I: Personnel $8,200; Fringe Benefits $2,161. 10/01/26-10/31/26. ${"x".repeat(200)}`)).toContain("length");
    expect(failing("Title I: Personnel $8,200; Fringe Benefits $2,161. 10/01/26-10/31/26. Contact j.doe@district.org")).toContain("personal");
  });
  it("reads category names case-insensitively and amounts with or without cents", () => {
    const r = reviewSubmission({ grantee: "x", program: "Title I", awardNumber: "", amountCents: 1036100, justification: "title i: personnel $8,200.00; fringe benefits: $2,161 10/1/2026-10/31/2026" });
    expect(r.parsed).toEqual([{ category: "Personnel", cents: 820000 }, { category: "Fringe Benefits", cents: 216100 }]);
    expect(r.ready).toBe(true);
  });
  it("the sample queue has both ready and follow-up rows", () => {
    const results = SAMPLE_QUEUE.map(reviewSubmission);
    expect(results.filter((r) => r.ready).length).toBeGreaterThan(0);
    expect(results.filter((r) => !r.ready).length).toBeGreaterThan(0);
  });
});
