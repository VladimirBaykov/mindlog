"use client";

import { useState, useRef, useEffect } from "react";
import type { ChatMessage } from "@/types/chat";
import type { ChatState } from "@/types/chatState";
import { saveSession as saveJournalSession } from "@/lib/journalStorage";

export default function Chat() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [chatState, setChatState] = useState<ChatState>("empty");

  // journaling
  const [sessionId, setSessionId] = useState(() => crypto.randomUUID());
  const [startedAt, setStartedAt] = useState(() => Date.now());

  const bottomRef = useRef<HTMLDivElement | null>(null);
  const silenceTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading, chatState]);

  function saveSession(finalState: ChatState) {
    saveJournalSession({
      id: sessionId,
      startedAt,
      endedAt: Date.now(),
      messages,
      finalState,
    });
  }

  function resetChat() {
    if (silenceTimeoutRef.current) {
      clearTimeout(silenceTimeoutRef.current);
      silenceTimeoutRef.current = null;
    }

    setMessages([]);
    setInput("");
    setLoading(false);
    setChatState("empty");

    setSessionId(crypto.randomUUID());
    setStartedAt(Date.now());
  }

  function getReflectionText(
    state: ChatState,
    messages: ChatMessage[]
  ): string | null {
    if (state !== "closure") return null;

    const userMessages = messages.filter(
      (m) => m.role === "user"
    ).length;

    if (userMessages <= 1) {
      return "It feels like you checked in with yourself — even that matters.";
    }

    if (userMessages <= 3) {
      return "It sounds like you gave space to something meaningful.";
    }

    return "You stayed with this longer than most people would. That says something.";
  }

  async function sendMessage() {
    if (
      !input.trim() ||
      loading ||
      chatState === "boundary" ||
      chatState === "closure"
    ) {
      return;
    }

    const userMessage: ChatMessage = {
      id: crypto.randomUUID(),
      role: "user",
      content: input.trim(),
    };

    setMessages((prev) => [...prev, userMessage]);
    setInput("");
    setLoading(true);

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: [...messages, userMessage],
        }),
      });

      if (!res.ok) throw new Error("Chat API error");

      const data = await res.json();

      const assistantMessage: ChatMessage = {
        id: crypto.randomUUID(),
        role: "assistant",
        content: data.reply,
      };

      setMessages((prev) => [...prev, assistantMessage]);

      if (data.chatState) {
        if (silenceTimeoutRef.current) {
          clearTimeout(silenceTimeoutRef.current);
          silenceTimeoutRef.current = null;
        }

        if (data.chatState === "silence") {
          silenceTimeoutRef.current = setTimeout(() => {
            setChatState("silence");
          }, 1200);
        } else {
          setChatState(data.chatState);
        }

        if (data.chatState === "boundary") {
          saveSession("boundary");

          setMessages((prev) => [
            ...prev,
            {
              id: crypto.randomUUID(),
              role: "assistant",
              content:
                "Let’s slow down for a moment. I want to stay supportive and present with you.",
            },
          ]);
        }

        if (data.chatState === "closure") {
          saveSession("closure");

          setMessages((prev) => [
            ...prev,
            {
              id: crypto.randomUUID(),
              role: "assistant",
              content:
                "I’m here with you. We can pause here, and come back whenever you want.",
            },
          ]);
        }
      }
    } catch (err) {
      console.error(err);

      setMessages((prev) => [
        ...prev,
        {
          id: crypto.randomUUID(),
          role: "assistant",
          content: "Something went quiet for a moment. Want to try again?",
        },
      ]);

      setChatState("calm_presence");
    } finally {
      setLoading(false);
    }
  }

  function getLoadingText(state: ChatState) {
    switch (state) {
      case "listening":
        return "MindLog is listening…";
      case "silence":
        return "MindLog stays with you.";
      case "boundary":
        return "MindLog pauses gently.";
      default:
        return "MindLog is here…";
    }
  }

  const reflection = getReflectionText(chatState, messages);

  return (
    <div className="flex h-full flex-col">
      <div className="flex-1 overflow-y-auto px-4 py-6 space-y-4">
        {messages.map((msg) => (
          <div
            key={msg.id}
            className={`max-w-[80%] rounded-2xl px-4 py-3 text-sm leading-relaxed
              ${
                msg.role === "user"
                  ? "ml-auto bg-neutral-800 text-white"
                  : "mr-auto bg-neutral-900 text-neutral-200"
              }`}
          >
            {msg.content}
          </div>
        ))}

        {loading && (
          <div className="mr-auto max-w-[60%] rounded-2xl px-4 py-3 text-sm text-neutral-500 bg-neutral-900">
            {getLoadingText(chatState)}
          </div>
        )}

        {reflection && (
          <div className="mr-auto max-w-[70%] rounded-2xl px-4 py-3 text-sm italic text-neutral-400 bg-neutral-900">
            {reflection}
          </div>
        )}

        <div ref={bottomRef} />
      </div>

      {chatState === "closure" && (
        <div className="px-4 pb-4">
          <button
            onClick={resetChat}
            className="w-full rounded-xl border border-neutral-700 px-4 py-2 text-sm text-neutral-300 hover:bg-neutral-900 transition"
          >
            Start a new conversation
          </button>
        </div>
      )}

      <div className="border-t border-neutral-800 px-4 py-3">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            sendMessage();
          }}
          className="flex gap-2"
        >
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder={
              chatState === "boundary"
                ? "Let’s pause here."
                : chatState === "closure"
                ? "This conversation feels complete."
                : "Write what’s on your mind…"
            }
            disabled={
              chatState === "boundary" || chatState === "closure"
            }
            className="flex-1 rounded-xl bg-neutral-900 px-4 py-2 text-sm text-white placeholder-neutral-500 outline-none disabled:opacity-40"
          />

          <button
            type="submit"
            disabled={
              loading ||
              chatState === "boundary" ||
              chatState === "closure"
            }
            className="rounded-xl bg-white px-4 py-2 text-sm font-medium text-black disabled:opacity-40"
          >
            Send
          </button>
        </form>
      </div>
    </div>
  );
}
