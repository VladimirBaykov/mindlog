"use client";

import { useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useHeader } from "@/components/header/HeaderContext";
import JournalList from "@/components/JournalList";
import AuthGate from "@/components/AuthGate";
import { supabase } from "@/lib/supabase-browser";

export default function JournalPage() {
  const { setHeader, resetHeader } = useHeader();
  const router = useRouter();

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

      menuItems: [
        {
          label: "Stats",
          onClick: () => router.push("/stats"),
        },
        {
          label: "Logout",
          danger: true,
          onClick: async () => {
            await supabase.auth.signOut();
            router.refresh();
            router.push("/sign-in");
          },
        },
      ],
    });

    return () => {
      resetHeader();
    };
  }, [router, resetHeader, setHeader]);

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