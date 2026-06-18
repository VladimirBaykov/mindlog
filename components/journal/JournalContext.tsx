"use client";

import {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
} from "react";
import { useToast } from "@/components/ui/ToastContext";
import { supabase } from "@/lib/supabase-browser";

type Message = {
  role: "user" | "assistant";
  content: string;
};

export type JournalMetadata = {
  summary?: string;
  keyTakeaway?: string;
  themes?: string[];
  chatType?: string;
  accessHash?: string;
};

export type JournalItem = {
  id: string;
  title?: string;
  mood?: string | null;
  createdAt: number;
  messages: Message[];
  deleted?: boolean;
  updatedAt?: number | null;
  metadata?: JournalMetadata | null;
  isFavorite?: boolean;
  hiddenAt?: number | null;
  locked?: boolean;
};

type RawJournalItem = {
  id: string;
  title?: string;
  mood?: string | null;
  created_at?: string;
  updated_at?: string | null;
  deleted_at?: string | null;
  content?: Message[];
  messages?: Message[];
  metadata?: JournalMetadata | null;
  isFavorite?: boolean;
  is_favorite?: boolean | null;
  hiddenAt?: number | null;
  hidden_at?: string | null;
  locked?: boolean;
  lock_hash?: string | null;
};

type JournalUpdatePatch = Partial<
  Pick<
    JournalItem,
    "title" | "mood" | "metadata" | "isFavorite" | "hiddenAt" | "locked"
  >
>;

type JournalContextValue = {
  items: JournalItem[];
  loading: boolean;
  loadingMore: boolean;
  hasMore: boolean;
  refresh: () => Promise<void>;
  loadMore: () => Promise<void>;
  addItem: (item: JournalItem | RawJournalItem) => void;
  updateItem: (
    id: string,
    patch: JournalUpdatePatch
  ) => Promise<JournalItem | null>;
  batchUpdateItems: (
    ids: string[],
    patch: JournalUpdatePatch
  ) => Promise<JournalItem[]>;
  deleteItem: (id: string) => Promise<void>;
  restoreItem: (id: string) => Promise<void>;
};

const PAGE_SIZE = 20;

const JournalContext =
  createContext<JournalContextValue | null>(null);

function hasMetadataAccessHash(metadata: JournalMetadata | null | undefined) {
  return Boolean(
    metadata &&
      typeof metadata.accessHash === "string" &&
      metadata.accessHash.length > 0
  );
}

function normalizeItem(item: JournalItem | RawJournalItem): JournalItem {
  const metadata = item.metadata ?? null;

  return {
    id: item.id,
    title: item.title,
    mood: item.mood ?? null,
    createdAt:
      "createdAt" in item && typeof item.createdAt === "number"
        ? item.createdAt
        : item.created_at
        ? new Date(item.created_at).getTime()
        : Date.now(),
    updatedAt:
      "updatedAt" in item && typeof item.updatedAt === "number"
        ? item.updatedAt
        : item.updated_at
        ? new Date(item.updated_at).getTime()
        : null,
    messages:
      "messages" in item && Array.isArray(item.messages)
        ? item.messages
        : Array.isArray(item.content)
        ? item.content
        : [],
    metadata,
    isFavorite:
      "isFavorite" in item && typeof item.isFavorite === "boolean"
        ? item.isFavorite
        : Boolean(item.is_favorite),
    hiddenAt:
      "hiddenAt" in item && typeof item.hiddenAt === "number"
        ? item.hiddenAt
        : item.hidden_at
        ? new Date(item.hidden_at).getTime()
        : null,
    locked:
      "locked" in item && typeof item.locked === "boolean"
        ? item.locked
        : Boolean(item.lock_hash || hasMetadataAccessHash(metadata)),
    deleted:
      "deleted" in item
        ? item.deleted
        : Boolean(item.deleted_at),
  };
}

function mergeUnique(
  current: JournalItem[],
  incoming: JournalItem[]
): JournalItem[] {
  const map = new Map<string, JournalItem>();

  for (const item of current) {
    map.set(item.id, item);
  }

  for (const item of incoming) {
    map.set(item.id, item);
  }

  return Array.from(map.values()).sort(
    (a, b) => b.createdAt - a.createdAt
  );
}

