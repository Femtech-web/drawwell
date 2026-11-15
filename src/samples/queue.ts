import type { Submission } from "@/engine/reviewer";

/** Fictional districts and synthetic submissions for the state reviewer view. */
export const SAMPLE_QUEUE: Submission[] = [
  {
    grantee: "Maple Valley USD (fictional)", program: "Title I", awardNumber: "S010A26DEMO", amountCents: 1036100,
    justification: "Title I S010A26DEMO: Personnel $8,200; Fringe Benefits $2,161. Expenses 10/01/26-10/31/26. Reimbursement of paid salaries for reading interventionists.",
  },
  { grantee: "Cedar Ridge SD (fictional)", program: "IDEA Part B", awardNumber: "H027A26DEMO", amountCents: 485000, justification: "payroll" },
  {
    grantee: "Riverside County Schools (fictional)", program: "Title IV-A", awardNumber: "S424A26DEMO", amountCents: 312000,
    justification: "Title IV-A: Supplies $1,870; Contractual $1,250. Classroom technology and counselor training, 09/15/26-10/20/26.",
  },
  {
    grantee: "Lakeshore Academy (fictional)", program: "Perkins CTE", awardNumber: "V048A26DEMO", amountCents: 1240000,
    justification: "Perkins CTE: Equipment $9,800; Supplies $2,000. Welding lab equipment and consumables for October 2026.",
  },
  {
    grantee: "Pine Hollow USD (fictional)", program: "Title I", awardNumber: "S010A26DEMO", amountCents: 752550,
    justification: "Title I: Personnel $5,600.00; Fringe Benefits $1,425.50; Supplies $500. Tutors and reading materials 10/01/26-10/31/26. Reimbursement of paid costs.",
  },
  {
    grantee: "North Fork SD (fictional)", program: "21st CCLC", awardNumber: "S287C26DEMO", amountCents: 604000,
    justification: "21st CCLC: Personnel $4,600; Fringe $1,440. Afterschool staff 10/01/26-10/31/26.",
  },
  {
    grantee: "Harbor Bay Schools (fictional)", program: "Title III", awardNumber: "S365A26DEMO", amountCents: 298000,
    justification: "Title III EL: Contractual $2,980. Translation services 10/05/26-10/28/26; questions to m.lopez@harborbay.example.org",
  },
  {
    grantee: "Summit Valley USD (fictional)", program: "IDEA Part B", awardNumber: "H027A26DEMO", amountCents: 1521475,
    justification: "IDEA Part B: Personnel $11,200.00; Fringe Benefits $3,014.75; Contractual $1,000.00. Expenses 10/01/26-10/31/26. Special education paraprofessional salaries and benefits for October, plus occupational therapy contract services for students with IEPs across three elementary campuses.",
  },
];
