"use client";

import { useState, useRef, useEffect, useMemo } from "react";
import { useSearchParams } from "next/navigation";
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

type MoodOption =
  | "gentle"
  | "balanced"
  | "direct"
  | null;

type NotificationOption =
  | "yes"
  | "not_now"
  | null;

type UserPreferences = {
  goal: GoalOption;
  moodPreference: MoodOption;
  notifications: NotificationOption;
};

export default function Chat() {
  const searchParams = useSearchParams();

  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [chatState, setChatState] =
    useState<ChatState>("empty");
  const [isSaved, setIsSaved] = useState(false);
  const [showCloseConfirm, setShowCloseConfirm] =
    useState(false);
  const [pendingNavigation, setPendingNavigation] =
    useState(false);
  const [usage, setUsage] = useState<UsageInfo | null>(null);
  const [usageLoading, setUsageLoading] = useState(true);
  const [limitError, setLimitError] = useState<string | null>(
    null
  );
  const [chatError, setChatError] = useState<string | null>(
    null
  );
  const [starterApplied, setStarterApplied] = useState(false);
  const [preferences, setPreferences] =
    useState<UserPreferences>({
      goal: null,
      moodPreference: null,
      notifications: null,
    });

  const { setHeader, resetHeader } = useHeader();
  const { addItem } = useJournal();

  const bottomRef = useRef<HTMLDivElement | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const scrollerRef = useRef<HTMLDivElement | null>(null);

  const starter = searchParams.get("starter");

  useEffect(() => {
    bottomRef.current?.scrollIntoView({
      behavior: "smooth",
      block: "end",
    });
  }, [messages, loading]);

  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;

    el.style.height = "0px";
    const scrollHeight = el.scrollHeight;
    el.style.height = Math.min(scrollHeight, 160) + "px";
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
          goal:
            (user?.user_metadata?.onboarding_goal as GoalOption) ??
            null,
          moodPreference:
            (user?.user_metadata
              ?.onboarding_mood_preference as MoodOption) ?? null,
          notifications:
            (user?.user_metadata
              ?.onboarding_notifications as NotificationOption) ??
            null,
        });
      } catch (error) {
        console.error("Preference load failed:", error);
      }
    }

    loadPreferences();
  }, []);

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
          label: "Journal",
          onClick: () => {
            if (messages.length === 0 || isSaved) {
              window.location.href = "/journal";
              return;
            }

            setPendingNavigation(true);
            setShowCloseConfirm(true);
          },
        },
        {
          label: "Close conversation",
          highlight: true,
          onClick: () => setShowCloseConfirm(true),
        },
      ],
    });

    return () => resetHeader();
  }, [messages, isSaved, setHeader, resetHeader]);

  function resetChat() {
    setMessages([]);
    setInput("");
    setLoading(false);
    setChatState("empty");
    setIsSaved(false);
    setLimitError(null);
    setChatError(null);
  }

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

  async function closeConversation() {
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

          await trackClientEvent({
            eventName: "chat_limit_hit",
            page: "/chat",
            metadata: {
              type: "save_limit",
              plan: usage?.plan || "free",
              limit: data.limit,
            },
          });

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

      if (pendingNavigation) {
        window.location.href = successUrl;
        return;
      }

      window.location.href = successUrl;
    } catch (err) {
      console.error(err);
    } finally {
      setPendingNavigation(false);
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
      const message = `This message is too long for your current plan. Maximum length: ${usage.ai.maxCharactersPerMessage} characters.`;
      setChatError(message);

      await trackClientEvent({
        eventName: "chat_limit_hit",
        page: "/chat",
        metadata: {
          type: "message_too_long",
          plan: usage?.plan || "free",
          attemptedLength: currentInput.length,
          limit: usage.ai.maxCharactersPerMessage,
        },
      });

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
      const message =
        usage.plan === "free"
          ? `You’ve reached the free plan conversation depth limit (${usage.ai.maxMessagesPerConversation} messages). Upgrade to Pro for deeper conversations.`
          : `This conversation has reached its current depth limit (${usage.ai.maxMessagesPerConversation} messages).`;

      setChatError(message);

      await trackClientEvent({
        eventName: "chat_limit_hit",
        page: "/chat",
        metadata: {
          type: "conversation_depth",
          plan: usage.plan,
          attemptedMessages: nextMessages.length,
          limit: usage.ai.maxMessagesPerConversation,
        },
      });

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
      const message =
        usage.plan === "free"
          ? "You’ve reached the free plan context limit for this conversation. Upgrade to Pro or start a new reflection."
          : "This conversation has become too large. Start a new reflection to continue clearly.";

      setChatError(message);

      await trackClientEvent({
        eventName: "chat_limit_hit",
        page: "/chat",
        metadata: {
          type: "total_context",
          plan: usage.plan,
          attemptedCharacters: totalInputCharacters,
          limit: usage.ai.maxTotalInputCharacters,
        },
      });

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

          await trackClientEvent({
            eventName: "chat_limit_hit",
            page: "/chat",
            metadata: {
              type: "chat_depth_limit_api",
              plan: apiError.plan,
              limit: apiError.limit,
            },
          });

          return;
        }

        if (apiError?.code === "MESSAGE_TOO_LONG") {
          setChatError(
            apiError.limit
              ? `This message is too long. Maximum length: ${apiError.limit} characters.`
              : "This message is too long."
          );
          setMessages(messages);

          await trackClientEvent({
            eventName: "chat_limit_hit",
            page: "/chat",
            metadata: {
              type: "message_too_long_api",
              plan: apiError.plan || usage?.plan || "free",
              limit: apiError.limit,
            },
          });

          return;
        }

        if (apiError?.code === "TOTAL_CONTEXT_LIMIT") {
          setChatError(
            apiError.plan === "free"
              ? "You’ve reached the free plan context limit. Upgrade to Pro or start a new conversation."
              : "This conversation is too large to continue in one thread. Start a new reflection."
          );
          setMessages(messages);

          await trackClientEvent({
            eventName: "chat_limit_hit",
            page: "/chat",
            metadata: {
              type: "total_context_limit_api",
              plan: apiError.plan,
              limit: apiError.limit,
            },
          });

          return;
        }

        const text =
          apiError?.error || "Something went wrong while sending.";
        console.error("API error:", text);
        setChatError(text);
        setMessages(messages);
        return;
      }

      setMessages((prev) => [
        ...prev,
        {
          id: crypto.randomUUID(),
          role: "assistant",
          content:
            (data as { reply?: string })?.reply ||
            "I’m here with you.",
        },
      ]);

      if ((data as { chatState?: ChatState })?.chatState) {
        setChatState((data as { chatState: ChatState }).chatState);
      }
    } catch (err) {
      console.error(err);
      setChatError(
        "Something went quiet for a moment. Want to try again?"
      );
      setMessages(messages);
    } finally {
      setLoading(false);
    }
  }

  const showEmptyState = messages.length === 0 && !loading;

  return (
    <div className="relative flex min-h-screen flex-col bg-black text-white">
      <div className="pointer-events-none fixed top-0 left-0 right-0 z-40 h-28 bg-gradient-to-b from-[#0a0a0a] via-[#0a0a0a]/80 to-transparent" />

      <div
        ref={scrollerRef}
        className="flex-1 overflow-y-auto overscroll-y-contain px-4 pt-28 pb-36"
      >
        <div className="mx-auto max-w-xl">
          {showEmptyState && (
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.28 }}
              className="px-1 pt-8 pb-10"
            >
              <div className="max-w-md">
                <div className="inline-flex rounded-full border border-white/10 bg-white/[0.04] px-3 py-1 text-[11px] uppercase tracking-[0.18em] text-neutral-300">
                  {guidanceLabel}
                </div>

                <h1 className="mt-5 text-3xl font-semibold leading-tight text-white">
                  A quiet space
                  <br />
                  to reflect clearly.
                </h1>

                <p className="mt-4 max-w-sm text-sm leading-relaxed text-neutral-400">
                  Start with whatever feels present. When you’re ready,
                  close the conversation and save it to your journal.
                </p>

                {starter && (
                  <div className="mt-5 rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-4">
                    <div className="text-sm font-medium text-white">
                      Your first starter is ready
                    </div>
                    <p className="mt-2 text-sm leading-relaxed text-neutral-400">
                      We pre-filled a reflection prompt from onboarding.
                      You can send it as-is or edit it first.
                    </p>
                  </div>
                )}

                <div className="mt-5 rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-4">
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-xs uppercase tracking-[0.18em] text-neutral-500">
                      Plan
                    </span>
                    <span className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-1 text-xs text-neutral-300 capitalize">
                      {usageLoading
                        ? "loading"
                        : usage?.plan || "free"}
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

                  {usage?.ai && (
                    <div className="mt-4 rounded-2xl border border-white/10 bg-black/20 px-4 py-4">
                      <div className="text-xs uppercase tracking-[0.18em] text-neutral-500">
                        AI depth
                      </div>
                      <p className="mt-2 text-sm leading-relaxed text-neutral-300">
                        {usage.ai.maxMessagesPerConversation} messages
                        per conversation · up to{" "}
                        {usage.ai.maxCharactersPerMessage} characters
                        per message
                      </p>
                    </div>
                  )}
                </div>

                <div className="mt-5">
                  <div className="text-xs uppercase tracking-[0.18em] text-neutral-500">
                    Suggested starters
                  </div>

                  <div className="mt-3 flex flex-wrap gap-2">
                    {suggestedPrompts.map((prompt) => (
                      <button
                        key={prompt}
                        onClick={() => applySuggestedPrompt(prompt)}
                        className="rounded-full border border-white/10 bg-white/[0.03] px-4 py-2 text-left text-xs leading-relaxed text-neutral-300 transition hover:bg-white/[0.06] hover:text-white"
                      >
                        {prompt}
                      </button>
                    ))}
                  </div>
                </div>

                {limitError && (
                  <div className="mt-4 rounded-2xl border border-amber-500/20 bg-amber-500/10 px-4 py-4">
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
                      className="mt-4 rounded-2xl bg-white px-4 py-3 text-sm font-medium text-black transition hover:opacity-90"
                    >
                      Upgrade to Pro
                    </button>
                  </div>
                )}

                {chatError && (
                  <div className="mt-4 rounded-2xl border border-red-500/20 bg-red-500/10 px-4 py-4">
                    <div className="text-sm font-medium text-white">
                      Conversation limit reached
                    </div>
                    <p className="mt-2 text-sm leading-relaxed text-neutral-300">
                      {chatError}
                    </p>

                    {usage?.plan === "free" && (
                      <button
                        onClick={() => {
                          window.location.href = "/upgrade";
                        }}
                        className="mt-4 rounded-2xl bg-white px-4 py-3 text-sm font-medium text-black transition hover:opacity-90"
                      >
                        Upgrade to Pro
                      </button>
                    )}
                  </div>
                )}
              </div>
            </motion.div>
          )}

          {!showEmptyState && (limitError || chatError) && (
            <div className="mb-4 space-y-3">
              {limitError && (
                <div className="rounded-2xl border border-amber-500/20 bg-amber-500/10 px-4 py-4">
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
                    className="mt-4 rounded-2xl bg-white px-4 py-3 text-sm font-medium text-black transition hover:opacity-90"
                  >
                    Upgrade to Pro
                  </button>
                </div>
              )}

              {chatError && (
                <div className="rounded-2xl border border-red-500/20 bg-red-500/10 px-4 py-4">
                  <div className="text-sm font-medium text-white">
                    AI conversation limit
                  </div>
                  <p className="mt-2 text-sm leading-relaxed text-neutral-300">
                    {chatError}
                  </p>

                  <div className="mt-4 flex flex-col gap-3 sm:flex-row">
                    {usage?.plan === "free" && (
                      <button
                        onClick={() => {
                          window.location.href = "/upgrade";
                        }}
                        className="rounded-2xl bg-white px-4 py-3 text-sm font-medium text-black transition hover:opacity-90"
                      >
                        Upgrade to Pro
                      </button>
                    )}

                    <button
                      onClick={resetChat}
                      className="rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-3 text-sm font-medium text-white transition hover:bg-white/[0.05]"
                    >
                      Start new conversation
                    </button>
                  </div>
                </div>
              )}
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
                    transition={{
                      duration: 0.22,
                      ease: [0.22, 1, 0.36, 1],
                    }}
                    className={`flex ${
                      isUser ? "justify-end" : "justify-start"
                    } ${groupedWithPrevious ? "pt-1" : "pt-3"}`}
                  >
                    <div
                      className={`max-w-[78%] rounded-[22px] border px-4 py-3 text-[14.5px] leading-[1.55] shadow-[0_0_0_1px_rgba(255,255,255,0.01)] ${
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
                  transition={{
                    duration: 0.2,
                    ease: [0.22, 1, 0.36, 1],
                  }}
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

          <div ref={bottomRef} />
        </div>
      </div>

      <div className="pointer-events-none fixed bottom-20 left-0 right-0 z-30 h-20 bg-gradient-to-t from-[#0a0a0a] via-[#0a0a0a]/75 to-transparent" />

      <div className="fixed bottom-0 left-0 right-0 z-40 border-t border-white/10 bg-[#0a0a0a]/95 px-4 py-3 backdrop-blur-xl">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            sendMessage();
          }}
          className="mx-auto flex max-w-xl items-end gap-2"
        >
          <div className="flex-1 rounded-[24px] border border-white/10 bg-neutral-900/90 px-3 py-2 shadow-[0_0_0_1px_rgba(255,255,255,0.015)]">
            <textarea
              ref={textareaRef}
              rows={1}
              value={input}
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
              placeholder="Write what’s on your mind…"
              className="max-h-40 w-full resize-none overflow-y-auto bg-transparent px-1 py-1 text-[14.5px] leading-[1.5] text-white outline-none placeholder-neutral-500"
            />
          </div>

          <button
            type="submit"
            disabled={loading || !input.trim()}
            className="rounded-[20px] bg-white px-4 py-3 text-sm font-medium text-black transition duration-200 hover:opacity-90 disabled:opacity-40"
          >
            Send
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
        confirmLabel={
          usage?.canSave === false ? "Upgrade to Pro" : "Close & save"
        }
        danger={false}
        onCancel={() => {
          setShowCloseConfirm(false);
          setPendingNavigation(false);
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
    </div>
  );
}