function toApiPatch(patch: JournalUpdatePatch) {
  const payload: Record<string, unknown> = {};

  if ("title" in patch) {
    payload.title = patch.title;
  }

  if ("mood" in patch) {
    payload.mood = patch.mood;
  }

  if ("metadata" in patch) {
    payload.metadata = patch.metadata ?? {};
  }

  if ("isFavorite" in patch) {
    payload.is_favorite = Boolean(patch.isFavorite);
  }

  if ("hiddenAt" in patch) {
    payload.hidden_at = patch.hiddenAt
      ? new Date(patch.hiddenAt).toISOString()
      : null;
  }

  return payload;
}

export function JournalProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const [items, setItems] = useState<JournalItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(false);
  const [offset, setOffset] = useState(0);
  const [pendingDeletes, setPendingDeletes] =
    useState<Set<string>>(new Set());
  const [currentUserId, setCurrentUserId] =
    useState<string | null>(null);

  const { showUndo, showError } = useToast();

  const resetJournalState = useCallback(() => {
    setItems([]);
    setHasMore(false);
    setOffset(0);
    setPendingDeletes(new Set());
  }, []);

  const fetchPage = useCallback(
    async (nextOffset: number) => {
      const res = await fetch(
        `/api/journal?limit=${PAGE_SIZE}&offset=${nextOffset}`,
        { cache: "no-store" }
      );

      if (!res.ok) {
        throw new Error("Failed to load journal");
      }

      const data = await res.json();

      const normalized = (data.items ?? []).map(
        (item: RawJournalItem) => normalizeItem(item)
      );

      return {
        items: normalized,
        hasMore: Boolean(data.hasMore),
        nextOffset: nextOffset + normalized.length,
      };
    },
    []
  );

  const refresh = useCallback(async () => {
    try {
      const firstPage = await fetchPage(0);
      setItems(firstPage.items);
      setHasMore(firstPage.hasMore);
      setOffset(firstPage.nextOffset);
    } catch {
      resetJournalState();
      showError("Failed to load journal");
    }
  }, [fetchPage, resetJournalState, showError]);

  const loadMore = useCallback(async () => {
    if (loadingMore || !hasMore) return;

    setLoadingMore(true);

    try {
      const nextPage = await fetchPage(offset);
      setItems((prev) => mergeUnique(prev, nextPage.items));
      setHasMore(nextPage.hasMore);
      setOffset(nextPage.nextOffset);
    } catch {
      showError("Failed to load more");
    } finally {
      setLoadingMore(false);
    }
  }, [fetchPage, hasMore, loadingMore, offset, showError]);

  useEffect(() => {
    let mounted = true;

    async function bootstrap() {
      try {
        const {
          data: { user },
        } = await supabase.auth.getUser();

        if (!mounted) return;

        const nextUserId = user?.id ?? null;
        setCurrentUserId(nextUserId);

        if (nextUserId) {
          await refresh();
        } else {
          resetJournalState();
        }
      } finally {
        if (mounted) setLoading(false);
      }
    }

    bootstrap();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(
      async (_event, session) => {
        const nextUserId = session?.user?.id ?? null;

        setLoading(true);

        if (!nextUserId) {
          setCurrentUserId(null);
          resetJournalState();
          setLoading(false);
          return;
        }

        if (nextUserId !== currentUserId) {
          setCurrentUserId(nextUserId);
          resetJournalState();
          await refresh();
        }

        setLoading(false);
      }
    );

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, [currentUserId, refresh, resetJournalState]);

  const addItem = useCallback((item: JournalItem | RawJournalItem) => {
    const normalized = normalizeItem(item);

    setItems((prev) => mergeUnique([normalized], prev));
  }, []);

  const updateItem = useCallback(
    async (id: string, patch: JournalUpdatePatch) => {
      const snapshot = [...items];

      setItems((prev) =>
        prev.map((item) =>
          item.id === id
            ? {
                ...item,
                ...patch,
                updatedAt: Date.now(),
              }
            : item
        )
      );

      try {
        const res = await fetch(`/api/journal/${id}`, {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
          },
          cache: "no-store",
          body: JSON.stringify(toApiPatch(patch)),
        });

        const data = await res.json().catch(() => ({}));

        if (!res.ok) {
          throw new Error(data.error || "Update failed");
        }

        if (!data.item) {
          throw new Error("Update did not return the saved journal item");
        }

        const savedItem = normalizeItem(data.item as RawJournalItem);

        setItems((prev) =>
          prev.map((item) => (item.id === id ? savedItem : item))
        );

        return savedItem;
      } catch (error) {
        setItems(snapshot);
        showError(
          error instanceof Error ? error.message : "Update failed"
        );
        throw error;
      }
    },
    [items, showError]
  );

  const batchUpdateItems = useCallback(
    async (ids: string[], patch: JournalUpdatePatch) => {
      const uniqueIds = Array.from(new Set(ids.filter(Boolean)));

      if (uniqueIds.length === 0) return [];

      const idSet = new Set(uniqueIds);
      const snapshot = [...items];
      const now = Date.now();

      setItems((prev) =>
        prev.map((item) =>
          idSet.has(item.id)
            ? {
                ...item,
                ...patch,
                updatedAt: now,
              }
            : item
        )
      );

      try {
        const res = await fetch("/api/journal/batch", {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
          },
          cache: "no-store",
          body: JSON.stringify({
            ids: uniqueIds,
            patch: toApiPatch(patch),
          }),
        });

        const data = await res.json().catch(() => ({}));

        if (!res.ok) {
          throw new Error(data.error || "Batch update failed");
        }

        const savedItems = (data.items ?? []).map((item: RawJournalItem) =>
          normalizeItem(item)
        );
        const savedById = new Map(
          savedItems.map((item: JournalItem) => [item.id, item])
        );

        setItems((prev) =>
          prev.map((item) => savedById.get(item.id) ?? item)
        );

        return savedItems;
      } catch (error) {
        setItems(snapshot);
        showError(
          error instanceof Error ? error.message : "Batch update failed"
        );
        throw error;
      }
    },
    [items, showError]
  );

  const deleteItem = useCallback(
    async (id: string) => {
      if (pendingDeletes.has(id)) return;

      const item = items.find((i) => i.id === id);
      if (!item) return;

      setPendingDeletes((prev) => new Set(prev).add(id));

      setItems((prev) => prev.filter((i) => i.id !== id));

      showUndo("Entry deleted", () => restoreItem(id));

      try {
        const res = await fetch(`/api/journal/${id}`, {
          method: "DELETE",
        });

        if (!res.ok) throw new Error();
      } catch {
        showError("Delete failed");
        setItems((prev) => mergeUnique(prev, [item]));
      } finally {
        setPendingDeletes((prev) => {
          const next = new Set(prev);
          next.delete(id);
          return next;
        });
      }
    },
    [items, pendingDeletes, showUndo, showError]
  );

  const restoreItem = useCallback(
    async (id: string) => {
      try {
        const res = await fetch(`/api/journal/${id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          cache: "no-store",
          body: JSON.stringify({ restore: true }),
        });

        const data = await res.json().catch(() => ({}));

        if (!res.ok) {
          throw new Error(data.error || "Restore failed");
        }

        await refresh();
      } catch {
        showError("Restore failed");
      }
    },
    [refresh, showError]
  );

  return (
    <JournalContext.Provider
      value={{
        items,
        loading,
        loadingMore,
        hasMore,
        refresh,
        loadMore,
        addItem,
        updateItem,
        batchUpdateItems,
        deleteItem,
        restoreItem,
      }}
    >
      {children}
    </JournalContext.Provider>
  );
}

export function useJournal() {
  const ctx = useContext(JournalContext);
  if (!ctx) {
    throw new Error("useJournal must be used inside JournalProvider");
  }
  return ctx;
}
