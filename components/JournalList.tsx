"use client";

import { useRouter, usePathname } from "next/navigation";
import { useJournal } from "@/components/journal/JournalContext";
import { moodConfig } from "@/lib/journal/moodMap";
import { SwipeableItem } from "@/components/ui/SwipeableItem";
import { useState, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";

export default function JournalList() {
  const { items, loading, deleteItem, addItem } = useJournal();
  const router = useRouter();
  const pathname = usePathname();

  const [snackbarVisible, setSnackbarVisible] = useState(false);
  const deletedItemRef = useRef<any>(null);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  const activeId = pathname?.startsWith("/journal/")
    ? pathname.split("/journal/")[1]
    : null;

  if (loading) {
    return <p className="text-sm text-neutral-400">Loading conversations…</p>;
  }

  if (items.length === 0) {
    return (
      <p className="text-sm text-neutral-500">
        You don’t have any saved conversations yet.
      </p>
    );
  }

  const handleSwipeDelete = (item: any) => {
    deletedItemRef.current = item;

    deleteItem(item.id);

    setSnackbarVisible(true);

    timerRef.current = setTimeout(() => {
      deletedItemRef.current = null;
      setSnackbarVisible(false);
    }, 4000);
  };

  const handleUndo = (e: React.MouseEvent) => {
    e.stopPropagation();

    if (timerRef.current) clearTimeout(timerRef.current);

    if (deletedItemRef.current) {
      addItem(deletedItemRef.current);
    }

    deletedItemRef.current = null;
    setSnackbarVisible(false);
  };

  return (
    <>
      <motion.div layout className="space-y-3">
        <AnimatePresence>
          {items.map((item) => {
            const mood =
              item.mood && moodConfig[item.mood]
                ? moodConfig[item.mood]
                : moodConfig.calm;

            const isActive = item.id === activeId;

            const preview = item.messages.find(
              (m) => m.role === "user"
            )?.content;

            return (
              <motion.div
                key={item.id}
                layout
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, height: 0 }}
                transition={{
                  type: "spring",
                  stiffness: 500,
                  damping: 40,
                }}
              >
                <SwipeableItem
                  onSwipeDelete={() =>
                    handleSwipeDelete(item)
                  }
                >
                  <motion.div
                    onClick={() => {
                      if (isActive) return;

                      const id = item.id;

                      setTimeout(() => {
                        router.push(`/journal/${id}`);
                      }, 90);
                    }}
                    className={`
                      w-full
                      rounded-2xl
                      px-4 py-2.5
                      border
                      transition-all duration-200 ease-out
                      ${
                        isActive
                          ? "border-white/15 bg-neutral-800"
                          : "border-white/5 bg-neutral-900"
                      }
                      hover:border-white/10
                      active:scale-[0.985]
                    `}
                  >
                    <div className="flex items-center justify-between">
                      <h3 className="text-sm font-medium text-white truncate">
                        {item.title || "Conversation"}
                      </h3>

                      <span className="text-xs opacity-70">
                        {mood.dot}
                      </span>
                    </div>

                    {preview && (
                      <p className="mt-2 text-xs text-neutral-400 line-clamp-2">
                        {preview}
                      </p>
                    )}

                    <div className="mt-2 flex items-center gap-2 text-xs text-neutral-500">
                      <span
                        className={`h-2 w-2 rounded-full ${mood.color}`}
                      />
                      <span>{mood.label}</span>
                      <span>·</span>
                      <span>
                        {new Date(
                          item.createdAt
                        ).toLocaleDateString()}
                      </span>
                    </div>
                  </motion.div>
                </SwipeableItem>
              </motion.div>
            );
          })}
        </AnimatePresence>
      </motion.div>

      <AnimatePresence>
        {snackbarVisible && (
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 16 }}
            transition={{ type: "spring", stiffness: 500, damping: 40 }}
            className="fixed inset-x-0 bottom-0 z-[9999] flex justify-center"
            style={{
              paddingBottom: "calc(env(safe-area-inset-bottom) + 16px)",
            }}
          >
            <div className="bg-neutral-900/90 backdrop-blur-xl border border-white/10 rounded-full px-4 py-2 flex items-center gap-3">
              <span className="text-sm text-white whitespace-nowrap">
                Conversation deleted
              </span>

              <button
                onClick={handleUndo}
                className="px-4 py-2 -my-2 rounded-full text-sm font-medium text-blue-400 hover:text-blue-300 active:scale-95 transition"
              >
                Undo
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}