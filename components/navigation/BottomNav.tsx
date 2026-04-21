"use client";

import { useEffect, useMemo, useState } from "react";
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
  { key: "journal", label: "Journal", href: "/journal" },
  { key: "chat", label: "Chat", href: "/chat" },
  { key: "stats", label: "Stats", href: "/stats" },
  { key: "profile", label: "Profile", href: "/profile" },
];

function JournalIcon({ active }: { active: boolean }) {
  return (
    <svg
      viewBox="0 0 24 24"
      className={`h-[18px] w-[18px] ${active ? "opacity-100" : "opacity-80"}`}
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
      className={`h-[18px] w-[18px] ${active ? "opacity-100" : "opacity-80"}`}
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
      className={`h-[18px] w-[18px] ${active ? "opacity-100" : "opacity-80"}`}
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
      className={`h-[18px] w-[18px] ${active ? "opacity-100" : "opacity-80"}`}
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

function NavHandle({
  expanded,
  onToggle,
}: {
  expanded: boolean;
  onToggle: () => void;
}) {
  return (
    <button
      onClick={onToggle}
      aria-label={expanded ? "Collapse navigation" : "Expand navigation"}
      className="mx-auto flex h-5 w-10 items-center justify-center rounded-full border border-white/10 bg-[#0b0b0b]/92 shadow-[0_8px_24px_rgba(0,0,0,0.28)] backdrop-blur-xl transition duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] hover:bg-[#111111]/96"
    >
      <span
        className={`block h-[2.5px] w-4.5 rounded-full bg-white/55 transition duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] ${
          expanded ? "scale-x-[0.8] opacity-80" : "scale-x-100 opacity-100"
        }`}
      />
    </button>
  );
}

export function BottomNav() {
  const pathname = usePathname();
  const router = useRouter();
  const [chatNavExpanded, setChatNavExpanded] = useState(false);
  const [hasChatDraft, setHasChatDraft] = useState(false);

  const isVisible = shouldShowBottomNav(pathname);
  const isChat = pathname.startsWith("/chat");

  const activeTab = useMemo(() => getActiveBottomNavTab(pathname), [pathname]);

  useEffect(() => {
    if (isChat) {
      setChatNavExpanded(false);
      return;
    }

    setChatNavExpanded(true);
  }, [isChat, pathname]);

  useEffect(() => {
    if (typeof window === "undefined") return;

    const expanded = isChat ? chatNavExpanded : false;
    document.body.dataset.chatNavExpanded = expanded ? "true" : "false";

    window.dispatchEvent(
      new CustomEvent("mindlog-chat-nav-change", {
        detail: { expanded },
      })
    );
  }, [isChat, chatNavExpanded]);

  useEffect(() => {
    if (typeof window === "undefined") return;

    const syncDraft = (hasDraft: boolean) => {
      setHasChatDraft(hasDraft);
    };

    syncDraft(document.body.dataset.chatHasDraft === "true");

    const handleDraftChange = (event: Event) => {
      const customEvent = event as CustomEvent<{ hasDraft?: boolean }>;
      syncDraft(Boolean(customEvent.detail?.hasDraft));
    };

    window.addEventListener(
      "mindlog-chat-draft-change",
      handleDraftChange as EventListener
    );

    return () => {
      window.removeEventListener(
        "mindlog-chat-draft-change",
        handleDraftChange as EventListener
      );
    };
  }, []);

  if (!isVisible) {
    return null;
  }

  const showCollapsedHandleOnly = isChat && !chatNavExpanded;

  function handleNavigation(href: string) {
    if (href === pathname) return;

    if (isChat && hasChatDraft) {
      window.dispatchEvent(
        new CustomEvent("mindlog-chat-before-leave", {
          detail: { href },
        })
      );
      return;
    }

    router.push(href);
  }

  return (
    <div className="fixed inset-x-0 bottom-0 z-40">
      {showCollapsedHandleOnly ? (
        <div className="pb-[calc(env(safe-area-inset-bottom)+4px)]">
          <NavHandle expanded={false} onToggle={() => setChatNavExpanded(true)} />
        </div>
      ) : (
        <>
          <div className="pointer-events-none absolute inset-x-0 bottom-full h-8 bg-gradient-to-t from-[#0a0a0a] via-[#0a0a0a]/58 to-transparent" />

          {isChat && (
            <div className="pb-1">
              <NavHandle expanded onToggle={() => setChatNavExpanded(false)} />
            </div>
          )}

          <div className="border-t border-white/10 bg-[#0a0a0a]/92 backdrop-blur-xl">
            <div className="mx-auto max-w-xl px-3 pb-[calc(env(safe-area-inset-bottom)+3px)] pt-1">
              <div className="grid grid-cols-4 gap-1">
                {items.map((item) => {
                  const active = activeTab === item.key;

                  return (
                    <button
                      key={item.key}
                      onClick={() => handleNavigation(item.href)}
                      className={`flex flex-col items-center justify-center gap-1 rounded-[18px] px-2.5 py-1.5 transition duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] ${
                        active
                          ? "bg-white/[0.08] text-white"
                          : "text-neutral-400 hover:bg-white/[0.04] hover:text-white"
                      }`}
                    >
                      <NavIcon tab={item.key} active={active} />
                      <span className="text-[10px] font-medium tracking-[0.01em]">
                        {item.label}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}