"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import AuthGate from "@/components/AuthGate";
import { useHeader } from "@/components/header/HeaderContext";
import { supabase } from "@/lib/supabase-browser";

type UserInfo = {
  email: string | null;
  id: string | null;
};

export default function ProfilePage() {
  const router = useRouter();
  const { setHeader, resetHeader } = useHeader();

  const [userInfo, setUserInfo] = useState<UserInfo>({
    email: null,
    id: null,
  });

  useEffect(() => {
    setHeader({
      title: "Profile",
      leftSlot: (
        <button
          onClick={() => router.push("/journal")}
          className="text-sm text-neutral-400 hover:text-white transition"
        >
          ← Journal
        </button>
      ),
      menuItems: [
        {
          label: "Stats",
          onClick: () => router.push("/stats"),
        },
        {
          label: "New conversation",
          onClick: () => router.push("/"),
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

    return () => resetHeader();
  }, [router, resetHeader, setHeader]);

  useEffect(() => {
    async function loadUser() {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      setUserInfo({
        email: user?.email ?? null,
        id: user?.id ?? null,
      });
    }

    loadUser();
  }, []);

  return (
    <AuthGate>
      <div className="min-h-screen bg-black text-white">
        <div className="mx-auto max-w-xl px-4 pt-24 pb-24 space-y-6">
          <div className="rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-4">
            <div className="text-xs text-neutral-500">
              Signed in as
            </div>
            <div className="mt-2 text-base font-medium text-white break-all">
              {userInfo.email || "Loading..."}
            </div>
          </div>

          <div className="rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-4">
            <div className="text-sm font-medium text-white">
              Account
            </div>

            <div className="mt-4 space-y-3">
              <button
                onClick={() => router.push("/journal")}
                className="flex w-full items-center justify-between rounded-xl border border-white/8 bg-white/[0.02] px-4 py-3 text-left text-sm text-neutral-200 transition hover:bg-white/[0.04]"
              >
                <span>Open Journal</span>
                <span className="text-neutral-500">→</span>
              </button>

              <button
                onClick={() => router.push("/stats")}
                className="flex w-full items-center justify-between rounded-xl border border-white/8 bg-white/[0.02] px-4 py-3 text-left text-sm text-neutral-200 transition hover:bg-white/[0.04]"
              >
                <span>Reflection Stats</span>
                <span className="text-neutral-500">→</span>
              </button>

              <button
                onClick={() => router.push("/")}
                className="flex w-full items-center justify-between rounded-xl border border-white/8 bg-white/[0.02] px-4 py-3 text-left text-sm text-neutral-200 transition hover:bg-white/[0.04]"
              >
                <span>New Conversation</span>
                <span className="text-neutral-500">→</span>
              </button>
            </div>
          </div>

          <div className="rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-4">
            <div className="text-sm font-medium text-white">
              Session
            </div>

            <div className="mt-4">
              <button
                onClick={async () => {
                  await supabase.auth.signOut();
                  router.refresh();
                  router.push("/sign-in");
                }}
                className="w-full rounded-xl bg-white px-4 py-3 text-sm font-medium text-black transition hover:opacity-90"
              >
                Logout
              </button>
            </div>
          </div>

          {userInfo.id && (
            <div className="rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-4">
              <div className="text-xs text-neutral-500">
                User ID
              </div>
              <div className="mt-2 break-all text-xs text-neutral-400">
                {userInfo.id}
              </div>
            </div>
          )}
        </div>
      </div>
    </AuthGate>
  );
}