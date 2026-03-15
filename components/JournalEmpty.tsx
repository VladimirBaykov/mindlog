import Link from "next/link";

export default function JournalEmpty() {
  return (
    <div className="mt-20 text-center text-neutral-400">
      <p className="mb-4 text-sm">
        You don’t have any saved conversations yet.
      </p>

      <Link
        href="/"
        className="text-sm text-white underline underline-offset-4"
      >
        Start your first conversation
      </Link>
    </div>
  );
}
