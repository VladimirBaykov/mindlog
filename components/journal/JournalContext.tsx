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
};

type JournalContextValue = {
  items: JournalItem[];
  loading: boolean;
  refresh: () => Promise<void>;
  addItem: (item: JournalItem) => void;
  updateItem: (
    id: string,
    patch: Partial<JournalItem>
  ) => Promise<void>;
  deleteItem: (id: string) => Promise<void>;
  restoreItem: (id: string) => Promise<void>;
};

const JournalContext =
  createContext<JournalContextValue | null>(
    null
  );

export function JournalProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const [items, setItems] = useState<
    JournalItem[]
  >([]);
  const [loading, setLoading] =
    useState(true);
  const [pendingDeletes, setPendingDeletes] =
    useState<Set<string>>(new Set());

  const { showUndo, showError } =
    useToast();

  async function loadJournal() {
    const res = await fetch("/api/journal", {
      cache: "no-store",
    });

    if (!res.ok) {
      setItems([]);
      return;
    }

    const data = await res.json();

    const unique = Array.from(
      new Map(
        data.map((item: JournalItem) => [
          item.id,
          item,
        ])
      ).values()
    );

    setItems(
      unique
        .filter((i) => !i.deleted)
        .sort(
          (a, b) =>
            b.createdAt - a.createdAt
        )
    );
  }

  useEffect(() => {
    loadJournal().finally(() =>
      setLoading(false)
    );
  }, []);

  const refresh = useCallback(
    async () => {
      await loadJournal();
    },
    []
  );

  const addItem = useCallback(
    (item: JournalItem) => {
      setItems((prev) => {
        if (
          prev.find(
            (i) => i.id === item.id
          )
        )
          return prev;

        return [item, ...prev].sort(
          (a, b) =>
            b.createdAt - a.createdAt
        );
      });
    },
    []
  );

  const updateItem = useCallback(
    async (
      id: string,
      patch: Partial<JournalItem>
    ) => {
      const snapshot = [...items];

      setItems((prev) =>
        prev.map((item) =>
          item.id === id
            ? { ...item, ...patch }
            : item
        )
      );

      try {
        const res = await fetch(
          `/api/journal/${id}`,
          {
            method: "PATCH",
            headers: {
              "Content-Type":
                "application/json",
            },
            body: JSON.stringify(patch),
          }
        );

        if (!res.ok)
          throw new Error();
      } catch {
        setItems(snapshot);
        showError("Update failed");
      }
    },
    [items, showError]
  );

  const deleteItem = useCallback(
    async (id: string) => {
      if (pendingDeletes.has(id))
        return;

      const item = items.find(
        (i) => i.id === id
      );
      if (!item) return;

      setPendingDeletes((prev) =>
        new Set(prev).add(id)
      );

      setItems((prev) =>
        prev.filter(
          (i) => i.id !== id
        )
      );

      showUndo(
        "Entry deleted",
        () => restoreItem(id)
      );

      try {
        const res = await fetch(
          `/api/journal/${id}`,
          { method: "DELETE" }
        );

        if (!res.ok)
          throw new Error();
      } catch {
        showError(
          "Delete failed"
        );
        setItems((prev) =>
          [item, ...prev].sort(
            (a, b) =>
              b.createdAt -
              a.createdAt
          )
        );
      } finally {
        setPendingDeletes(
          (prev) => {
            const next =
              new Set(prev);
            next.delete(id);
            return next;
          }
        );
      }
    },
    [
      items,
      pendingDeletes,
      showUndo,
      showError,
    ]
  );

  const restoreItem = useCallback(
    async (id: string) => {
      try {
        const res = await fetch(
          `/api/journal/${id}`,
          {
            method: "PATCH",
            headers: {
              "Content-Type":
                "application/json",
            },
            body: JSON.stringify({
              restore: true,
            }),
          }
        );

        if (!res.ok)
          throw new Error();

        await refresh();
      } catch {
        showError(
          "Restore failed"
        );
      }
    },
    [refresh, showError]
  );

  return (
    <JournalContext.Provider
      value={{
        items,
        loading,
        refresh,
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
  const context =
    useContext(JournalContext);
  if (!context) {
    throw new Error(
      "useJournal must be used within JournalProvider"
    );
  }
  return context;
}