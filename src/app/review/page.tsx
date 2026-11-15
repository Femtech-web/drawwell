import type { Metadata } from "next";
import { Workspace } from "@/components/workspace/Workspace";

export const metadata: Metadata = { title: "Review a drawdown · Drawwell" };

export default function ReviewPage() {
  return <Workspace />;
}
