"use client";

import { useEffect } from "react";
import Link from "next/link";
import { useHeader } from "@/components/header/HeaderContext";
import JournalList from "@/components/JournalList";
import AuthGate from "@/components/AuthGate";

export default function JournalPage() {
  const { setHeader, resetHeader } = useHeader();

  useEffect(() => {
    setHeader({
      title: "Journal",
      rightSlot: (
        <Link
          href="/"
          className="text-sm text-neutral-400 hover:text-white transition"
        >
          New
        </Link>
      ),
    });

    return () => {
      resetHeader();
    };
  }, []);

  return (
    <AuthGate>
      <div className="h-screen overflow-hidden">
        <div className="h-full overflow-y-auto overscroll-contain">
          <div className="mx-auto max-w-xl px-4 pt-20 pb-24">
            <JournalList />
          </div>
        </div>
      </div>
    </AuthGate>
  );
}