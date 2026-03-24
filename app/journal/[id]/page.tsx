"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useHeader } from "@/components/header/HeaderContext";
import { useJournal } from "@/components/journal/JournalContext";
import { moodConfig } from "@/lib/journal/moodMap";
import { motion } from "framer-motion";

type Message = {
  role: "user" | "assistant";
  content: string;
};

type JournalItem = {
  id: string;
  title: string;
  mood?: keyof typeof moodConfig;
  createdAt?: number;
  created_at?: string;
  messages?: Message[];
  content?: Message[];
};

export default function JournalEntryPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { setHeader, resetHeader } = useHeader();
  const { updateItem, deleteItem } = useJournal();

  const [item, setItem] = useState<JournalItem | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`/api/journal/${id}`)
      .then(async (res) => {
        if (!res.ok) return null;
        return res.json();
      })
      .then((data) => setItem(data))
      .finally(() => setLoading(false));
  }, [id]);

  const normalizedMessages = useMemo(() => {
    if (!item) return [];
    if (Array.isArray(item.messages)) return item.messages;
    if (Array.isArray(item.content)) return item.content;
    return [];
  }, [item]);

  useEffect(() => {
    if (!item) return;

    const mood =
      item.mood && moodConfig[item.mood]
        ? moodConfig[item.mood]
        : null;

    setHeader({
      title: item.title || "Conversation",
      subtitle: mood?.label,
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
          label: "Rename",
          onClick: async () => {
            const nextTitle = prompt(
              "New conversation title:",
              item.title || ""
            );

            if (!nextTitle || nextTitle === item.title) return;

            setItem((prev) =>
              prev ? { ...prev, title: nextTitle } : prev
            );

            await updateItem(id, { title: nextTitle });
          },
        },
        {
          label: "Delete conversation",
          danger: true,
          onClick: async () => {
            const ok = confirm("Delete this conversation?");
            if (!ok) return;

            await deleteItem(id);
            router.push("/journal");
          },
        },
        {
          label: "New conversation",
          onClick: () => router.push("/"),
        },
      ],
    });

    return () => resetHeader();
  }, [item, id, router, setHeader, resetHeader, updateItem, deleteItem]);

  if (loading) {
    return (
      <p className="px-4 pt-24 text-sm text-neutral-400">
        Loading conversation…
      </p>
    );
  }

  if (!item) {
    return (
      <p className="px-4 pt-24 text-sm text-neutral-500">
        Conversation not found.
      </p>
    );
  }

  return (
    <div className="relative min-h-screen overscroll-y-contain">
      <div className="pointer-events-none fixed top-0 left-0 right-0 z-40 h-24 bg-gradient-to-b from-[#0a0a0a] to-transparent" />

      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.25 }}
        className="mx-auto max-w-xl px-4 py-6 pt-24 space-y-5"
      >
        {normalizedMessages.length === 0 ? (
          <div className="rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-4 text-sm text-neutral-400">
            No messages in this entry yet.
          </div>
        ) : (
          normalizedMessages.map((msg, idx) => (
            <motion.div
              key={idx}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{
                duration: 0.25,
                delay: idx * 0.02,
              }}
              className={`max-w-[78%] break-words rounded-2xl px-4 py-3.5 text-[14.5px] leading-relaxed ${
                msg.role === "user"
                  ? "ml-auto bg-neutral-800 text-white"
                  : "mr-auto bg-neutral-900 text-neutral-200"
              }`}
            >
              {msg.content}
            </motion.div>
          ))
        )}
      </motion.div>
    </div>
  );
}
