"use client";

import {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
} from "react";
import { useToast } from "@/components/ui/ToastContext";

type Message = {
  role: "user" | "assistant";
  content: string;
};

export type JournalItem = {
  id: string;
  title?: string;
  mood?: string | null;
  createdAt: number;
  messages: Message[];
  deleted?: boolean;
  updatedAt?: number | null;
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
};

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
    patch: Partial<JournalItem>
  ) => Promise<void>;
  deleteItem: (id: string) => Promise<void>;
  restoreItem: (id: string) => Promise<void>;
};

const PAGE_SIZE = 20;

const JournalContext =
  createContext<JournalContextValue | null>(null);

function normalizeItem(item: JournalItem | RawJournalItem): JournalItem {
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

  const { showUndo, showError } = useToast();

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
      setItems([]);
      setHasMore(false);
      setOffset(0);
      showError("Failed to load journal");
    }
  }, [fetchPage, showError]);

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
    refresh().finally(() => setLoading(false));
  }, [refresh]);

  const addItem = useCallback((item: JournalItem | RawJournalItem) => {
    const normalized = normalizeItem(item);

    setItems((prev) =>
      mergeUnique([normalized], prev)
    );
  }, []);

  const updateItem = useCallback(
    async (id: string, patch: Partial<JournalItem>) => {
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
          body: JSON.stringify(patch),
        });

        if (!res.ok) throw new Error();
      } catch {
        setItems(snapshot);
        showError("Update failed");
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
        setItems((prev) =>
          mergeUnique(prev, [item])
        );
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
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            restore: true,
          }),
        });

        if (!res.ok) throw new Error();

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
        deleteItem,
        restoreItem,
      }}
    >
      {children}
    </JournalContext.Provider>
  );
}

export function useJournal() {
  const context = useContext(JournalContext);

  if (!context) {
    throw new Error(
      "useJournal must be used within JournalProvider"
    );
  }

  return context;
}