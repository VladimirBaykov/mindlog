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

function getCollectionAccessKey(id: string) {
  return `mindlog:collection-access:${id}`;
}

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
  const [accessGranted, setAccessGranted] = useState(false);
  const [accessCode, setAccessCode] = useState("");
  const [checkingAccess, setCheckingAccess] = useState(false);

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

      const nextCollection = data.collection ?? null;
      setCollection(nextCollection);
      setItems(data.items ?? []);

      if (!nextCollection?.locked) {
        setAccessGranted(true);
      } else if (typeof window !== "undefined") {
        setAccessGranted(
          window.sessionStorage.getItem(getCollectionAccessKey(nextCollection.id)) === "1"
        );
      } else {
        setAccessGranted(false);
      }
    } catch (error) {
      console.error("Collection load failed:", error);
      setCollection(null);
      setItems([]);
      setAccessGranted(false);
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
      rightSlot: collection && accessGranted ? (
        <div className="flex items-center gap-2">
          <button onClick={() => { setAddOpen(true); loadAllItems(); }} className="flex h-8 w-8 items-center justify-center rounded-full text-lg leading-none text-neutral-300 transition hover:bg-white/[0.06] hover:text-white" aria-label="Add reflections">
            +
          </button>
          <button onClick={() => setMenuOpen((value) => !value)} className="flex h-8 w-8 items-center justify-center rounded-full text-lg leading-none text-neutral-300 transition hover:bg-white/[0.06] hover:text-white" aria-label="Collection actions">
            ⋯
          </button>
        </div>
      ) : null,
    });

    return () => resetHeader();
  }, [collection, accessGranted, resetHeader, router, setHeader]);

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

  async function verifyAccess() {
    if (!collection || checkingAccess) return;

    try {
      setCheckingAccess(true);
      const res = await fetch(`/api/journal/collections/${collection.id}/verify`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code: accessCode.trim() }),
      });
      const data = await res.json();
      if (!res.ok || !data.verified) throw new Error(data.error || "Incorrect code");

      window.sessionStorage.setItem(getCollectionAccessKey(collection.id), "1");
      setAccessGranted(true);
      setAccessCode("");
    } catch (error) {
      console.error("Collection access failed:", error);
      alert("Incorrect code.");
    } finally {
      setCheckingAccess(false);
    }
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

  async function setCollectionCode() {
    if (!collection) return;
    const nextCode = prompt("New 4–8 digit access code:", "");
    if (!nextCode) return;

    const code = nextCode.trim();

    if (!/^\d{4,8}$/.test(code)) {
      alert("Use a 4–8 digit code.");
      return;
    }

    try {
      const res = await fetch(`/api/journal/collections/${collection.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pin: code }),
      });
      if (!res.ok) throw new Error();
      window.sessionStorage.setItem(getCollectionAccessKey(collection.id), "1");
      setMenuOpen(false);
      await loadCollection();
    } catch {
      alert("Could not update access code.");
    }
  }

  async function clearCollectionCode() {
    if (!collection) return;
    const ok = confirm("Remove access code from this collection?");
    if (!ok) return;

    try {
      const res = await fetch(`/api/journal/collections/${collection.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ clearPin: true }),
      });
      if (!res.ok) throw new Error();
      window.sessionStorage.removeItem(getCollectionAccessKey(collection.id));
      setMenuOpen(false);
      await loadCollection();
    } catch {
      alert("Could not remove access code.");
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
        {menuOpen && collection && accessGranted && (
          <div className="fixed inset-0 z-[9997]" onClick={() => setMenuOpen(false)}>
            <div onClick={(event) => event.stopPropagation()} className="absolute right-4 top-[54px] w-[230px] overflow-hidden rounded-[22px] border border-white/10 bg-neutral-950/95 p-1.5 shadow-2xl shadow-black/50 backdrop-blur-xl">
              <button onClick={renameCollection} className="flex w-full items-center justify-between rounded-[16px] px-3.5 py-2.5 text-sm text-neutral-100 transition hover:bg-white/[0.06]">
                <span>Rename</span><span className="text-neutral-500">✎</span>
              </button>
              <button onClick={setCollectionCode} className="flex w-full items-center justify-between rounded-[16px] px-3.5 py-2.5 text-sm text-neutral-100 transition hover:bg-white/[0.06]">
                <span>{collection.locked ? "Change code" : "Set code"}</span><span className="text-neutral-500">Lock</span>
              </button>
              {collection.locked && (
                <button onClick={clearCollectionCode} className="flex w-full items-center justify-between rounded-[16px] px-3.5 py-2.5 text-sm text-neutral-100 transition hover:bg-white/[0.06]">
                  <span>Remove code</span><span className="text-neutral-500">Open</span>
                </button>
              )}
              <div className="my-1 h-px bg-white/[0.08]" />
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
          ) : collection.locked && !accessGranted ? (
            <div className="rounded-[30px] border border-white/10 bg-gradient-to-b from-white/[0.07] to-white/[0.025] px-5 py-7 text-center shadow-2xl shadow-black/20">
              <div className={`mx-auto h-14 w-[5px] rounded-full ${stripe}`} />
              <div className="mt-5 text-[11px] uppercase tracking-[0.18em] text-neutral-500">Locked collection</div>
              <h1 className="mt-3 text-[26px] font-semibold tracking-[-0.04em] text-white">{collection.name}</h1>
              <p className="mx-auto mt-3 max-w-sm text-sm leading-relaxed text-neutral-400">Enter the access code to view this collection on this device session.</p>
              <input value={accessCode} onChange={(event) => setAccessCode(event.target.value.replace(/\D/g, "").slice(0, 8))} inputMode="numeric" autoFocus placeholder="Code" className="mx-auto mt-6 block w-full max-w-[260px] rounded-[18px] border border-white/10 bg-white/[0.04] px-4 py-3 text-center text-lg tracking-[0.2em] text-white outline-none transition placeholder:text-neutral-600 focus:border-white/25" />
              <button onClick={verifyAccess} disabled={!accessCode || checkingAccess} className="mt-5 rounded-[18px] bg-white px-5 py-3 text-sm font-medium text-black transition hover:opacity-90 disabled:opacity-40">{checkingAccess ? "Checking..." : "Unlock collection"}</button>
            </div>
          ) : (
            <>
              <div className="mb-5 rounded-[30px] border border-white/10 bg-gradient-to-b from-white/[0.07] to-white/[0.025] px-5 py-5 shadow-2xl shadow-black/20">
                <div className="flex items-start gap-4">
                  <div className={`mt-1 h-14 w-[5px] rounded-full ${stripe}`} />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <div className="text-[11px] uppercase tracking-[0.18em] text-neutral-500">Collection</div>
                      {collection.locked && (
                        <span className="rounded-full border border-white/10 bg-white/[0.05] px-2 py-0.5 text-[10px] uppercase tracking-[0.12em] text-neutral-300">Locked</span>
                      )}
                    </div>
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
            <div onClick={(event) => event.stopPropagation()} className="w-full max-w-[440px] rounded-[30px] border border-white/10 bg-neutral-950/95 p-5 shadow-2xl shadow-black/60 backdrop-blur-xl">
              <div className="text-[11px] uppercase tracking-[0.18em] text-neutral-500">Add reflections</div>
              <h2 className="mt-3 text-xl font-semibold text-white">Choose reflections</h2>
              <div className="mt-5 max-h-[360px] space-y-2 overflow-y-auto pr-1">
                {availableItems.length === 0 ? (
                  <div className="rounded-[20px] border border-white/10 bg-white/[0.03] px-4 py-5 text-sm text-neutral-400">No available reflections to add.</div>
                ) : (
                  availableItems.map((item) => {
                    const selected = selectedIds.has(item.id);
                    const mood = getMood(item);
                    return (
                      <button key={item.id} onClick={() => toggleSelected(item.id)} className={`flex w-full items-center gap-3 rounded-[20px] border px-3 py-3 text-left transition ${selected ? "border-white/35 bg-white/[0.08]" : "border-white/10 bg-white/[0.03] hover:bg-white/[0.05]"}`}>
                        <div className={`h-9 w-[4px] rounded-full ${mood.stripe}`} />
                        <div className="min-w-0 flex-1">
                          <div className="truncate text-sm font-medium text-white">{item.title || "Conversation"}</div>
                          <div className="mt-1 truncate text-xs text-neutral-500">{getPreview(item)}</div>
                        </div>
                        <div className={`flex h-5 w-5 items-center justify-center rounded-full border text-[11px] ${selected ? "border-white bg-white text-black" : "border-white/20 text-transparent"}`}>✓</div>
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
