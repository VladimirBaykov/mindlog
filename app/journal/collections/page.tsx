"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import AuthGate from "@/components/AuthGate";
import { useHeader } from "@/components/header/HeaderContext";

const COLORS = [
  "slate",
  "blue",
  "purple",
  "rose",
  "amber",
  "emerald",
  "cyan",
  "pink",
] as const;

type CollectionColor = (typeof COLORS)[number];

type CollectionItem = {
  id: string;
  name: string;
  color: CollectionColor;
  locked: boolean;
  count: number;
  createdAt: string;
  updatedAt: string | null;
};

const colorStyles: Record<CollectionColor, { label: string; stripe: string }> = {
  slate: { label: "Slate", stripe: "bg-slate-300" },
  blue: { label: "Blue", stripe: "bg-blue-400" },
  purple: { label: "Purple", stripe: "bg-purple-400" },
  rose: { label: "Rose", stripe: "bg-rose-400" },
  amber: { label: "Amber", stripe: "bg-amber-300" },
  emerald: { label: "Emerald", stripe: "bg-emerald-300" },
  cyan: { label: "Cyan", stripe: "bg-cyan-300" },
  pink: { label: "Pink", stripe: "bg-pink-400" },
};

function parseAddIds(value: string | null) {
  if (!value) return [];
  return Array.from(
    new Set(value.split(",").map((item) => item.trim()).filter(Boolean))
  );
}

function getCountLabel(count: number) {
  return `${count} reflection${count === 1 ? "" : "s"}`;
}

function getCollectionAccessKey(id: string) {
  return `mindlog:collection-access:${id}`;
}

function isCollectionAccessGranted(collection: CollectionItem) {
  if (!collection.locked) return true;
  if (typeof window === "undefined") return false;
  return window.sessionStorage.getItem(getCollectionAccessKey(collection.id)) === "1";
}

