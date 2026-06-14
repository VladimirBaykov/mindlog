"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import AuthGate from "@/components/AuthGate";
import { useHeader } from "@/components/header/HeaderContext";
import { moodConfig } from "@/lib/journal/moodMap";

type Message = {
  role: "user" | "assistant";
  content: string;
};

type JournalItem = {
  id: string;
  title?: string;
  mood?: keyof typeof moodConfig | string | null;
  created_at?: string;
  updated_at?: string | null;
  content?: Message[];
  metadata?: {
    summary?: string;
    keyTakeaway?: string;
    themes?: string[];
    chatType?: string;
  } | null;
  is_favorite?: boolean | null;
  hidden_at?: string | null;
};

type Collection = {
  id: string;
  name: string;
  color: string;
  locked: boolean;
  count: number;
  createdAt: string;
  updatedAt: string | null;
};

type CollectionResponse = {
  collection?: Collection;
  items?: JournalItem[];
  error?: string;
};

type JournalResponse = {
  items?: JournalItem[];
};

const collectionColor: Record<string, string> = {
  slate: "bg-slate-300",
  blue: "bg-blue-400",
  purple: "bg-purple-400",
  rose: "bg-rose-400",
  amber: "bg-amber-300",
  emerald: "bg-emerald-300",
  cyan: "bg-cyan-300",
  pink: "bg-pink-400",
};

