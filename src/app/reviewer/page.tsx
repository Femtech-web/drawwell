import type { Metadata } from "next";
import { ReviewerQueue } from "@/components/reviewer/ReviewerQueue";

export const metadata: Metadata = { title: "State reviewer · Drawwell" };

export default function ReviewerPage() {
  return <ReviewerQueue />;
}
