"use client";

import { useState, useRef, useEffect, useMemo } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import type { ChatMessage } from "@/types/chat";
import type { ChatState } from "@/types/chatState";
import { useHeader } from "@/components/header/HeaderContext";
import { useJournal } from "@/components/journal/JournalContext";
import ConfirmModal from "@/components/ui/ConfirmModal";
import { supabase } from "@/lib/supabase-browser";
import { trackClientEvent } from "@/lib/analytics-client";

type UsageInfo = {
  plan: "free" | "pro";
  status?: string;
  used: number;
  limit: number | null;
  remaining: number | null;
  canSave: boolean;
  currentPeriodEnd?: string | null;
  ai?: {
    maxMessagesPerConversation: number;
    maxCharactersPerMessage: number;
    maxTotalInputCharacters: number;
  };
};

type ApiErrorResponse = {
  error?: string;
  code?: string;
  upgradeUrl?: string | null;
  used?: number;
  limit?: number | null;
  canSave?: boolean;
  plan?: "free" | "pro";
};

type GoalOption =
  | "process_emotions"
  | "build_consistency"
  | "understand_patterns"
  | null;

type MoodOption = "gentle" | "balanced" | "direct" | null;
type NotificationOption = "yes" | "not_now" | null;

type UserPreferences = {
  goal: GoalOption;
  moodPreference: MoodOption;
  notifications: NotificationOption;
};

type CloseIntentSource = "header_close";

