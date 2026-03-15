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

  // smooth scroll
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading]);

  // auto grow textarea
  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;

    el.style.height = "0px";
    const scrollHeight = el.scrollHeight;
    el.style.height = Math.min(scrollHeight, 160) + "px";
  }, [input]);

  // header
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
  }, [messages, isSaved]);

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

  return (
    <div className="relative flex min-h-screen flex-col overscroll-y-contain">

      {/* top fade */}
      <div className="pointer-events-none fixed top-0 left-0 right-0 z-40 h-24 bg-gradient-to-b from-[#0a0a0a] to-transparent" />

      {/* messages */}
      <div className="flex-1 overflow-y-auto px-4 pt-28 pb-32 space-y-3">

        <AnimatePresence initial={false}>
          {messages.map((msg) => (
            <motion.div
              key={msg.id}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.18 }}
              className={`max-w-[70%] break-words rounded-xl px-2.5 py-1.5 text-[14px] ${
                msg.role === "user"
                  ? "ml-auto bg-white/[0.06] border border-white/[0.06] text-white"
                  : "mr-auto bg-white/[0.04] border border-white/[0.05] text-neutral-200"
              }`}
            >
              {msg.content}
            </motion.div>
          ))}
        </AnimatePresence>

        <AnimatePresence>
          {loading && (
            <motion.div
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.18 }}
              className="mr-auto flex items-center gap-2 rounded-xl bg-white/[0.04] border border-white/[0.05] px-2.5 py-1.5 text-sm text-neutral-400"
            >
              <span>MindLog is thinking</span>

              <div className="flex gap-1">
                <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-neutral-400 [animation-delay:-0.2s]" />
                <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-neutral-400 [animation-delay:-0.1s]" />
                <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-neutral-400" />
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        <div ref={bottomRef} />
      </div>

      {/* input */}
      <div className="fixed bottom-0 left-0 right-0 border-t border-white/10 bg-[#0a0a0a] px-4 py-3">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            sendMessage();
          }}
          className="flex items-end gap-2 max-w-xl mx-auto"
        >
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
            className="flex-1 resize-none rounded-xl bg-neutral-900 px-3 py-2 text-sm text-white placeholder-neutral-500 outline-none max-h-40 overflow-y-auto"
          />

          <button
            type="submit"
            disabled={loading}
            className="rounded-xl bg-white px-4 py-2 text-sm font-medium text-black disabled:opacity-40"
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