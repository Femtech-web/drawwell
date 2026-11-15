export interface GuidanceSource {
  id: string;
  title: string;
  publisher: string;
  date: string;
  url: string;
  /** How the wording below was obtained; a quote is only marked verbatim when we read it in that source. */
  provenance: string;
  points: { text: string; verbatim: boolean }[];
}

export const ED_G5_GUIDANCE: GuidanceSource[] = [
  {
    id: "ed-memo-2026-09-28",
    title: "Payment justification memo to all Department of Education grant recipients",
    publisher: "U.S. Department of Education, Office of Planning, Evaluation and Policy Development (Murray Bessette)",
    date: "2026-09-28",
    url: "https://www.k12dive.com/news/education-department-wants-grantees-to-defend-the-spend-DOGE/831743/",
    provenance: "Quoted by K-12 Dive, Oct. 1, 2026. Effective Nov. 1, 2026 for all ED grant recipients.",
    points: [
      { text: "clear, detailed justifications for each payment request", verbatim: true },
      { text: "can be no longer than 255 characters", verbatim: true },
      { text: "clear without additional narrative", verbatim: true },
      { text: "Each request must list the program name, expense categories and amounts, and the start and end dates for expenses.", verbatim: false },
      { text: "A flagged justification triggers an email asking for more explanation; the payment is processed after the request is updated.", verbatim: false },
    ],
  },
  {
    id: "ed-g5-guide-2026-09-28",
    title: "G5 Grantee Dashboard: Submitting Payment Requests and Payment Justifications",
    publisher: "U.S. Department of Education",
    date: "2026-09-28",
    url: "https://www.ed.gov/media/document/g5-grantee-dashboard-submitting-payments-requests-and-payment-justifications-september-28-2026-114638.pdf",
    provenance: "Official G5 walkthrough. Points summarized from the guide; open the PDF for exact wording.",
    points: [
      { text: "Each award eligible for a drawdown has its own justification Comment box, limited to 255 characters.", verbatim: false },
      { text: "The justification explains the purpose and planned use of the requested payment.", verbatim: false },
      { text: "The Comment can be edited until the payment is made.", verbatim: false },
    ],
  },
];

export const JUSTIFICATION_LIMIT = 255;
