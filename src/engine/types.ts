export type PaymentBasis = "advance" | "reimbursement";

export const ED524_CATEGORIES = [
  "Personnel",
  "Fringe Benefits",
  "Travel",
  "Equipment",
  "Supplies",
  "Contractual",
  "Construction",
  "Other",
  "Training Stipends",
  "Indirect Costs",
] as const;

export type Category = (typeof ED524_CATEGORIES)[number];

export interface Award {
  awardNumber: string;
  programName: string;
  assistanceListing: string;
  recipient: string;
  budgetPeriodStart: string;
  budgetPeriodEnd: string;
  paymentBasis: PaymentBasis;
  /** Business days between the request and the last planned disbursement, from the recipient's written cash procedures. */
  advanceWindowDays: number;
  /** Recipient's capitalization level; §200.1 uses the lesser of this and $10,000. */
  capitalizationThreshold: number;
  requestDate: string;
}

export interface BudgetLine {
  category: Category;
  approvedCents: number;
}

export type LedgerStatus = "paid" | "scheduled";

export interface LedgerRow {
  id: string;
  line: number;
  incurredDate: string;
  paymentDate: string;
  status: LedgerStatus;
  payee: string;
  payeeType: "vendor" | "employee" | "participant" | "internal";
  description: string;
  account: string;
  category: Category;
  amountCents: number;
  documentId: string;
  drawnIn: string;
}

export interface AwardTerm {
  id: string;
  title: string;
  text: string;
}

export interface SupportingDocument {
  id: string;
  text: string;
}

export interface ReviewInput {
  award: Award;
  budget: BudgetLine[];
  ledger: LedgerRow[];
  terms: AwardTerm[];
  documents: SupportingDocument[];
  selectedRowIds: string[];
}

/** error = proven by code, must be fixed before submitting. review = needs a person's judgment. */
export type Severity = "error" | "review" | "info";
export type FindingSource = "code" | "serv";

export interface Citation {
  kind: "cfr" | "term" | "guidance" | "document";
  ref: string;
  quote: string;
  url?: string;
}

export interface Finding {
  id: string;
  code: string;
  severity: Severity;
  source: FindingSource;
  rowIds: string[];
  title: string;
  detail: string;
  amountCents?: number;
  citations: Citation[];
  /** SERV found it and code confirmed the quoted evidence exists in the source. */
  verified?: boolean;
}
