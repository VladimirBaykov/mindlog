import type { ReactNode } from "react";
import { CollectionsPageBehavior } from "@/components/journal/CollectionsPageBehavior";

export default function JournalCollectionsLayout({
  children,
}: {
  children: ReactNode;
}) {
  return (
    <>
      <CollectionsPageBehavior />
      {children}
    </>
  );
}