export default function JournalCollectionsPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { setHeader, resetHeader } = useHeader();

  const [items, setItems] = useState<CollectionItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [createOpen, setCreateOpen] = useState(false);
  const [name, setName] = useState("");
  const [color, setColor] = useState<CollectionColor>("blue");
  const [accessCode, setAccessCode] = useState("");
  const [saving, setSaving] = useState(false);
  const [verifyOpen, setVerifyOpen] = useState(false);
  const [verifyCode, setVerifyCode] = useState("");
  const [verifying, setVerifying] = useState(false);
  const [pendingCollection, setPendingCollection] = useState<CollectionItem | null>(null);

  const addIds = useMemo(() => parseAddIds(searchParams.get("add")), [searchParams]);
  const isAddMode = addIds.length > 0;

  async function loadCollections() {
    try {
      setLoading(true);
      const res = await fetch("/api/journal/collections", { cache: "no-store" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to load collections");
      setItems(data.items ?? []);
    } catch (error) {
      console.error("Collections load failed:", error);
      setItems([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    setHeader({
      title: "Collections",
      leftSlot: (
        <button
          onClick={() => router.push("/journal")}
          className="text-sm text-neutral-400 transition hover:text-white"
        >
          ← Journal
        </button>
      ),
      rightSlot: (
        <button
          onClick={() => setCreateOpen(true)}
          className="flex h-8 w-8 items-center justify-center rounded-full text-lg leading-none text-neutral-300 transition hover:bg-white/[0.06] hover:text-white"
          aria-label="Create collection"
        >
          +
        </button>
      ),
    });

    return () => resetHeader();
  }, [resetHeader, router, setHeader]);

  useEffect(() => {
    loadCollections();
  }, []);

  async function createCollection() {
    const trimmed = name.trim();
    const trimmedCode = accessCode.trim();

    if (!trimmed || saving) return;

    if (trimmedCode && !/^\d{4,8}$/.test(trimmedCode)) {
      alert("Use a 4–8 digit code.");
      return;
    }

    try {
      setSaving(true);
      const res = await fetch("/api/journal/collections", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: trimmed,
          color,
          pin: trimmedCode || undefined,
          journalIds: addIds,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to create collection");
      setName("");
      setColor("blue");
      setAccessCode("");
      setCreateOpen(false);

      if (data.locked && typeof window !== "undefined") {
        window.sessionStorage.setItem(getCollectionAccessKey(data.id), "1");
      }

      router.push(`/journal/collections/${data.id}`);
    } catch (error) {
      console.error("Create collection failed:", error);
      alert("Could not create collection.");
    } finally {
      setSaving(false);
    }
  }

  async function addSelectedToCollection(collection: CollectionItem) {
    try {
      const res = await fetch(`/api/journal/collections/${collection.id}/items`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ journalIds: addIds }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to add reflections");
      router.push(`/journal/collections/${collection.id}`);
    } catch (error) {
      console.error("Add to collection failed:", error);
      alert("Could not add reflections to this collection.");
    }
  }

  async function openOrAdd(collection: CollectionItem) {
    if (collection.locked && !isCollectionAccessGranted(collection)) {
      setPendingCollection(collection);
      setVerifyCode("");
      setVerifyOpen(true);
      return;
    }

    if (isAddMode) {
      await addSelectedToCollection(collection);
      return;
    }

    router.push(`/journal/collections/${collection.id}`);
  }

  async function verifyCollectionAccess() {
    if (!pendingCollection || verifying) return;

    try {
      setVerifying(true);
      const res = await fetch(`/api/journal/collections/${pendingCollection.id}/verify`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code: verifyCode.trim() }),
      });
      const data = await res.json();
      if (!res.ok || !data.verified) throw new Error(data.error || "Incorrect code");

      window.sessionStorage.setItem(getCollectionAccessKey(pendingCollection.id), "1");
      setVerifyOpen(false);
      setVerifyCode("");

      if (isAddMode) {
        await addSelectedToCollection(pendingCollection);
      } else {
        router.push(`/journal/collections/${pendingCollection.id}`);
      }
    } catch (error) {
      console.error("Collection verification failed:", error);
      alert("Incorrect code.");
    } finally {
      setVerifying(false);
    }
  }

  async function renameCollection(collection: CollectionItem) {
    const nextName = prompt("Collection name:", collection.name);
    if (!nextName || nextName.trim() === collection.name) return;

    try {
      const res = await fetch(`/api/journal/collections/${collection.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: nextName.trim() }),
      });
      if (!res.ok) throw new Error();
      await loadCollections();
    } catch {
      alert("Could not rename collection.");
    }
  }

  async function removeCollection(collection: CollectionItem) {
    const ok = confirm(`Remove “${collection.name}”? Reflections will stay in your journal.`);
    if (!ok) return;

    try {
      const res = await fetch(`/api/journal/collections/${collection.id}`, { method: "DELETE" });
      if (!res.ok) throw new Error();
      await loadCollections();
    } catch {
      alert("Could not remove collection.");
    }
  }

  return (
    <AuthGate>
      <div className="min-h-[calc(100vh-108px)] bg-black text-white">
        <div className="mx-auto max-w-xl px-4 pt-6 pb-28">
          {isAddMode && (
            <div className="mb-5 rounded-[26px] border border-cyan-300/20 bg-cyan-300/10 px-5 py-5">
              <div className="text-[11px] uppercase tracking-[0.18em] text-cyan-100/80">
                Add to collection
              </div>
              <p className="mt-3 text-sm leading-relaxed text-cyan-50/90">
                Choose a collection for {addIds.length} selected reflection{addIds.length === 1 ? "" : "s"}, or create a new one.
              </p>
            </div>
          )}

          <div className="mb-5 rounded-[30px] border border-white/10 bg-gradient-to-b from-white/[0.07] to-white/[0.025] px-5 py-5 shadow-2xl shadow-black/20">
            <div className="text-[11px] uppercase tracking-[0.18em] text-neutral-500">
              Reflection collections
            </div>
            <h1 className="mt-3 text-[26px] font-semibold tracking-[-0.04em] text-white">
              Organize what matters.
            </h1>
            <p className="mt-3 max-w-md text-sm leading-relaxed text-neutral-400">
              Group saved reflections by theme, chapter, person, project, or anything you want to revisit together.
            </p>
          </div>

          <div className="mx-auto w-[calc(100%-14px)] space-y-3">
            {!isAddMode && (
              <>
                <button
                  onClick={() => router.push("/journal?view=favorites")}
                  className="relative w-full overflow-hidden rounded-[26px] border border-white/[0.07] bg-white/[0.035] px-4 py-4 text-left transition hover:border-white/14 hover:bg-white/[0.055]"
                >
                  <div className="flex items-center gap-4">
                    <div className="h-11 w-[5px] shrink-0 rounded-full bg-white" />
                    <div className="min-w-0 flex-1">
                      <h3 className="truncate text-[15px] font-medium text-white">Favorites ♥</h3>
                      <p className="mt-1.5 text-[13px] text-neutral-400">Reflections you marked as important.</p>
                    </div>
                  </div>
                </button>

                <button
                  onClick={() => router.push("/journal?view=hidden")}
                  className="relative w-full overflow-hidden rounded-[26px] border border-white/[0.07] bg-white/[0.035] px-4 py-4 text-left transition hover:border-white/14 hover:bg-white/[0.055]"
                >
                  <div className="flex items-center gap-4">
                    <div className="h-11 w-[5px] shrink-0 rounded-full bg-neutral-400" />
                    <div className="min-w-0 flex-1">
                      <h3 className="truncate text-[15px] font-medium text-white">Hidden</h3>
                      <p className="mt-1.5 text-[13px] text-neutral-400">Reflections tucked away from the main journal.</p>
                    </div>
                  </div>
                </button>
              </>
            )}

            {loading ? (
              Array.from({ length: 3 }).map((_, index) => (
                <div key={index} className="h-[86px] animate-pulse rounded-[26px] border border-white/[0.07] bg-white/[0.035]" />
              ))
            ) : items.length === 0 ? (
              <div className="rounded-[28px] border border-white/10 bg-white/[0.03] px-5 py-8 text-center">
                <div className="text-sm font-medium text-white">No custom collections yet</div>
                <p className="mx-auto mt-2 max-w-sm text-sm leading-relaxed text-neutral-400">Create your first collection to group reflections.</p>
                <button onClick={() => setCreateOpen(true)} className="mt-5 rounded-[18px] bg-white px-5 py-3 text-sm font-medium text-black transition hover:opacity-90">Create collection</button>
              </div>
            ) : (
              items.map((collection) => {
                const style = colorStyles[collection.color] ?? colorStyles.blue;
                return (
                  <div key={collection.id} className="relative w-full overflow-hidden rounded-[26px] border border-white/[0.07] bg-white/[0.035] px-4 py-4 transition hover:border-white/14 hover:bg-white/[0.055]">
                    <div className="flex items-center gap-4">
                      <button onClick={() => openOrAdd(collection)} className={`h-11 w-[5px] shrink-0 rounded-full ${style.stripe}`} aria-label={`Open ${collection.name}`} />
                      <button onClick={() => openOrAdd(collection)} className="min-w-0 flex-1 text-left">
                        <div className="flex min-w-0 items-center gap-2">
                          <h3 className="truncate text-[15px] font-medium text-white">{collection.name}</h3>
                          {collection.locked && (
                            <span className="shrink-0 rounded-full border border-white/10 bg-white/[0.05] px-2 py-0.5 text-[10px] uppercase tracking-[0.12em] text-neutral-300">
                              Locked
                            </span>
                          )}
                        </div>
                        <p className="mt-1.5 text-[13px] text-neutral-400">{getCountLabel(collection.count)} · {style.label}</p>
                      </button>
                      {!isAddMode && (
                        <button onClick={() => renameCollection(collection)} className="rounded-full px-2 py-1 text-lg leading-none text-neutral-500 transition hover:bg-white/[0.06] hover:text-white" aria-label="Rename collection">✎</button>
                      )}
                      {!isAddMode && (
                        <button onClick={() => removeCollection(collection)} className="rounded-full px-2 py-1 text-lg leading-none text-red-300 transition hover:bg-red-500/10" aria-label="Remove collection">×</button>
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {createOpen && (
          <div className="fixed inset-0 z-[9999] flex items-end justify-center bg-black/45 px-4 pb-[calc(env(safe-area-inset-bottom)+18px)] backdrop-blur-[2px] sm:items-center sm:pb-0" onClick={() => setCreateOpen(false)}>
            <div onClick={(event) => event.stopPropagation()} className="w-full max-w-[420px] rounded-[30px] border border-white/10 bg-neutral-950/95 p-5 shadow-2xl shadow-black/60 backdrop-blur-xl">
              <div className="text-[11px] uppercase tracking-[0.18em] text-neutral-500">New collection</div>
              <h2 className="mt-3 text-xl font-semibold text-white">Create a reflection collection</h2>
              <p className="mt-2 text-sm leading-relaxed text-neutral-400">Choose a name, color, and optional access code.</p>

              <input value={name} onChange={(event) => setName(event.target.value)} placeholder="Collection name" className="mt-5 w-full rounded-[18px] border border-white/10 bg-white/[0.04] px-4 py-3 text-sm text-white outline-none transition placeholder:text-neutral-600 focus:border-white/25" />

              <input value={accessCode} onChange={(event) => setAccessCode(event.target.value.replace(/\D/g, "").slice(0, 8))} inputMode="numeric" placeholder="Optional 4–8 digit code" className="mt-3 w-full rounded-[18px] border border-white/10 bg-white/[0.04] px-4 py-3 text-sm text-white outline-none transition placeholder:text-neutral-600 focus:border-white/25" />

              <div className="mt-4 grid grid-cols-4 gap-2">
                {COLORS.map((option) => {
                  const style = colorStyles[option];
                  const active = option === color;
                  return (
                    <button key={option} onClick={() => setColor(option)} className={`rounded-[18px] border px-3 py-3 text-xs transition ${active ? "border-white/35 bg-white/[0.08] text-white" : "border-white/10 bg-white/[0.03] text-neutral-400 hover:bg-white/[0.05]"}`}>
                      <span className={`mx-auto block h-6 w-1 rounded-full ${style.stripe}`} />
                      <span className="mt-2 block">{style.label}</span>
                    </button>
                  );
                })}
              </div>

              <div className="mt-5 flex gap-3">
                <button onClick={() => setCreateOpen(false)} className="flex-1 rounded-[18px] border border-white/10 bg-white/[0.03] px-4 py-3 text-sm font-medium text-white transition hover:bg-white/[0.05]">Cancel</button>
                <button onClick={createCollection} disabled={!name.trim() || saving} className="flex-1 rounded-[18px] bg-white px-4 py-3 text-sm font-medium text-black transition hover:opacity-90 disabled:opacity-40">{saving ? "Creating..." : "Create"}</button>
              </div>
            </div>
          </div>
        )}

        {verifyOpen && pendingCollection && (
          <div className="fixed inset-0 z-[9999] flex items-end justify-center bg-black/50 px-4 pb-[calc(env(safe-area-inset-bottom)+18px)] backdrop-blur-[2px] sm:items-center sm:pb-0" onClick={() => setVerifyOpen(false)}>
            <div onClick={(event) => event.stopPropagation()} className="w-full max-w-[380px] rounded-[30px] border border-white/10 bg-neutral-950/95 p-5 shadow-2xl shadow-black/60 backdrop-blur-xl">
              <div className="text-[11px] uppercase tracking-[0.18em] text-neutral-500">Locked collection</div>
              <h2 className="mt-3 text-xl font-semibold text-white">Enter access code</h2>
              <p className="mt-2 text-sm leading-relaxed text-neutral-400">“{pendingCollection.name}” is locked on this device session.</p>
              <input value={verifyCode} onChange={(event) => setVerifyCode(event.target.value.replace(/\D/g, "").slice(0, 8))} inputMode="numeric" autoFocus placeholder="Code" className="mt-5 w-full rounded-[18px] border border-white/10 bg-white/[0.04] px-4 py-3 text-center text-lg tracking-[0.2em] text-white outline-none transition placeholder:text-neutral-600 focus:border-white/25" />
              <div className="mt-5 flex gap-3">
                <button onClick={() => setVerifyOpen(false)} className="flex-1 rounded-[18px] border border-white/10 bg-white/[0.03] px-4 py-3 text-sm font-medium text-white transition hover:bg-white/[0.05]">Cancel</button>
                <button onClick={verifyCollectionAccess} disabled={!verifyCode || verifying} className="flex-1 rounded-[18px] bg-white px-4 py-3 text-sm font-medium text-black transition hover:opacity-90 disabled:opacity-40">{verifying ? "Checking..." : "Unlock"}</button>
              </div>
            </div>
          </div>
        )}
      </div>
    </AuthGate>
  );
}
