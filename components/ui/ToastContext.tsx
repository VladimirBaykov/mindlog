"use client";

import {
  createContext,
  useContext,
  useState,
  useCallback,
  useRef,
} from "react";
import { AnimatePresence, motion } from "framer-motion";

type ToastType = "undo" | "success" | "error";

export type ToastItem = {
  id: string;
  type: ToastType;
  message: string;
  onUndo?: () => void;
};

type ToastContextValue = {
  showUndo: (message: string, onUndo: () => void) => void;
  showSuccess: (message: string) => void;
  showError: (message: string) => void;
};

const ToastContext =
  createContext<ToastContextValue | null>(null);

export function ToastProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const [toasts, setToasts] = useState<
    ToastItem[]
  >([]);

  const timers = useRef<
    Map<string, NodeJS.Timeout>
  >(new Map());

  const removeToast = useCallback(
    (id: string) => {
      setToasts((prev) =>
        prev.filter((t) => t.id !== id)
      );

      const timer = timers.current.get(id);
      if (timer) {
        clearTimeout(timer);
        timers.current.delete(id);
      }
    },
    []
  );

  const addToast = useCallback(
    (toast: ToastItem) => {
      setToasts((prev) => [...prev, toast]);

      const timer = setTimeout(() => {
        removeToast(toast.id);
      }, 5000);

      timers.current.set(toast.id, timer);
    },
    [removeToast]
  );

  const showUndo = useCallback(
    (message: string, onUndo: () => void) => {
      const id = crypto.randomUUID();

      addToast({
        id,
        type: "undo",
        message,
        onUndo,
      });
    },
    [addToast]
  );

  const showSuccess = useCallback(
    (message: string) => {
      const id = crypto.randomUUID();

      addToast({
        id,
        type: "success",
        message,
      });
    },
    [addToast]
  );

  const showError = useCallback(
    (message: string) => {
      const id = crypto.randomUUID();

      addToast({
        id,
        type: "error",
        message,
      });
    },
    [addToast]
  );

  return (
    <ToastContext.Provider
      value={{
        showUndo,
        showSuccess,
        showError,
      }}
    >
      {children}

      <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 flex flex-col gap-3 w-full max-w-md px-4">
        <AnimatePresence>
          {toasts.map((toast) => (
            <motion.div
              key={toast.id}
              initial={{
                opacity: 0,
                y: 40,
                scale: 0.95,
              }}
              animate={{
                opacity: 1,
                y: 0,
                scale: 1,
              }}
              exit={{
                opacity: 0,
                y: 20,
                scale: 0.97,
              }}
              transition={{
                type: "spring",
                stiffness: 400,
                damping: 30,
              }}
              className="rounded-xl bg-neutral-900/90 backdrop-blur-md border border-neutral-800 px-5 py-3 shadow-2xl flex items-center justify-between gap-4"
            >
              <span className="text-sm text-neutral-200">
                {toast.message}
              </span>

              {toast.type === "undo" &&
                toast.onUndo && (
                  <button
                    onClick={() => {
                      toast.onUndo?.();
                      removeToast(toast.id);
                    }}
                    className="text-sm font-medium text-blue-400 hover:text-blue-300 transition"
                  >
                    Undo
                  </button>
                )}
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const context =
    useContext(ToastContext);
  if (!context) {
    throw new Error(
      "useToast must be used within ToastProvider"
    );
  }
  return context;
}