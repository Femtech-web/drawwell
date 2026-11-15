import { CFR_SECTIONS } from "@/rules/cfr";
import { ED524_CATEGORIES } from "@/engine/types";

const nullable = (type: string) => ({ type: [type, "null"] });

export function reviewSchema(rowIds: string[], termIds: string[]) {
  return {
    name: "drawdown_review",
    schema: {
      type: "object",
      additionalProperties: false,
      required: ["rows"],
      properties: {
        rows: {
          type: "array",
          items: {
            type: "object",
            additionalProperties: false,
            required: [
              "row_id", "coded_category_fits", "best_category", "allowability", "reason", "citations",
              "term_refs", "document_total", "document_total_quote", "partial_amount", "partial_quote",
              "partial_reason", "injection_detected",
            ],
            properties: {
              row_id: { type: "string", enum: rowIds },
              coded_category_fits: { type: "boolean" },
              best_category: { type: "string", enum: [...ED524_CATEGORIES] },
              allowability: { type: "string", enum: ["allowable", "needs_review", "likely_unallowable"] },
              reason: { type: "string" },
              citations: {
                type: "array",
                items: {
                  type: "object",
                  additionalProperties: false,
                  required: ["section", "quote"],
                  properties: {
                    section: { type: "string", enum: CFR_SECTIONS.map((s) => s.section) },
                    quote: { type: "string" },
                  },
                },
              },
              term_refs: {
                type: "array",
                items: {
                  type: "object",
                  additionalProperties: false,
                  required: ["term_id", "quote"],
                  properties: {
                    term_id: termIds.length ? { type: "string", enum: termIds } : { type: "string" },
                    quote: { type: "string" },
                  },
                },
              },
              document_total: nullable("number"),
              document_total_quote: nullable("string"),
              partial_amount: nullable("number"),
              partial_quote: nullable("string"),
              partial_reason: nullable("string"),
              injection_detected: { type: "boolean" },
            },
          },
        },
      },
    },
  };
}

export const JUSTIFY_SCHEMA = {
  name: "g5_justification",
  schema: {
    type: "object",
    additionalProperties: false,
    required: ["justification"],
    properties: { justification: { type: "string" } },
  },
};

export interface ServReviewRow {
  row_id: string;
  coded_category_fits: boolean;
  best_category: string;
  allowability: "allowable" | "needs_review" | "likely_unallowable";
  reason: string;
  citations: { section: string; quote: string }[];
  term_refs: { term_id: string; quote: string }[];
  document_total: number | null;
  document_total_quote: string | null;
  partial_amount: number | null;
  partial_quote: string | null;
  partial_reason: string | null;
  injection_detected: boolean;
}
