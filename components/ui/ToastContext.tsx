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
  durationMs: number;
  onUndo?: () => void;
};

type ToastContextValue = {
  showUndo: (message: string, onUndo: () => void) => void;
  showSuccess: (message: string) => void;
  showError: (message: string) => void;
};

const ToastContext =
  createContext<ToastContextValue | null>(null);

const DEFAULT_TOAST_DURATION_MS = 3600;
const UNDO_TOAST_DURATION_MS = 4200;

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
      }, toast.durationMs);

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
        durationMs: UNDO_TOAST_DURATION_MS,
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
        durationMs: DEFAULT_TOAST_DURATION_MS,
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
        durationMs: DEFAULT_TOAST_DURATION_MS,
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

      <div className="fixed bottom-6 left-1/2 z-50 flex w-full max-w-md -translate-x-1/2 flex-col gap-3 px-4">
        <AnimatePresence>
          {toasts.map((toast) => (
            <motion.div
              key={toast.id}
              initial={{
                opacity: 0,
                y: 34,
                scale: 0.96,
              }}
              animate={{
                opacity: 1,
                y: 0,
                scale: 1,
              }}
              exit={{
                opacity: 0,
                y: 16,
                scale: 0.98,
              }}
              transition={{
                type: "spring",
                stiffness: 520,
                damping: 34,
              }}
              className="relative overflow-hidden rounded-[22px] border border-white/10 bg-neutral-950/92 px-4 py-3 shadow-2xl shadow-black/45 backdrop-blur-xl"
            >
              <div className="flex items-center justify-between gap-4">
                <span className="text-[13.5px] font-medium text-neutral-100">
                  {toast.message}
                </span>

                {toast.type === "undo" &&
                  toast.onUndo && (
                    <button
                      onClick={() => {
                        toast.onUndo?.();
                        removeToast(toast.id);
                      }}
                      className="rounded-full bg-white/[0.06] px-3 py-1.5 text-[13px] font-semibold text-white transition hover:bg-white/[0.1]"
                    >
                      Undo
                    </button>
                  )}
              </div>

              {toast.type === "undo" && (
                <div className="absolute inset-x-3 bottom-1.5 h-[2px] overflow-hidden rounded-full bg-white/[0.08]">
                  <motion.div
                    className="h-full rounded-full bg-white/55"
                    initial={{ width: "100%" }}
                    animate={{ width: "0%" }}
                    transition={{
                      duration: toast.durationMs / 1000,
                      ease: "linear",
                    }}
                  />
                </div>
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
