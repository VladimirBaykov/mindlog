"use client";

import { useMemo } from "react";
import { usePathname, useRouter } from "next/navigation";
import {
  getActiveBottomNavTab,
  shouldShowBottomNav,
  type BottomNavTab,
} from "@/lib/navigation";

type NavItem = {
  key: BottomNavTab;
  label: string;
  href: string;
};

const items: NavItem[] = [
  {
    key: "journal",
    label: "Journal",
    href: "/journal",
  },
  {
    key: "chat",
    label: "Chat",
    href: "/chat",
  },
  {
    key: "stats",
    label: "Stats",
    href: "/stats",
  },
  {
    key: "profile",
    label: "Profile",
    href: "/profile",
  },
];

function JournalIcon({ active }: { active: boolean }) {
  return (
    <svg
      viewBox="0 0 24 24"
      className={`h-5 w-5 ${active ? "opacity-100" : "opacity-80"}`}
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M7 4.5h8.5A2.5 2.5 0 0 1 18 7v12H8a3 3 0 0 0-3 3V7.5A3 3 0 0 1 8 4.5Z" />
      <path d="M8 4.5V19" />
      <path d="M10.5 9h4.5" />
      <path d="M10.5 12.5h4.5" />
    </svg>
  );
}

function ChatIcon({ active }: { active: boolean }) {
  return (
    <svg
      viewBox="0 0 24 24"
      className={`h-5 w-5 ${active ? "opacity-100" : "opacity-80"}`}
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M6 18.5l-2.5 2V7a3 3 0 0 1 3-3h11a3 3 0 0 1 3 3v7a3 3 0 0 1-3 3H6Z" />
      <path d="M8 9h8" />
      <path d="M8 12.5h5" />
    </svg>
  );
}

function StatsIcon({ active }: { active: boolean }) {
  return (
    <svg
      viewBox="0 0 24 24"
      className={`h-5 w-5 ${active ? "opacity-100" : "opacity-80"}`}
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M5 19.5h14" />
      <path d="M7.5 16V10.5" />
      <path d="M12 16V7.5" />
      <path d="M16.5 16v-4" />
    </svg>
  );
}

function ProfileIcon({ active }: { active: boolean }) {
  return (
    <svg
      viewBox="0 0 24 24"
      className={`h-5 w-5 ${active ? "opacity-100" : "opacity-80"}`}
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M12 12a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7Z" />
      <path d="M5 19.5a7 7 0 0 1 14 0" />
    </svg>
  );
}

function NavIcon({
  tab,
  active,
}: {
  tab: BottomNavTab;
  active: boolean;
}) {
  if (tab === "journal") return <JournalIcon active={active} />;
  if (tab === "chat") return <ChatIcon active={active} />;
  if (tab === "stats") return <StatsIcon active={active} />;
  return <ProfileIcon active={active} />;
}

export function BottomNav() {
  const pathname = usePathname();
  const router = useRouter();

  const isVisible = shouldShowBottomNav(pathname);

  const activeTab = useMemo(
    () => getActiveBottomNavTab(pathname),
    [pathname]
  );

  if (!isVisible) {
    return null;
  }

  return (
    <div className="fixed inset-x-0 bottom-0 z-40">
      <div className="pointer-events-none absolute inset-x-0 bottom-full h-20 bg-gradient-to-t from-[#0a0a0a] via-[#0a0a0a]/75 to-transparent" />

      <div className="border-t border-white/10 bg-[#0a0a0a]/92 backdrop-blur-xl">
        <div className="mx-auto max-w-xl px-3 pb-[calc(env(safe-area-inset-bottom)+10px)] pt-2">
          <div className="grid grid-cols-4 gap-1">
            {items.map((item) => {
              const active = activeTab === item.key;

              return (
                <button
                  key={item.key}
                  onClick={() => router.push(item.href)}
                  className={`flex flex-col items-center justify-center gap-1 rounded-2xl px-3 py-2.5 transition ${
                    active
                      ? "bg-white/[0.08] text-white"
                      : "text-neutral-400 hover:bg-white/[0.04] hover:text-white"
                  }`}
                >
                  <NavIcon tab={item.key} active={active} />
                  <span className="text-[11px] font-medium tracking-[0.01em]">
                    {item.label}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}