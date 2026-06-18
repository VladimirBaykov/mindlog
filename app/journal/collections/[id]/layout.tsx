import { JournalScopedStatusPolish } from "@/components/journal/JournalScopedStatusPolish";

export default function JournalCollectionDetailLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <>
      <JournalScopedStatusPolish />
      {children}
    </>
  );
}
