import { JournalScopedStatusPolish } from "@/components/journal/JournalScopedStatusPolish";

export default function JournalEntryLayout({
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
