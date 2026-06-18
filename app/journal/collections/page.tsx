"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import AuthGate from "@/components/AuthGate";
import { useHeader } from "@/components/header/HeaderContext";
import AccessCodeDialog from "@/components/journal/AccessCodeDialog";
import TextInputDialog from "@/components/journal/TextInputDialog";

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

type ViewLocks = {
  favorites: boolean;
  hidden: boolean;
};

type IconName =
  | "dots"
  | "open"
  | "edit"
  | "palette"
  | "trash"
  | "heart"
  | "eyeOff"
  | "lock"
  | "unlock";

type CodeDialogState =
  | { kind: "set"; collection: CollectionItem }
  | { kind: "currentForChange"; collection: CollectionItem }
  | { kind: "newAfterCurrent"; collection: CollectionItem; currentPin: string }
  | { kind: "currentForRemove"; collection: CollectionItem }
  | { kind: "confirmRemove"; collection: CollectionItem; currentPin: string };

const colorStyles: Record<CollectionColor, { label: string; stripe: string; glow: string }> = {
  slate: {
    label: "Slate",
    stripe: "bg-slate-300",
    glow: "shadow-[0_0_18px_rgba(203,213,225,0.26)]",
  },
  blue: {
    label: "Blue",
    stripe: "bg-blue-400",
    glow: "shadow-[0_0_18px_rgba(96,165,250,0.28)]",
  },
  purple: {
    label: "Purple",
    stripe: "bg-purple-400",
    glow: "shadow-[0_0_18px_rgba(192,132,252,0.28)]",
  },
  rose: {
    label: "Rose",
    stripe: "bg-rose-400",
    glow: "shadow-[0_0_18px_rgba(251,113,133,0.28)]",
  },
  amber: {
    label: "Amber",
    stripe: "bg-amber-300",
    glow: "shadow-[0_0_18px_rgba(252,211,77,0.24)]",
  },
  emerald: {
    label: "Emerald",
    stripe: "bg-emerald-300",
    glow: "shadow-[0_0_18px_rgba(110,231,183,0.24)]",
  },
  cyan: {
    label: "Cyan",
    stripe: "bg-cyan-300",
    glow: "shadow-[0_0_18px_rgba(103,232,249,0.24)]",
  },
  pink: {
    label: "Pink",
    stripe: "bg-pink-400",
    glow: "shadow-[0_0_18px_rgba(244,114,182,0.26)]",
  },
};

function parseAddIds(value: string | null) {
  if (!value) return [];
  return Array.from(
    new Set(value.split(",").map((item) => item.trim()).filter(Boolean)),
  );
}

function getCountLabel(count: number) {
  return `${count} reflection${count === 1 ? "" : "s"}`;
}

function formatCollectionDate(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Unknown";

  const now = new Date();
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const startOfDate = new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();
  const diffDays = Math.round((startOfToday - startOfDate) / 86400000);

  if (diffDays === 0) return "Today";
  if (diffDays === 1) return "Yesterday";

  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: date.getFullYear() === now.getFullYear() ? undefined : "numeric",
  });
}

