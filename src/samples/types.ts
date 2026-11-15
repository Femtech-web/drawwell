import type { Award, AwardTerm, SupportingDocument } from "@/engine/types";

export interface SampleSource {
  id: string;
  order: number;
  label: string;
  summary: string;
  award: Award;
  terms: AwardTerm[];
  budgetCsv: string;
  ledgerCsv: string;
  documents: SupportingDocument[];
}