function getDateLabel(value: string | undefined) {
  if (!value) return "Saved";
  const date = new Date(value);
  return date.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

function getMessageCount(item: JournalItem) {
  return Array.isArray(item.content) ? item.content.length : 0;
}

function getMessageLabel(count: number) {
  return `${count} message${count === 1 ? "" : "s"}`;
}

function getMood(item: JournalItem) {
  const key = item.mood as keyof typeof moodConfig;
  return key && moodConfig[key] ? moodConfig[key] : moodConfig.calm;
}

function normalizePreview(value: string) {
  return value.trim().replace(/\s+/g, " ");
}

function getPreview(item: JournalItem) {
  if (item.metadata?.summary) return item.metadata.summary;

  const messages = Array.isArray(item.content) ? item.content : [];
  const userMessage = messages.find(
    (message) => message.role === "user" && message.content.trim().length > 12
  );

  return userMessage?.content ? normalizePreview(userMessage.content) : "Saved reflection";
}

export default function JournalCollectionDetailPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const { setHeader, resetHeader } = useHeader();

  const [collection, setCollection] = useState<Collection | null>(null);
  const [items, setItems] = useState<JournalItem[]>([]);
  const [allItems, setAllItems] = useState<JournalItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [addOpen, setAddOpen] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [menuOpen, setMenuOpen] = useState(false);

  const collectionId = params.id;

  const availableItems = useMemo(() => {
    const existingIds = new Set(items.map((item) => item.id));
    return allItems.filter((item) => !existingIds.has(item.id));
  }, [allItems, items]);

  async function loadCollection() {
    try {
      setLoading(true);

      const res = await fetch(`/api/journal/collections/${collectionId}`, {
        cache: "no-store",
      });
      const data = (await res.json()) as CollectionResponse;

      if (!res.ok) throw new Error(data.error || "Failed to load collection");

      setCollection(data.collection ?? null);
      setItems(data.items ?? []);
    } catch (error) {
      console.error("Collection load failed:", error);
      setCollection(null);
      setItems([]);
    } finally {
      setLoading(false);
    }
  }

  async function loadAllItems() {
    try {
      const res = await fetch("/api/journal?limit=100&offset=0", {
        cache: "no-store",
      });
      const data = (await res.json()) as JournalResponse;
      setAllItems(data.items ?? []);
    } catch (error) {
      console.error("Journal items load failed:", error);
      setAllItems([]);
    }
  }

  useEffect(() => {
    setHeader({
      title: collection?.name || "Collection",
      leftSlot: (
        <button onClick={() => router.push("/journal/collections")} className="text-sm text-neutral-400 transition hover:text-white">
          ← Collections
        </button>
      ),
      rightSlot: (
        <div className="flex items-center gap-2">
          <button onClick={() => { setAddOpen(true); loadAllItems(); }} className="flex h-8 w-8 items-center justify-center rounded-full text-lg leading-none text-neutral-300 transition hover:bg-white/[0.06] hover:text-white" aria-label="Add reflections">
            +
          </button>
          <button onClick={() => setMenuOpen((value) => !value)} className="flex h-8 w-8 items-center justify-center rounded-full text-lg leading-none text-neutral-300 transition hover:bg-white/[0.06] hover:text-white" aria-label="Collection actions">
            ⋯
          </button>
        </div>
      ),
    });

    return () => resetHeader();
  }, [collection?.name, resetHeader, router, setHeader]);

  useEffect(() => {
    loadCollection();
  }, [collectionId]);

  function toggleSelected(id: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function addSelected() {
    const journalIds = Array.from(selectedIds);
    if (!journalIds.length) return;

    try {
      const res = await fetch(`/api/journal/collections/${collectionId}/items`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ journalIds }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to add reflections");
      setSelectedIds(new Set());
      setAddOpen(false);
      await loadCollection();
    } catch (error) {
      console.error("Add reflections failed:", error);
      alert("Could not add reflections.");
    }
  }

  async function removeFromCollection(item: JournalItem) {
    const ok = confirm("Remove this reflection from the collection?");
    if (!ok) return;

    try {
      const res = await fetch(`/api/journal/collections/${collectionId}/items`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ journalIds: [item.id] }),
      });
      if (!res.ok) throw new Error();
      await loadCollection();
    } catch {
      alert("Could not remove reflection.");
    }
  }

  async function renameCollection() {
    if (!collection) return;
    const nextName = prompt("Collection name:", collection.name);
    if (!nextName || nextName.trim() === collection.name) return;

    try {
      const res = await fetch(`/api/journal/collections/${collection.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: nextName.trim() }),
      });
      if (!res.ok) throw new Error();
      setMenuOpen(false);
      await loadCollection();
    } catch {
      alert("Could not rename collection.");
    }
  }

  async function removeCollection() {
    if (!collection) return;
    const ok = confirm(`Remove “${collection.name}”? Reflections will stay in your journal.`);
    if (!ok) return;

    try {
      const res = await fetch(`/api/journal/collections/${collection.id}`, {
        method: "DELETE",
      });
      if (!res.ok) throw new Error();
      router.push("/journal/collections");
    } catch {
      alert("Could not remove collection.");
    }
  }

  const stripe = collection ? collectionColor[collection.color] ?? collectionColor.blue : collectionColor.blue;

  return (
    <AuthGate>
      <div className="min-h-[calc(100vh-108px)] bg-black text-white">
        {menuOpen && (
          <div className="fixed inset-0 z-[9997]" onClick={() => setMenuOpen(false)}>
            <div onClick={(event) => event.stopPropagation()} className="absolute right-4 top-[54px] w-[210px] overflow-hidden rounded-[22px] border border-white/10 bg-neutral-950/95 p-1.5 shadow-2xl shadow-black/50 backdrop-blur-xl">
              <button onClick={renameCollection} className="flex w-full items-center justify-between rounded-[16px] px-3.5 py-2.5 text-sm text-neutral-100 transition hover:bg-white/[0.06]">
                <span>Rename</span><span className="text-neutral-500">✎</span>
              </button>
              <button onClick={removeCollection} className="flex w-full items-center justify-between rounded-[16px] px-3.5 py-2.5 text-sm text-red-300 transition hover:bg-red-500/10">
                <span>Remove collection</span><span>×</span>
              </button>
            </div>
          </div>
        )}

        <div className="mx-auto max-w-xl px-4 pt-6 pb-28">
          {loading ? (
            <div className="space-y-3">
              {Array.from({ length: 4 }).map((_, index) => (
                <div key={index} className="h-[86px] animate-pulse rounded-[26px] border border-white/[0.07] bg-white/[0.035]" />
              ))}
            </div>
          ) : !collection ? (
            <div className="rounded-[28px] border border-white/10 bg-white/[0.03] px-5 py-8 text-center">
              <div className="text-sm font-medium text-white">Collection not found</div>
              <button onClick={() => router.push("/journal/collections")} className="mt-5 rounded-[18px] bg-white px-5 py-3 text-sm font-medium text-black transition hover:opacity-90">Back to collections</button>
            </div>
          ) : (
            <>
              <div className="mb-5 rounded-[30px] border border-white/10 bg-gradient-to-b from-white/[0.07] to-white/[0.025] px-5 py-5 shadow-2xl shadow-black/20">
                <div className="flex items-start gap-4">
                  <div className={`mt-1 h-14 w-[5px] rounded-full ${stripe}`} />
                  <div className="min-w-0 flex-1">
                    <div className="text-[11px] uppercase tracking-[0.18em] text-neutral-500">Collection</div>
                    <h1 className="mt-3 text-[26px] font-semibold tracking-[-0.04em] text-white">{collection.name}</h1>
                    <p className="mt-3 text-sm leading-relaxed text-neutral-400">{collection.count} saved reflection{collection.count === 1 ? "" : "s"} grouped together.</p>
                  </div>
                </div>
              </div>

              <div className="mx-auto w-[calc(100%-14px)] space-y-3">
                {items.length === 0 ? (
                  <div className="rounded-[28px] border border-white/10 bg-white/[0.03] px-5 py-8 text-center">
                    <div className="text-sm font-medium text-white">No reflections here yet</div>
                    <p className="mx-auto mt-2 max-w-sm text-sm leading-relaxed text-neutral-400">Add saved reflections to start building this collection.</p>
                    <button onClick={() => { setAddOpen(true); loadAllItems(); }} className="mt-5 rounded-[18px] bg-white px-5 py-3 text-sm font-medium text-black transition hover:opacity-90">Add reflections</button>
                  </div>
                ) : (
                  items.map((item) => {
                    const mood = getMood(item);
                    return (
                      <div key={item.id} className="relative w-full overflow-hidden rounded-[26px] border border-white/[0.07] bg-white/[0.035] px-4 py-4 transition hover:border-white/14 hover:bg-white/[0.055]">
                        <div className="flex items-center gap-4">
                          <div className={`h-11 w-[5px] shrink-0 rounded-full ${mood.stripe}`} />
                          <button onClick={() => router.push(`/journal/${item.id}`)} className="min-w-0 flex-1 text-left">
                            <h3 className="truncate text-[15px] font-medium text-white">{item.title || "Conversation"}</h3>
                            <p className="mt-1.5 line-clamp-1 text-[13px] text-neutral-400">{getPreview(item)}</p>
                            <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-neutral-500">
                              <span className={`rounded-full px-2.5 py-1 ${mood.softBg} text-neutral-200`}>{mood.label}</span>
                              <span>·</span>
                              <span>{getDateLabel(item.created_at)}</span>
                              <span>·</span>
                              <span>{getMessageLabel(getMessageCount(item))}</span>
                            </div>
                          </button>
                          <button onClick={() => removeFromCollection(item)} className="rounded-full px-2 py-1 text-lg leading-none text-neutral-500 transition hover:bg-white/[0.06] hover:text-white" aria-label="Remove from collection">×</button>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </>
          )}
        </div>

        {addOpen && (
          <div className="fixed inset-0 z-[9999] flex items-end justify-center bg-black/45 px-4 pb-[calc(env(safe-area-inset-bottom)+18px)] backdrop-blur-[2px] sm:items-center sm:pb-0" onClick={() => setAddOpen(false)}>
            <div onClick={(event) => event.stopPropagation()} className="max-h-[78vh] w-full max-w-[460px] overflow-hidden rounded-[30px] border border-white/10 bg-neutral-950/95 p-5 shadow-2xl shadow-black/60 backdrop-blur-xl">
              <div className="text-[11px] uppercase tracking-[0.18em] text-neutral-500">Add reflections</div>
              <h2 className="mt-3 text-xl font-semibold text-white">Choose saved reflections</h2>
              <p className="mt-2 text-sm leading-relaxed text-neutral-400">Selected reflections will be added to this collection.</p>

              <div className="mt-5 max-h-[44vh] space-y-2 overflow-y-auto pr-1">
                {availableItems.length === 0 ? (
                  <div className="rounded-[20px] border border-white/10 bg-white/[0.03] px-4 py-5 text-sm text-neutral-400">No available reflections to add.</div>
                ) : (
                  availableItems.map((item) => {
                    const selected = selectedIds.has(item.id);
                    return (
                      <button key={item.id} onClick={() => toggleSelected(item.id)} className={`flex w-full items-center gap-3 rounded-[20px] border px-4 py-3 text-left transition ${selected ? "border-white/35 bg-white/[0.08]" : "border-white/10 bg-white/[0.03] hover:bg-white/[0.05]"}`}>
                        <span className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full border text-xs ${selected ? "border-white bg-white text-black" : "border-white/20 text-transparent"}`}>✓</span>
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-sm font-medium text-white">{item.title || "Conversation"}</span>
                          <span className="mt-1 block truncate text-xs text-neutral-500">{getPreview(item)}</span>
                        </span>
                      </button>
                    );
                  })
                )}
              </div>

              <div className="mt-5 flex gap-3">
                <button onClick={() => setAddOpen(false)} className="flex-1 rounded-[18px] border border-white/10 bg-white/[0.03] px-4 py-3 text-sm font-medium text-white transition hover:bg-white/[0.05]">Cancel</button>
                <button onClick={addSelected} disabled={selectedIds.size === 0} className="flex-1 rounded-[18px] bg-white px-4 py-3 text-sm font-medium text-black transition hover:opacity-90 disabled:opacity-40">Add selected</button>
              </div>
            </div>
          </div>
        )}
      </div>
    </AuthGate>
  );
}