export default function Chat() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [chatState, setChatState] = useState<ChatState>("empty");
  const [isSaved, setIsSaved] = useState(false);
  const [showCloseConfirm, setShowCloseConfirm] = useState(false);
  const [showLeaveConfirm, setShowLeaveConfirm] = useState(false);
  const [pendingLeaveHref, setPendingLeaveHref] = useState<string | null>(null);
  const [usage, setUsage] = useState<UsageInfo | null>(null);
  const [usageLoading, setUsageLoading] = useState(true);
  const [limitError, setLimitError] = useState<string | null>(null);
  const [chatError, setChatError] = useState<string | null>(null);
  const [starterApplied, setStarterApplied] = useState(false);
  const [preferences, setPreferences] = useState<UserPreferences>({
    goal: null,
    moodPreference: null,
    notifications: null,
  });
  const [scrollTop, setScrollTop] = useState(0);
  const [isFocused, setIsFocused] = useState(false);
  const [isChatNavExpanded, setIsChatNavExpanded] = useState(false);

  const { setHeader, resetHeader } = useHeader();
  const { addItem } = useJournal();

  const scrollContainerRef = useRef<HTMLDivElement | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);

  const starter = searchParams.get("starter");
  const hasDraftConversation = messages.length > 0 && !isSaved;

  useEffect(() => {
    const el = scrollContainerRef.current;
    if (!el) return;

    requestAnimationFrame(() => {
      el.scrollTo({
        top: el.scrollHeight,
        behavior: messages.length > 1 ? "smooth" : "auto",
      });
    });
  }, [messages, loading]);

  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;

    el.style.height = "0px";
    el.style.height = `${Math.min(el.scrollHeight, 88)}px`;
  }, [input]);

  useEffect(() => {
    if (
      starter &&
      !starterApplied &&
      messages.length === 0 &&
      !input.trim()
    ) {
      setInput(starter);
      setStarterApplied(true);
      setChatState("active");
    }
  }, [starter, starterApplied, messages.length, input]);

  useEffect(() => {
    async function loadPreferences() {
      try {
        const {
          data: { user },
        } = await supabase.auth.getUser();

        setPreferences({
          goal: (user?.user_metadata?.onboarding_goal as GoalOption) ?? null,
          moodPreference:
            (user?.user_metadata?.onboarding_mood_preference as MoodOption) ??
            null,
          notifications:
            (user?.user_metadata?.onboarding_notifications as NotificationOption) ??
            null,
        });
      } catch (error) {
        console.error("Preference load failed:", error);
      }
    }

    loadPreferences();
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;

    const syncExpanded = (expanded: boolean) => {
      setIsChatNavExpanded(expanded);
    };

    syncExpanded(document.body.dataset.chatNavExpanded === "true");

    const handleNavChange = (event: Event) => {
      const customEvent = event as CustomEvent<{ expanded?: boolean }>;
      syncExpanded(Boolean(customEvent.detail?.expanded));
    };

    window.addEventListener(
      "mindlog-chat-nav-change",
      handleNavChange as EventListener
    );

    return () => {
      window.removeEventListener(
        "mindlog-chat-nav-change",
        handleNavChange as EventListener
      );
    };
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;

    document.body.dataset.chatHasDraft = hasDraftConversation ? "true" : "false";

    window.dispatchEvent(
      new CustomEvent("mindlog-chat-draft-change", {
        detail: { hasDraft: hasDraftConversation },
      })
    );
  }, [hasDraftConversation]);

  useEffect(() => {
    if (typeof window === "undefined") return;

    const handleBeforeLeave = (event: Event) => {
      const customEvent = event as CustomEvent<{ href?: string }>;
      const href = customEvent.detail?.href;

      if (!href) return;

      if (!hasDraftConversation) {
        router.push(href);
        return;
      }

      setPendingLeaveHref(href);
      setShowLeaveConfirm(true);
    };

    window.addEventListener(
      "mindlog-chat-before-leave",
      handleBeforeLeave as EventListener
    );

    return () => {
      window.removeEventListener(
        "mindlog-chat-before-leave",
        handleBeforeLeave as EventListener
      );
    };
  }, [hasDraftConversation, router]);

  const suggestedPrompts = useMemo(() => {
    if (preferences.goal === "process_emotions") {
      return [
        "I’ve been feeling emotionally heavy lately and want help understanding what’s underneath it.",
        "Something has been sitting with me all day, and I want to gently unpack what I’m really feeling.",
        "Help me reflect on an emotion I keep carrying but haven’t fully named yet.",
      ];
    }

    if (preferences.goal === "build_consistency") {
      return [
        "Help me do a calm end-of-day reflection so I can build a steady habit.",
        "I want a simple check-in about how today felt and what I should notice.",
        "Let’s start with a small reflection so I can keep showing up consistently.",
      ];
    }

    if (preferences.goal === "understand_patterns") {
      return [
        "I want to understand a pattern I keep repeating in my thoughts and reactions.",
        "Help me notice what emotional theme keeps showing up for me lately.",
        "I think I’ve been reacting in a familiar way again — help me reflect on that pattern.",
      ];
    }

    return [
      "I’ve been feeling emotionally scattered today and want help untangling it.",
      "Help me reflect on what has been draining my energy lately.",
      "I want to understand a pattern I keep repeating in my thoughts.",
    ];
  }, [preferences.goal]);

  const guidanceLabel = useMemo(() => {
    if (preferences.moodPreference === "gentle") {
      return "Gentle reflection tone active";
    }

    if (preferences.moodPreference === "balanced") {
      return "Balanced reflection tone active";
    }

    if (preferences.moodPreference === "direct") {
      return "Direct reflection tone active";
    }

    return "Your reflection space";
  }, [preferences.moodPreference]);

  async function loadUsage() {
    try {
      setUsageLoading(true);

      const res = await fetch("/api/account/usage", {
        cache: "no-store",
      });

      if (!res.ok) {
        throw new Error("Failed to load usage");
      }

      const data = (await res.json()) as UsageInfo;
      setUsage(data);
    } catch (error) {
      console.error("Usage load failed:", error);
      setUsage(null);
    } finally {
      setUsageLoading(false);
    }
  }

  useEffect(() => {
    loadUsage();
  }, []);

  async function openCloseFlow(source: CloseIntentSource) {
    if (messages.length === 0 || isSaved) {
      setShowCloseConfirm(true);
      return;
    }

    await trackClientEvent({
      eventName: "close_intent_started",
      page: "/chat",
      metadata: {
        source,
        messageCount: messages.length,
        plan: usage?.plan || "free",
        goal: preferences.goal,
      },
    });

    setShowCloseConfirm(true);
  }

  function resetChat() {
    setMessages([]);
    setInput("");
    setLoading(false);
    setChatState("empty");
    setIsSaved(false);
    setLimitError(null);
    setChatError(null);
    setPendingLeaveHref(null);
  }

  useEffect(() => {
    setHeader({
      title: "New conversation",
      menuItems: [
        {
          label: "New conversation",
          danger: true,
          onClick: resetChat,
        },
        {
          label: "Close conversation",
          highlight: true,
          onClick: () => {
            openCloseFlow("header_close");
          },
        },
      ],
    });

    return () => resetHeader();
  }, [messages, isSaved, setHeader, resetHeader, usage?.plan, preferences.goal]);

  function applySuggestedPrompt(prompt: string) {
    setInput(prompt);
    setChatState("active");
    setChatError(null);
    textareaRef.current?.focus();

    trackClientEvent({
      eventName: "chat_starter_selected",
      page: "/chat",
      metadata: {
        prompt,
        goal: preferences.goal,
        moodPreference: preferences.moodPreference,
      },
    });
  }

  async function closeConversation(nextHref?: string) {
    if (messages.length === 0 || isSaved) return;

    setLimitError(null);

    try {
      const res = await fetch("/api/conversation/close", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages }),
      });

      if (res.status === 403) {
        const data = (await res.json()) as ApiErrorResponse;

        if (data.code === "FREE_LIMIT_REACHED") {
          setLimitError(
            data.limit
              ? `You’ve reached your free plan limit of ${data.limit} saved entries. Upgrade to Pro to keep saving conversations.`
              : "You’ve reached your current plan limit."
          );

          await loadUsage();
          return;
        }
      }

      if (!res.ok) {
        throw new Error("Close failed");
      }

      const conversation = await res.json();

      addItem(conversation);
      setIsSaved(true);
      await loadUsage();

      await trackClientEvent({
        eventName: "conversation_saved",
        page: "/chat",
        metadata: {
          conversationId: conversation.id,
          messageCount: messages.length,
          goal: preferences.goal,
          plan: usage?.plan || "free",
        },
      });

      const successUrl = `/journal?celebrate=1&entry=${encodeURIComponent(
        conversation.id
      )}`;

      resetChat();
      window.location.href = nextHref || successUrl;
    } catch (err) {
      console.error(err);
    }
  }

  async function sendMessage() {
    if (!input.trim() || loading) return;

    setChatError(null);
    const currentInput = input.trim();

    if (
      usage?.ai?.maxCharactersPerMessage &&
      currentInput.length > usage.ai.maxCharactersPerMessage
    ) {
      setChatError(
        `This message is too long for your current plan. Maximum length: ${usage.ai.maxCharactersPerMessage} characters.`
      );
      return;
    }

    const userMessage: ChatMessage = {
      id: crypto.randomUUID(),
      role: "user",
      content: currentInput,
    };

    const nextMessages = [...messages, userMessage];

    if (
      usage?.ai?.maxMessagesPerConversation &&
      nextMessages.length > usage.ai.maxMessagesPerConversation
    ) {
      setChatError(
        usage.plan === "free"
          ? `You’ve reached the free plan conversation depth limit (${usage.ai.maxMessagesPerConversation} messages). Upgrade to Pro for deeper conversations.`
          : `This conversation has reached its current depth limit (${usage.ai.maxMessagesPerConversation} messages).`
      );
      return;
    }

    const totalInputCharacters = nextMessages.reduce(
      (sum, message) => sum + message.content.length,
      0
    );

    if (
      usage?.ai?.maxTotalInputCharacters &&
      totalInputCharacters > usage.ai.maxTotalInputCharacters
    ) {
      setChatError(
        usage.plan === "free"
          ? "You’ve reached the free plan context limit for this conversation. Upgrade to Pro or start a new reflection."
          : "This conversation has become too large. Start a new reflection to continue clearly."
      );
      return;
    }

    if (messages.length === 0) {
      await trackClientEvent({
        eventName: "chat_started",
        page: "/chat",
        metadata: {
          source: starter ? "onboarding_starter" : "manual",
          goal: preferences.goal,
          moodPreference: preferences.moodPreference,
          notifications: preferences.notifications,
          plan: usage?.plan || "free",
        },
      });
    }

    setMessages(nextMessages);
    setInput("");
    setLoading(true);
    setChatState("active");

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: nextMessages }),
      });

      const data = await res.json().catch(() => null);

      if (!res.ok) {
        const apiError = data as ApiErrorResponse | null;

        if (apiError?.code === "CHAT_DEPTH_LIMIT") {
          setChatError(
            apiError.plan === "free"
              ? `You’ve reached the free plan conversation depth limit (${apiError.limit} messages). Upgrade to Pro for deeper conversations.`
              : "This conversation has reached its depth limit."
          );
          setMessages(messages);
          return;
        }

        if (apiError?.code === "MESSAGE_TOO_LONG") {
          setChatError(
            apiError.limit
              ? `This message is too long. Maximum length: ${apiError.limit} characters.`
              : "This message is too long."
          );
          setMessages(messages);
          return;
        }

        if (apiError?.code === "TOTAL_CONTEXT_LIMIT") {
          setChatError(
            apiError.plan === "free"
              ? "You’ve reached the free plan context limit. Upgrade to Pro or start a new conversation."
              : "This conversation is too large to continue in one thread. Start a new reflection."
          );
          setMessages(messages);
          return;
        }

        setChatError(apiError?.error || "Something went wrong while sending.");
        setMessages(messages);
        return;
      }

      setMessages((prev) => [
        ...prev,
        {
          id: crypto.randomUUID(),
          role: "assistant",
          content: (data as { reply?: string })?.reply || "I’m here with you.",
        },
      ]);

      if ((data as { chatState?: ChatState })?.chatState) {
        setChatState((data as { chatState: ChatState }).chatState);
      }
    } catch (err) {
      console.error(err);
      setChatError("Something went quiet for a moment. Want to try again?");
      setMessages(messages);
    } finally {
      setLoading(false);
    }
  }

  const showEmptyState = messages.length === 0 && !loading;
  const hasScrolled = scrollTop > 8;

  const composerBottomClass = isChatNavExpanded
    ? "bottom-[calc(env(safe-area-inset-bottom)+76px)]"
    : "bottom-[calc(env(safe-area-inset-bottom)+30px)]";

  const footerFadeBottomClass = isChatNavExpanded
    ? "bottom-[146px]"
    : "bottom-[100px]";

  const scrollerBottomPaddingClass = isChatNavExpanded
    ? "pb-[194px]"
    : "pb-[148px]";

  const canSend = !!input.trim() && !loading;

  return (
    <div className="relative flex h-[calc(100dvh-64px)] flex-col overflow-hidden overscroll-none bg-black text-white">
      <div className="pointer-events-none fixed inset-x-0 top-[64px] z-10 h-7 bg-gradient-to-b from-black/18 to-transparent" />
      <div className="pointer-events-none fixed inset-x-0 bottom-0 z-0 h-[22vh] bg-[radial-gradient(circle_at_bottom,rgba(255,255,255,0.02),transparent_60%)]" />

      <div
        className={`pointer-events-none fixed inset-x-0 top-[64px] z-10 h-8 bg-gradient-to-b transition duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] ${
          hasScrolled ? "from-black/18 to-transparent" : "from-black/8 to-transparent"
        }`}
      />

      <div
        ref={scrollContainerRef}
        onScroll={(e) => setScrollTop(e.currentTarget.scrollTop)}
        className={`flex-1 overflow-y-auto overscroll-none px-4 pt-5 transition-[padding] duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] ${scrollerBottomPaddingClass}`}
      >
        <div className="mx-auto max-w-xl">
          {showEmptyState && (
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
              className="px-1 pb-5"
            >
              <div className="max-w-md">
                <div className="inline-flex rounded-full border border-white/10 bg-white/[0.04] px-3 py-1 text-[11px] uppercase tracking-[0.18em] text-neutral-300">
                  {guidanceLabel}
                </div>

                <h1 className="mt-4 text-[28px] font-semibold leading-tight text-white">
                  A quiet space
                  <br />
                  to reflect clearly.
                </h1>

                <p className="mt-3 max-w-sm text-sm leading-relaxed text-neutral-400">
                  Start with whatever feels present. When you’re ready, close the
                  conversation and save it to your journal.
                </p>

                {starter && (
                  <div className="mt-4 rounded-[24px] border border-white/10 bg-white/[0.03] px-4 py-4">
                    <div className="text-sm font-medium text-white">
                      Your first starter is ready
                    </div>
                    <p className="mt-2 text-sm leading-relaxed text-neutral-400">
                      We pre-filled a reflection prompt from onboarding. You can
                      send it as-is or edit it first.
                    </p>
                  </div>
                )}

                <div className="mt-4 rounded-[24px] border border-white/10 bg-white/[0.03] px-4 py-4">
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-xs uppercase tracking-[0.18em] text-neutral-500">
                      Plan
                    </span>
                    <span className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-1 text-xs text-neutral-300 capitalize">
                      {usageLoading ? "loading" : usage?.plan || "free"}
                    </span>
                  </div>

                  <p className="mt-3 text-sm text-neutral-300">
                    {usageLoading
                      ? "Checking your journal usage..."
                      : usage?.limit
                      ? `${usage.used}/${usage.limit} saved entries used`
                      : "Unlimited saved entries available"}
                  </p>

                  {typeof usage?.remaining === "number" && (
                    <p className="mt-2 text-xs text-neutral-500">
                      {usage.remaining > 0
                        ? `${usage.remaining} saves remaining on your current plan.`
                        : "You’ve reached your free plan limit. Upgrade to Pro to keep saving new conversations."}
                    </p>
                  )}
                </div>

                <div className="mt-4">
                  <div className="text-xs uppercase tracking-[0.18em] text-neutral-500">
                    Suggested starters
                  </div>

                  <div className="mt-3 flex flex-wrap gap-2">
                    {suggestedPrompts.map((prompt) => (
                      <button
                        key={prompt}
                        onClick={() => applySuggestedPrompt(prompt)}
                        className="rounded-full border border-white/10 bg-white/[0.03] px-3.5 py-2 text-left text-xs leading-relaxed text-neutral-300 transition hover:bg-white/[0.06] hover:text-white"
                      >
                        {prompt}
                      </button>
                    ))}
                  </div>
                </div>

                {limitError && (
                  <div className="mt-4 rounded-[24px] border border-amber-500/20 bg-amber-500/10 px-4 py-4">
                    <div className="text-sm font-medium text-white">
                      Save limit reached
                    </div>
                    <p className="mt-2 text-sm leading-relaxed text-neutral-300">
                      {limitError}
                    </p>

                    <button
                      onClick={() => {
                        window.location.href = "/upgrade";
                      }}
                      className="mt-4 rounded-[18px] bg-white px-4 py-3 text-sm font-medium text-black transition hover:opacity-90"
                    >
                      Upgrade to Pro
                    </button>
                  </div>
                )}
              </div>
            </motion.div>
          )}

          {!showEmptyState && chatError && (
            <div className="mb-4 rounded-[24px] border border-red-500/20 bg-red-500/10 px-4 py-4">
              <div className="text-sm font-medium text-white">
                AI conversation limit
              </div>
              <p className="mt-2 text-sm leading-relaxed text-neutral-300">
                {chatError}
              </p>
            </div>
          )}

          <div className="space-y-3">
            <AnimatePresence initial={false}>
              {messages.map((msg, index) => {
                const isUser = msg.role === "user";
                const previous = messages[index - 1];
                const groupedWithPrevious =
                  previous && previous.role === msg.role;

                return (
                  <motion.div
                    key={msg.id}
                    initial={{ opacity: 0, y: 10, scale: 0.985 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
                    className={`flex ${isUser ? "justify-end" : "justify-start"} ${
                      groupedWithPrevious ? "pt-1" : "pt-3"
                    }`}
                  >
                    <div
                      className={`max-w-[79%] rounded-[22px] border px-4 py-3 text-[14.5px] leading-[1.58] ${
                        isUser
                          ? "border-white/[0.08] bg-white/[0.07] text-white"
                          : "border-white/[0.06] bg-white/[0.035] text-neutral-200"
                      }`}
                    >
                      {msg.content}
                    </div>
                  </motion.div>
                );
              })}
            </AnimatePresence>

            <AnimatePresence>
              {loading && (
                <motion.div
                  initial={{ opacity: 0, y: 8, scale: 0.985 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: 4 }}
                  transition={{ duration: 0.2, ease: [0.22, 1, 0.36, 1] }}
                  className="flex justify-start pt-3"
                >
                  <div className="flex items-center gap-2 rounded-[22px] border border-white/[0.06] bg-white/[0.035] px-4 py-3 text-sm text-neutral-400">
                    <span>MindLog is thinking</span>

                    <div className="flex gap-1">
                      <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-neutral-400 [animation-delay:-0.2s]" />
                      <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-neutral-400 [animation-delay:-0.1s]" />
                      <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-neutral-400" />
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>
      </div>

      <div
        className={`pointer-events-none fixed inset-x-0 z-20 h-10 bg-gradient-to-t from-[#0a0a0a] via-[#0a0a0a]/52 to-transparent transition-all duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] ${footerFadeBottomClass}`}
      />

      <div
        className={`fixed inset-x-0 z-30 px-3 transition-all duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] ${composerBottomClass}`}
      >
        <form
          onSubmit={(e) => {
            e.preventDefault();
            sendMessage();
          }}
          className="mx-auto flex max-w-xl items-end gap-2 rounded-[28px] border border-white/10 bg-[#151515]/92 px-2.5 py-2 shadow-[0_18px_44px_rgba(0,0,0,0.34)] backdrop-blur-2xl transition duration-300 ease-[cubic-bezier(0.22,1,0.36,1)]"
        >
          <div
            className={`min-w-0 flex-1 rounded-[22px] border px-3 transition duration-300 ${
              isFocused
                ? "border-white/14 bg-white/[0.06]"
                : "border-transparent bg-transparent"
            }`}
          >
            <textarea
              ref={textareaRef}
              rows={1}
              value={input}
              onFocus={() => setIsFocused(true)}
              onBlur={() => setIsFocused(false)}
              onChange={(e) => {
                setInput(e.target.value);
                if (chatError) setChatError(null);
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  sendMessage();
                }
              }}
              placeholder="Message"
              className="max-h-[88px] w-full resize-none overflow-y-auto bg-transparent px-0 py-2.5 text-[15px] leading-[1.4] text-white outline-none placeholder-neutral-500"
            />
          </div>

          <button
            type="submit"
            disabled={!canSend}
            aria-label="Send message"
            className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full transition duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] ${
              canSend
                ? "bg-white text-black shadow-[0_8px_20px_rgba(255,255,255,0.12)]"
                : "bg-white/[0.08] text-neutral-500"
            }`}
          >
            <svg
              viewBox="0 0 24 24"
              className="h-[16px] w-[16px]"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M5 12h11" />
              <path d="m12 5 7 7-7 7" />
            </svg>
          </button>
        </form>
      </div>

      <ConfirmModal
        open={showCloseConfirm}
        title="Close this conversation?"
        description={
          usage?.canSave === false
            ? "You’ve reached your free plan save limit. Upgrade to Pro to save this conversation."
            : "It will be saved to your journal."
        }
        confirmLabel={usage?.canSave === false ? "Upgrade to Pro" : "Close & save"}
        cancelLabel="Stay here"
        danger={false}
        onCancel={() => {
          setShowCloseConfirm(false);
        }}
        onConfirm={() => {
          setShowCloseConfirm(false);

          if (usage?.canSave === false) {
            window.location.href = "/upgrade";
            return;
          }

          closeConversation();
        }}
      />

      <ConfirmModal
        open={showLeaveConfirm}
        title="Save this conversation before leaving?"
        description="You already started this chat. Save it first if you want it to appear in your journal."
        confirmLabel="Save & leave"
        secondaryLabel="Leave without saving"
        cancelLabel="Stay here"
        onCancel={() => {
          setShowLeaveConfirm(false);
          setPendingLeaveHref(null);
        }}
        onSecondary={() => {
          const nextHref = pendingLeaveHref;
          setShowLeaveConfirm(false);
          resetChat();

          if (nextHref) {
            router.push(nextHref);
          }
        }}
        onConfirm={() => {
          const nextHref = pendingLeaveHref || undefined;
          setShowLeaveConfirm(false);
          closeConversation(nextHref);
        }}
      />
    </div>
  );
}