function ActionIcon({ name, className = "" }: { name: IconName; className?: string }) {
  const common = {
    className: `h-[1.08rem] w-[1.08rem] ${className}`,
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 2.15,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
    "aria-hidden": true,
  };

  if (name === "dots") {
    return (
      <svg {...common}>
        <path d="M6.5 12h.01" />
        <path d="M12 12h.01" />
        <path d="M17.5 12h.01" />
      </svg>
    );
  }

  if (name === "open") {
    return (
      <svg {...common}>
        <path d="M7 17 17 7" />
        <path d="M9 7h8v8" />
        <path d="M19 12v5.5A2.5 2.5 0 0 1 16.5 20h-10A2.5 2.5 0 0 1 4 17.5v-10A2.5 2.5 0 0 1 6.5 5H12" />
      </svg>
    );
  }

  if (name === "edit") {
    return (
      <svg {...common}>
        <path d="M12 20h9" />
        <path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z" />
      </svg>
    );
  }

  if (name === "palette") {
    return (
      <svg {...common}>
        <path d="M12 21a9 9 0 1 1 9-9 3 3 0 0 1-3 3h-1.2a2 2 0 0 0-1.4 3.4l.3.3A1.4 1.4 0 0 1 14.7 21Z" />
        <path d="M7.5 10.5h.01" />
        <path d="M10 7.5h.01" />
        <path d="M14 7.5h.01" />
        <path d="M16.5 10.5h.01" />
      </svg>
    );
  }

  if (name === "trash") {
    return (
      <svg {...common}>
        <path d="M3 6h18" />
        <path d="M8 6V4h8v2" />
        <path d="M19 6l-1 14H6L5 6" />
        <path d="M10 11v5" />
        <path d="M14 11v5" />
      </svg>
    );
  }

  if (name === "heart") {
    return (
      <svg {...common} fill="currentColor" stroke="none">
        <path d="M12 21.1 4.3 13.8C2.5 12.1 1.5 10.2 1.5 8.2 1.5 5.1 3.9 2.8 7 2.8c1.8 0 3.6.9 5 2.5 1.4-1.6 3.2-2.5 5-2.5 3.1 0 5.5 2.3 5.5 5.4 0 2-1 3.9-2.8 5.6Z" />
      </svg>
    );
  }

  if (name === "eyeOff") {
    return (
      <svg {...common}>
        <path d="M3 3l18 18" />
        <path d="M10.6 10.6a2 2 0 0 0 2.8 2.8" />
        <path d="M9.5 5.2A9.5 9.5 0 0 1 12 5c5.5 0 9 5 9 7a10.6 10.6 0 0 1-2.1 3.2" />
        <path d="M6.4 6.5C3.9 8.1 2.4 10.7 3 12c1 2.1 4.2 7 9 7a9.8 9.8 0 0 0 3.2-.5" />
      </svg>
    );
  }

  if (name === "unlock") {
    return (
      <svg {...common}>
        <rect x="5" y="10" width="14" height="10" rx="2.5" />
        <path d="M8 10V7.8a4 4 0 0 1 7.3-2.3" />
      </svg>
    );
  }

  return (
    <svg {...common}>
      <rect x="5" y="10" width="14" height="10" rx="2.5" />
      <path d="M8 10V7a4 4 0 0 1 8 0v3" />
    </svg>
  );
}

function StatusIcon({ name, label }: { name: Exclude<IconName, "dots" | "open" | "edit" | "palette" | "trash" | "unlock">; label: string }) {
  return (
    <span
      className="inline-flex h-5 w-5 shrink-0 items-center justify-center text-white/88 drop-shadow-[0_0_7px_rgba(255,255,255,0.18)]"
      aria-label={label}
      title={label}
    >
      <ActionIcon name={name} className="h-[1.02rem] w-[1.02rem]" />
    </span>
  );
}

function Stripe({ className, glow }: { className: string; glow?: string }) {
  return (
    <span
      aria-hidden="true"
      className={`block h-[3.75rem] w-[3px] shrink-0 rounded-full ${className} ${glow ?? "shadow-[0_0_18px_rgba(255,255,255,0.2)]"}`}
    />
  );
}

function MenuButton({
  label,
  icon,
  destructive = false,
  onClick,
}: {
  label: string;
  icon: IconName;
  destructive?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={`flex w-full items-center justify-between gap-3 rounded-[16px] px-3 py-2.5 text-left text-[15px] font-medium transition ${
        destructive
          ? "text-red-300 hover:bg-red-500/10"
          : "text-neutral-100 hover:bg-white/[0.06]"
      }`}
    >
      <span>{label}</span>
      <ActionIcon name={icon} className="h-[1.12rem] w-[1.12rem]" />
    </button>
  );
}

