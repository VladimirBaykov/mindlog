"use client";

import { AnimatePresence, motion } from "framer-motion";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";

type CollectionItem = {
  id: string;
  name: string;
  color?: string;
  count?: number;
  locked?: boolean;
};

type CollectionPickerDialogProps = {
  open: boolean;
  title: string;
  description: string;
  selectedCount?: number;
  loading?: boolean;
  onClose: () => void;
  onConfirm: (collectionId: string) => Promise<void> | void;
};

const COLOR_DOT: Record<string, string> = {
  slate: "bg-slate-300",
  blue: "bg-blue-300",
  purple: "bg-purple-300",
  rose: "bg-rose-300",
  amber: "bg-amber-300",
  emerald: "bg-emerald-300",
  cyan: "bg-cyan-300",
  pink: "bg-pink-300",
};

export default function CollectionPickerDialog({
  open,
  title,
  description,
  selectedCount = 1,
  loading = false,
  onClose,
  onConfirm,
}: CollectionPickerDialogProps) {
  const router = useRouter();
  const [collections, setCollections] = useState<CollectionItem[]>([]);
  const [selectedId, setSelectedId] = useState("");
  const [fetching, setFetching] = useState(false);
  const [error, setError] = useState("");
  const [shakeKey, setShakeKey] = useState(0);

  useEffect(() => {
    if (!open) return;

    let cancelled = false;

    async function loadCollections() {
      try {
        setFetching(true);
        setError("");
        setSelectedId("");

        const res = await fetch("/api/journal/collections", {
          cache: "no-store",
        });
        const data = await res.json().catch(() => ({}));

        if (!res.ok) {
          throw new Error(data.error || "Could not load collections.");
        }

        if (!cancelled) {
          setCollections(Array.isArray(data.items) ? data.items : []);
        }
      } catch (err) {
        if (!cancelled) {
          setError(
            err instanceof Error
              ? err.message
              : "Could not load collections.",
          );
          setShakeKey((value) => value + 1);
        }
      } finally {
        if (!cancelled) setFetching(false);
      }
    }

    loadCollections();

    return () => {
      cancelled = true;
    };
  }, [open]);

  const selectedCollection = useMemo(
    () => collections.find((collection) => collection.id === selectedId),
    [collections, selectedId],
  );

  async function submit() {
    if (loading || fetching) return;

    if (!selectedId) {
      setError("Choose a collection first.");
      setShakeKey((value) => value + 1);
      return;
    }

    try {
      setError("");
      await onConfirm(selectedId);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Could not add to this collection.",
      );
      setShakeKey((value) => value + 1);
    }
  }

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 z-[10030] flex items-end justify-center bg-black/[0.62] px-4 pb-[calc(env(safe-area-inset-bottom)+18px)] pt-6 backdrop-blur-md sm:items-center sm:pb-6"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={() => {
            if (!loading) onClose();
          }}
        >
          <motion.div
            key={shakeKey}
            initial={{ opacity: 0, y: 18, scale: 0.98 }}
            animate={
              error
                ? {
                    opacity: 1,
                    y: [0, -1, 1, -1, 1, 0],
                    scale: 1,
                  }
                : { opacity: 1, y: 0, scale: 1 }
            }
            exit={{ opacity: 0, y: 16, scale: 0.98 }}
            transition={{ type: "spring", stiffness: 520, damping: 42 }}
            onClick={(event) => event.stopPropagation()}
            className="w-full max-w-[430px] overflow-hidden rounded-[30px] border border-white/10 bg-neutral-950/96 p-1.5 shadow-2xl shadow-black/55 backdrop-blur-2xl"
          >
            <div className="rounded-[25px] bg-gradient-to-b from-white/[0.075] to-white/[0.025] px-5 py-5">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <div className="text-[11px] uppercase tracking-[0.18em] text-neutral-500">
                    MindLog Collections
                  </div>
                  <h2 className="mt-2 text-[22px] font-semibold tracking-[-0.04em] text-white">
                    {title}
                  </h2>
                </div>

                <button
                  onClick={onClose}
                  disabled={loading}
                  className="rounded-full px-2 py-1 text-lg leading-none text-neutral-500 transition hover:bg-white/[0.06] hover:text-white disabled:opacity-40"
                  aria-label="Close"
                >
                  ×
                </button>
              </div>

              <p className="mt-3 text-sm leading-relaxed text-neutral-400">
                {description}
              </p>

              <div className="mt-4 rounded-[20px] border border-white/10 bg-white/[0.035] px-3 py-2 text-xs text-neutral-400">
                {selectedCount} reflection{selectedCount === 1 ? "" : "s"} selected
              </div>

              <div className="mt-4 max-h-[290px] space-y-2 overflow-y-auto pr-1">
                {fetching && (
                  <div className="rounded-[20px] border border-white/10 bg-white/[0.035] px-4 py-4 text-sm text-neutral-400">
                    Loading collections...
                  </div>
                )}

                {!fetching && collections.length === 0 && (
                  <div className="rounded-[20px] border border-white/10 bg-white/[0.035] px-4 py-5 text-center">
                    <div className="text-sm font-medium text-white">
                      No collections yet
                    </div>
                    <p className="mx-auto mt-2 max-w-xs text-sm leading-relaxed text-neutral-400">
                      Create a collection first, then come back to organize this reflection.
                    </p>
                    <button
                      onClick={() => {
                        onClose();
                        router.push("/journal/collections");
                      }}
                      className="mt-4 rounded-[16px] bg-white px-4 py-2.5 text-sm font-semibold text-black transition hover:bg-neutral-200"
                    >
                      Open collections
                    </button>
                  </div>
                )}

                {!fetching &&
                  collections.map((collection) => {
                    const selected = collection.id === selectedId;
                    const color = COLOR_DOT[collection.color || ""] || COLOR_DOT.blue;

                    return (
                      <button
                        key={collection.id}
                        onClick={() => {
                          setSelectedId(collection.id);
                          if (error) setError("");
                        }}
                        className={`flex w-full items-center gap-3 rounded-[20px] border px-3.5 py-3 text-left transition ${
                          selected
                            ? "border-white/30 bg-white/[0.095]"
                            : "border-white/10 bg-white/[0.035] hover:border-white/18 hover:bg-white/[0.055]"
                        }`}
                      >
                        <span className={`h-10 w-[5px] shrink-0 rounded-full ${color}`} />
                        <span className="min-w-0 flex-1">
                          <span className="flex min-w-0 items-center gap-2">
                            <span className="truncate text-sm font-medium text-white">
                              {collection.name}
                            </span>
                            {collection.locked && (
                              <span className="shrink-0 rounded-full border border-white/10 bg-white/[0.05] px-2 py-0.5 text-[10px] uppercase tracking-[0.12em] text-neutral-300">
                                Locked
                              </span>
                            )}
                          </span>
                          <span className="mt-0.5 block text-xs text-neutral-500">
                            {collection.count ?? 0} reflection{collection.count === 1 ? "" : "s"}
                          </span>
                        </span>
                        <span
                          className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full border text-xs font-semibold transition ${
                            selected
                              ? "border-white bg-white text-black"
                              : "border-white/18 text-transparent"
                          }`}
                        >
                          ✓
                        </span>
                      </button>
                    );
                  })}
              </div>

              {error && (
                <div className="mt-3 rounded-[16px] border border-red-400/20 bg-red-500/10 px-3 py-2 text-sm text-red-200">
                  {error}
                </div>
              )}

              <div className="mt-5 grid grid-cols-2 gap-2">
                <button
                  onClick={onClose}
                  disabled={loading}
                  className="rounded-[18px] border border-white/10 bg-white/[0.04] px-4 py-3 text-sm font-medium text-neutral-200 transition hover:bg-white/[0.07] disabled:opacity-40"
                >
                  Cancel
                </button>
                <button
                  onClick={submit}
                  disabled={loading || fetching || !selectedCollection}
                  className="rounded-[18px] bg-white px-4 py-3 text-sm font-semibold text-black transition hover:bg-neutral-200 disabled:opacity-40"
                >
                  {loading ? "Adding..." : "Add"}
                </button>
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
