"use client";

import { useState, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import type { ChatMessage } from "@/types/chat";
import type { ChatState } from "@/types/chatState";
import { useHeader } from "@/components/header/HeaderContext";
import { useJournal } from "@/components/journal/JournalContext";
import ConfirmModal from "@/components/ui/ConfirmModal";

export default function Chat() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [chatState, setChatState] = useState<ChatState>("empty");
  const [isSaved, setIsSaved] = useState(false);
  const [showCloseConfirm, setShowCloseConfirm] = useState(false);
  const [pendingNavigation, setPendingNavigation] = useState(false);

  const { setHeader, resetHeader } = useHeader();
  const { addItem } = useJournal();

  const bottomRef = useRef<HTMLDivElement | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const scrollerRef = useRef<HTMLDivElement | null>(null);

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
  }

  async function closeConversation() {
    if (messages.length === 0 || isSaved) return;

    try {
      const res = await fetch("/api/conversation/close", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages }),
      });

      if (!res.ok) throw new Error("Close failed");

      const conversation = await res.json();

      addItem(conversation);
      setIsSaved(true);
      resetChat();

      if (pendingNavigation) {
        window.location.href = "/journal";
      }
    } catch (err) {
      console.error(err);
    }
  }

  async function sendMessage() {
    if (!input.trim() || loading) return;

    const userMessage: ChatMessage = {
      id: crypto.randomUUID(),
      role: "user",
      content: input.trim(),
    };

    const nextMessages = [...messages, userMessage];

    setMessages(nextMessages);
    setInput("");
    setLoading(true);

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: nextMessages }),
      });

      if (!res.ok) {
        const text = await res.text();
        console.error("API error:", text);
        return;
      }

      const data = await res.json();

      setMessages((prev) => [
        ...prev,
        {
          id: crypto.randomUUID(),
          role: "assistant",
          content: data.reply,
        },
      ]);
    } catch (err) {
      console.error(err);
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
                  MindLog
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
              </div>
            </motion.div>
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
              onChange={(e) => setInput(e.target.value)}
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
        description="It will be saved to your journal."
        confirmLabel="Close & save"
        danger={false}
        onCancel={() => {
          setShowCloseConfirm(false);
          setPendingNavigation(false);
        }}
        onConfirm={() => {
          setShowCloseConfirm(false);
          closeConversation();
        }}
      />
    </div>
  );
}