export default function JournalCollectionsPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { setHeader, resetHeader } = useHeader();

  const [items, setItems] = useState<CollectionItem[]>([]);
  const [viewLocks, setViewLocks] = useState<ViewLocks>({
    favorites: false,
    hidden: false,
  });
  const [loading, setLoading] = useState(true);
  const [createOpen, setCreateOpen] = useState(false);
  const [name, setName] = useState("");
  const [color, setColor] = useState<CollectionColor>("blue");
  const [accessCode, setAccessCode] = useState("");
  const [saving, setSaving] = useState(false);
  const [createError, setCreateError] = useState("");
  const [pageError, setPageError] = useState("");
  const [activeMenuId, setActiveMenuId] = useState<string | null>(null);
  const [renameDialog, setRenameDialog] = useState<CollectionItem | null>(null);
  const [removeDialog, setRemoveDialog] = useState<CollectionItem | null>(null);
  const [colorDialog, setColorDialog] = useState<{ collection: CollectionItem; color: CollectionColor } | null>(null);
  const [codeDialog, setCodeDialog] = useState<CodeDialogState | null>(null);
  const [actionLoading, setActionLoading] = useState(false);

  const addIds = useMemo(() => parseAddIds(searchParams.get("add")), [searchParams]);
  const isAddMode = addIds.length > 0;

  async function loadCollections() {
    try {
      setLoading(true);
      const [collectionsRes, locksRes] = await Promise.all([
        fetch("/api/journal/collections", { cache: "no-store" }),
        fetch("/api/journal/view-locks", { cache: "no-store" }),
      ]);

      const collectionsData = await collectionsRes.json();
      if (!collectionsRes.ok) {
        throw new Error(collectionsData.error || "Failed to load collections");
      }
      setItems(collectionsData.items ?? []);

      if (locksRes.ok) {
        const locksData = await locksRes.json();
        setViewLocks({
          favorites: Boolean(locksData.favorites),
          hidden: Boolean(locksData.hidden),
        });
      }
    } catch (error) {
      console.error("Collections load failed:", error);
      setItems([]);
      setPageError("Could not load collections.");
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
          onClick={() => {
            setCreateError("");
            setCreateOpen(true);
          }}
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
      setCreateError("Use a 4–8 digit code.");
      return;
    }

    try {
      setSaving(true);
      setCreateError("");
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
      router.push(`/journal/collections/${data.id}`);
    } catch (error) {
      console.error("Create collection failed:", error);
      setCreateError("Could not create collection.");
    } finally {
      setSaving(false);
    }
  }

  async function addSelectedToCollection(collection: CollectionItem) {
    try {
      setPageError("");
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
      setPageError("Could not add reflections to this collection.");
    }
  }

  async function openOrAdd(collection: CollectionItem) {
    if (isAddMode) {
      await addSelectedToCollection(collection);
      return;
    }

    router.push(`/journal/collections/${collection.id}`);
  }

  function openRenameDialog(collection: CollectionItem) {
    setActiveMenuId(null);
    setRenameDialog(collection);
  }

  function openRemoveDialog(collection: CollectionItem) {
    setActiveMenuId(null);
    setRemoveDialog(collection);
  }

  function openColorDialog(collection: CollectionItem) {
    setActiveMenuId(null);
    setColorDialog({ collection, color: collection.color });
  }

  function openSetOrChangeCode(collection: CollectionItem) {
    setActiveMenuId(null);
    setCodeDialog(collection.locked ? { kind: "currentForChange", collection } : { kind: "set", collection });
  }

  function openRemoveCode(collection: CollectionItem) {
    setActiveMenuId(null);
    setCodeDialog({ kind: "currentForRemove", collection });
  }

  async function patchCollection(
    collection: CollectionItem,
    body: Record<string, unknown>,
    fallbackMessage: string,
  ) {
    const res = await fetch(`/api/journal/collections/${collection.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || fallbackMessage);
    await loadCollections();
  }

  async function verifyCollectionCode(collection: CollectionItem, code: string) {
    const res = await fetch(`/api/journal/collections/${collection.id}/verify`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ code }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok || !data.verified) throw new Error(data.error || "Incorrect code.");
  }

  async function confirmRenameCollection(nextName: string) {
    if (!renameDialog) return;

    const trimmedName = nextName.trim();
    if (!trimmedName || trimmedName === renameDialog.name) {
      setRenameDialog(null);
      return;
    }

    try {
      setActionLoading(true);
      await patchCollection(renameDialog, { name: trimmedName }, "Could not rename collection.");
      setRenameDialog(null);
    } finally {
      setActionLoading(false);
    }
  }

  async function confirmColorChange() {
    if (!colorDialog) return;

    try {
      setActionLoading(true);
      await patchCollection(colorDialog.collection, { color: colorDialog.color }, "Could not update color.");
      setColorDialog(null);
    } finally {
      setActionLoading(false);
    }
  }

  async function confirmRemoveCollection() {
    if (!removeDialog) return;

    try {
      setActionLoading(true);
      const res = await fetch(`/api/journal/collections/${removeDialog.id}`, {
        method: "DELETE",
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Could not remove collection.");
      setRemoveDialog(null);
      await loadCollections();
    } finally {
      setActionLoading(false);
    }
  }

  async function confirmCodeDialog(code?: string) {
    if (!codeDialog) return;

    try {
      setActionLoading(true);

      if (codeDialog.kind === "set") {
        await patchCollection(codeDialog.collection, { pin: code }, "Could not set code.");
        setCodeDialog(null);
        return;
      }

      if (codeDialog.kind === "currentForChange") {
        if (!code) return;
        await verifyCollectionCode(codeDialog.collection, code);
        setCodeDialog({ kind: "newAfterCurrent", collection: codeDialog.collection, currentPin: code });
        return;
      }

      if (codeDialog.kind === "newAfterCurrent") {
        await patchCollection(
          codeDialog.collection,
          { pin: code, currentPin: codeDialog.currentPin },
          "Could not change code.",
        );
        setCodeDialog(null);
        return;
      }

      if (codeDialog.kind === "currentForRemove") {
        if (!code) return;
        await verifyCollectionCode(codeDialog.collection, code);
        setCodeDialog({ kind: "confirmRemove", collection: codeDialog.collection, currentPin: code });
        return;
      }

      await patchCollection(
        codeDialog.collection,
        { clearPin: true, currentPin: codeDialog.currentPin },
        "Could not remove code.",
      );
      setCodeDialog(null);
    } finally {
      setActionLoading(false);
    }
  }

  function getCodeDialogCopy(state: CodeDialogState | null) {
    if (!state) {
      return {
        mode: "code" as const,
        title: "Access code",
        description: "Enter the collection access code.",
        confirmLabel: "Continue",
        destructive: false,
      };
    }

    if (state.kind === "set") {
      return {
        mode: "code" as const,
        title: "Set collection code",
        description: `Protect “${state.collection.name}” with a 4–8 digit code.`,
        confirmLabel: "Set code",
        destructive: false,
      };
    }

    if (state.kind === "currentForChange") {
      return {
        mode: "code" as const,
        title: "Enter current code",
        description: `Enter the current code for “${state.collection.name}” before changing it.`,
        confirmLabel: "Continue",
        destructive: false,
      };
    }

    if (state.kind === "newAfterCurrent") {
      return {
        mode: "code" as const,
        title: "New collection code",
        description: `Choose a new 4–8 digit code for “${state.collection.name}”.`,
        confirmLabel: "Change code",
        destructive: false,
      };
    }

    if (state.kind === "currentForRemove") {
      return {
        mode: "code" as const,
        title: "Enter current code",
        description: `Enter the current code for “${state.collection.name}” before removing protection.`,
        confirmLabel: "Continue",
        destructive: false,
      };
    }

    return {
      mode: "confirm" as const,
      title: "Remove code?",
      description: `Remove access protection from “${state.collection.name}”?`,
      confirmLabel: "Remove code",
      destructive: true,
    };
  }

  const codeDialogCopy = getCodeDialogCopy(codeDialog);

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

          {pageError && (
            <div className="mb-5 rounded-[22px] border border-red-400/20 bg-red-500/10 px-4 py-3 text-sm text-red-100">
              {pageError}
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
                  className="relative w-full rounded-[26px] border border-white/[0.07] bg-white/[0.035] px-4 py-4 text-left transition hover:border-white/14 hover:bg-white/[0.055]"
                >
                  <div className="flex items-center gap-4">
                    <Stripe className="bg-white" />
                    <div className="min-w-0 flex-1 pr-2">
                      <div className="flex items-center gap-2">
                        <h3 className="truncate text-[15px] font-medium text-white">Favorites</h3>
                        <StatusIcon name="heart" label="Favorites" />
                        {viewLocks.favorites && <StatusIcon name="lock" label="Locked" />}
                      </div>
                      <p className="mt-1.5 text-[13px] text-neutral-400">Reflections you marked as important.</p>
                    </div>
                  </div>
                </button>

                <button
                  onClick={() => router.push("/journal?view=hidden")}
                  className="relative w-full rounded-[26px] border border-white/[0.07] bg-white/[0.035] px-4 py-4 text-left transition hover:border-white/14 hover:bg-white/[0.055]"
                >
                  <div className="flex items-center gap-4">
                    <Stripe className="bg-neutral-400" glow="shadow-[0_0_18px_rgba(163,163,163,0.22)]" />
                    <div className="min-w-0 flex-1 pr-2">
                      <div className="flex items-center gap-2">
                        <h3 className="truncate text-[15px] font-medium text-white">Hidden</h3>
                        <StatusIcon name="eyeOff" label="Hidden" />
                        {viewLocks.hidden && <StatusIcon name="lock" label="Locked" />}
                      </div>
                      <p className="mt-1.5 text-[13px] text-neutral-400">Reflections tucked away from the main journal.</p>
                    </div>
                  </div>
                </button>
              </>
            )}

            {loading ? (
              <div className="space-y-3">
                {Array.from({ length: 4 }).map((_, index) => (
                  <div
                    key={index}
                    className="h-[94px] animate-pulse rounded-[26px] border border-white/[0.07] bg-white/[0.035]"
                  />
                ))}
              </div>
            ) : items.length === 0 ? (
              <div className="rounded-[28px] border border-white/10 bg-white/[0.03] px-5 py-8 text-center">
                <div className="text-sm font-medium text-white">No collections yet</div>
                <p className="mx-auto mt-2 max-w-sm text-sm leading-relaxed text-neutral-400">
                  Create your first collection to group related reflections.
                </p>
                <button
                  onClick={() => {
                    setCreateError("");
                    setCreateOpen(true);
                  }}
                  className="mt-5 rounded-[18px] bg-white px-5 py-3 text-sm font-medium text-black transition hover:opacity-90"
                >
                  Create collection
                </button>
              </div>
            ) : (
              items.map((item) => {
                const style = colorStyles[item.color] ?? colorStyles.blue;
                const menuOpen = activeMenuId === item.id;

                return (
                  <div
                    key={item.id}
                    className="relative w-full rounded-[26px] border border-white/[0.07] bg-white/[0.035] px-4 py-4 transition hover:border-white/14 hover:bg-white/[0.055]"
                  >
                    <div className="flex items-center gap-4">
                      <button
                        onClick={() => openOrAdd(item)}
                        className="flex min-w-0 flex-1 items-center gap-4 text-left"
                      >
                        <Stripe className={style.stripe} glow={style.glow} />
                        <div className="min-w-0 flex-1 pr-1">
                          <div className="flex items-center gap-2">
                            <h3 className="truncate text-[15px] font-medium text-white">
                              {item.name}
                            </h3>
                            {item.locked && <StatusIcon name="lock" label="Locked" />}
                          </div>
                          <div className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-[12.5px] text-neutral-400">
                            <span>{getCountLabel(item.count)}</span>
                            <span className="text-neutral-600">•</span>
                            <span>Created {formatCollectionDate(item.createdAt)}</span>
                            <span className="text-neutral-600">•</span>
                            <span>{style.label}</span>
                          </div>
                        </div>
                      </button>

                      {!isAddMode && (
                        <button
                          onClick={(event) => {
                            event.stopPropagation();
                            setActiveMenuId(menuOpen ? null : item.id);
                          }}
                          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-neutral-300 transition hover:bg-white/[0.07] hover:text-white"
                          aria-label="Collection actions"
                        >
                          <ActionIcon name="dots" className="h-[1.42rem] w-[1.42rem]" />
                        </button>
                      )}
                    </div>

                    {menuOpen && !isAddMode && (
                      <div className="absolute right-3 top-[60px] z-30 w-[252px] overflow-hidden rounded-[22px] border border-white/10 bg-neutral-950/96 p-1.5 shadow-2xl shadow-black/50 backdrop-blur-xl">
                        <MenuButton label="Open collection" icon="open" onClick={() => openOrAdd(item)} />
                        <MenuButton label="Rename" icon="edit" onClick={() => openRenameDialog(item)} />
                        <MenuButton label="Change color" icon="palette" onClick={() => openColorDialog(item)} />
                        <MenuButton
                          label={item.locked ? "Change code" : "Set code"}
                          icon="lock"
                          onClick={() => openSetOrChangeCode(item)}
                        />
                        {item.locked && (
                          <MenuButton label="Remove code" icon="unlock" onClick={() => openRemoveCode(item)} />
                        )}
                        <MenuButton label="Remove collection" icon="trash" destructive onClick={() => openRemoveDialog(item)} />
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>
        </div>

        {createOpen && (
          <div
            className="fixed inset-0 z-[9999] flex items-end justify-center bg-black/45 px-4 pb-[calc(env(safe-area-inset-bottom)+18px)] backdrop-blur-[2px] sm:items-center sm:pb-0"
            onClick={() => {
              if (!saving) setCreateOpen(false);
            }}
          >
            <div
              onClick={(event) => event.stopPropagation()}
              className="w-full max-w-[430px] rounded-[30px] border border-white/10 bg-neutral-950/95 p-5 shadow-2xl shadow-black/60 backdrop-blur-xl"
            >
              <div className="text-[11px] uppercase tracking-[0.18em] text-neutral-500">
                New collection
              </div>
              <h2 className="mt-3 text-xl font-semibold text-white">
                Create a collection
              </h2>
              <p className="mt-2 text-sm leading-relaxed text-neutral-400">
                Name it, choose a color, and optionally protect it with a code.
              </p>

              <input
                value={name}
                onChange={(event) => {
                  setName(event.target.value.slice(0, 60));
                  if (createError) setCreateError("");
                }}
                placeholder="Collection name"
                className="mt-5 w-full rounded-[18px] border border-white/10 bg-white/[0.04] px-4 py-3 text-sm text-white outline-none transition placeholder:text-neutral-600 focus:border-white/25"
              />

              <input
                value={accessCode}
                onChange={(event) => {
                  setAccessCode(event.target.value.replace(/\D/g, "").slice(0, 8));
                  if (createError) setCreateError("");
                }}
                inputMode="numeric"
                placeholder="Optional 4–8 digit code"
                className="mt-3 w-full rounded-[18px] border border-white/10 bg-white/[0.04] px-4 py-3 text-sm text-white outline-none transition placeholder:text-neutral-600 focus:border-white/25"
              />

              {createError && (
                <div className="mt-3 rounded-[16px] border border-red-400/20 bg-red-500/10 px-3 py-2 text-sm text-red-200">
                  {createError}
                </div>
              )}

              <div className="mt-5 grid grid-cols-4 gap-2">
                {COLORS.map((nextColor) => {
                  const style = colorStyles[nextColor];
                  const active = color === nextColor;
                  return (
                    <button
                      key={nextColor}
                      onClick={() => setColor(nextColor)}
                      className={`rounded-[18px] border px-3 py-3 text-xs transition ${
                        active
                          ? "border-white/35 bg-white/[0.08] text-white"
                          : "border-white/10 bg-white/[0.03] text-neutral-400 hover:bg-white/[0.05]"
                      }`}
                    >
                      <span className={`mx-auto mb-2 block h-8 w-[3px] rounded-full ${style.stripe} ${style.glow}`} />
                      {style.label}
                    </button>
                  );
                })}
              </div>

              <div className="mt-5 flex gap-3">
                <button
                  onClick={() => setCreateOpen(false)}
                  disabled={saving}
                  className="flex-1 rounded-[18px] border border-white/10 bg-white/[0.03] px-5 py-3 text-sm font-medium text-white transition hover:bg-white/[0.05] disabled:opacity-40"
                >
                  Cancel
                </button>
                <button
                  onClick={createCollection}
                  disabled={!name.trim() || saving}
                  className="flex-1 rounded-[18px] bg-white px-5 py-3 text-sm font-medium text-black transition hover:opacity-90 disabled:opacity-40"
                >
                  {saving ? "Creating..." : "Create"}
                </button>
              </div>
            </div>
          </div>
        )}

        {colorDialog && (
          <div
            className="fixed inset-0 z-[10010] flex items-end justify-center bg-black/55 px-4 pb-[calc(env(safe-area-inset-bottom)+18px)] backdrop-blur-md sm:items-center sm:pb-6"
            onClick={() => {
              if (!actionLoading) setColorDialog(null);
            }}
          >
            <div
              onClick={(event) => event.stopPropagation()}
              className="w-full max-w-[390px] rounded-[30px] border border-white/10 bg-neutral-950/96 p-5 shadow-2xl shadow-black/60"
            >
              <div className="text-[11px] uppercase tracking-[0.18em] text-neutral-500">Collection color</div>
              <h2 className="mt-2 text-[22px] font-semibold tracking-[-0.04em] text-white">Change color</h2>
              <p className="mt-3 text-sm leading-relaxed text-neutral-400">
                Pick a color stripe for “{colorDialog.collection.name}”.
              </p>

              <div className="mt-5 grid grid-cols-4 gap-2">
                {COLORS.map((nextColor) => {
                  const style = colorStyles[nextColor];
                  const active = colorDialog.color === nextColor;
                  return (
                    <button
                      key={nextColor}
                      onClick={() => setColorDialog((current) => current ? { ...current, color: nextColor } : current)}
                      className={`rounded-[18px] border px-3 py-3 text-xs transition ${
                        active
                          ? "border-white/35 bg-white/[0.08] text-white"
                          : "border-white/10 bg-white/[0.03] text-neutral-400 hover:bg-white/[0.05]"
                      }`}
                    >
                      <span className={`mx-auto mb-2 block h-9 w-[3px] rounded-full ${style.stripe} ${style.glow}`} />
                      {style.label}
                    </button>
                  );
                })}
              </div>

              <div className="mt-5 grid grid-cols-2 gap-2">
                <button
                  onClick={() => setColorDialog(null)}
                  disabled={actionLoading}
                  className="rounded-[18px] border border-white/10 bg-white/[0.04] px-4 py-3 text-sm font-medium text-neutral-200 transition hover:bg-white/[0.07] disabled:opacity-40"
                >
                  Cancel
                </button>
                <button
                  onClick={confirmColorChange}
                  disabled={actionLoading}
                  className="rounded-[18px] bg-white px-4 py-3 text-sm font-semibold text-black transition hover:bg-neutral-200 disabled:opacity-40"
                >
                  {actionLoading ? "Saving..." : "Save"}
                </button>
              </div>
            </div>
          </div>
        )}

        <TextInputDialog
          open={Boolean(renameDialog)}
          title="Rename collection"
          description="Give this collection a clear name that will be easy to find later."
          initialValue={renameDialog?.name ?? ""}
          label="Collection name"
          placeholder="Collection name"
          confirmLabel="Save"
          loading={actionLoading}
          maxLength={60}
          onClose={() => {
            if (!actionLoading) setRenameDialog(null);
          }}
          onConfirm={confirmRenameCollection}
        />

        <AccessCodeDialog
          open={Boolean(codeDialog)}
          mode={codeDialogCopy.mode}
          title={codeDialogCopy.title}
          description={codeDialogCopy.description}
          confirmLabel={codeDialogCopy.confirmLabel}
          destructive={codeDialogCopy.destructive}
          loading={actionLoading}
          codeLabel="Access code"
          codePlaceholder="4–8 digits"
          onClose={() => {
            if (!actionLoading) setCodeDialog(null);
          }}
          onConfirm={confirmCodeDialog}
        />

        <AccessCodeDialog
          open={Boolean(removeDialog)}
          mode="confirm"
          title="Remove collection?"
          description={`Remove “${removeDialog?.name ?? "this collection"}”? Reflections will stay in your journal.`}
          confirmLabel="Remove"
          destructive
          loading={actionLoading}
          onClose={() => {
            if (!actionLoading) setRemoveDialog(null);
          }}
          onConfirm={confirmRemoveCollection}
        />
      </div>
    </AuthGate>
  );
}
