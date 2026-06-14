"use client";

import { AnimatePresence, motion } from "framer-motion";
import { useEffect, useRef, useState } from "react";

type AccessCodeDialogMode = "code" | "confirm";

type AccessCodeDialogProps = {
  open: boolean;
  mode?: AccessCodeDialogMode;
  title: string;
  description: string;
  confirmLabel: string;
  cancelLabel?: string;
  destructive?: boolean;
  loading?: boolean;
  codeLabel?: string;
  codePlaceholder?: string;
  onClose: () => void;
  onConfirm: (code?: string) => Promise<void> | void;
};

export default function AccessCodeDialog({
  open,
  mode = "code",
  title,
  description,
  confirmLabel,
  cancelLabel = "Cancel",
  destructive = false,
  loading = false,
  codeLabel = "Access code",
  codePlaceholder = "Code",
  onClose,
  onConfirm,
}: AccessCodeDialogProps) {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [code, setCode] = useState("");
  const [error, setError] = useState("");
  const [shakeKey, setShakeKey] = useState(0);

  useEffect(() => {
    if (!open) return;

    setCode("");
    setError("");
    setShakeKey(0);

    const timer = window.setTimeout(() => inputRef.current?.focus(), 110);
    return () => window.clearTimeout(timer);
  }, [open]);

  function normalizeCode(value: string) {
    return value.replace(/\D/g, "").slice(0, 8);
  }

  async function submit() {
    if (loading) return;

    const trimmedCode = code.trim();

    if (mode === "code" && !/^\d{4,8}$/.test(trimmedCode)) {
      setError("Use a 4–8 digit code.");
      setShakeKey((value) => value + 1);
      return;
    }

    try {
      setError("");
      await onConfirm(mode === "code" ? trimmedCode : undefined);
    } catch (error) {
      setError(
        error instanceof Error
          ? error.message
          : "Something went wrong. Please try again.",
      );
      setShakeKey((value) => value + 1);
    }
  }

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 z-[10020] flex items-end justify-center bg-black/[0.62] px-4 pb-[calc(env(safe-area-inset-bottom)+18px)] pt-6 backdrop-blur-md sm:items-center sm:pb-6"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.12, ease: [0.22, 1, 0.36, 1] }}
          onClick={() => {
            if (!loading) onClose();
          }}
        >
          <motion.div
            key={shakeKey}
            initial={{ opacity: 0, y: 14, scale: 0.985 }}
            animate={
              error
                ? {
                    opacity: 1,
                    y: [0, -1, 1, -1, 1, 0],
                    scale: 1,
                  }
                : { opacity: 1, y: 0, scale: 1 }
            }
            exit={{ opacity: 0, y: 10, scale: 0.985 }}
            transition={
              error
                ? { duration: 0.18, ease: [0.22, 1, 0.36, 1] }
                : { type: "spring", stiffness: 760, damping: 46, mass: 0.72 }
            }
            onClick={(event) => event.stopPropagation()}
            className="w-full max-w-[390px] overflow-hidden rounded-[30px] border border-white/10 bg-neutral-950/96 p-1.5 shadow-2xl shadow-black/55 backdrop-blur-2xl"
          >
            <div className="rounded-[25px] bg-gradient-to-b from-white/[0.075] to-white/[0.025] px-5 py-5">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <div className="text-[11px] uppercase tracking-[0.18em] text-neutral-500">
                    MindLog Access
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

              {mode === "code" && (
                <div className="mt-5">
                  <label className="text-[11px] uppercase tracking-[0.16em] text-neutral-500">
                    {codeLabel}
                  </label>
                  <input
                    ref={inputRef}
                    value={code}
                    onChange={(event) => {
                      setCode(normalizeCode(event.target.value));
                      if (error) setError("");
                    }}
                    onKeyDown={(event) => {
                      if (event.key === "Enter") submit();
                    }}
                    inputMode="numeric"
                    autoComplete="off"
                    placeholder={codePlaceholder}
                    className={`mt-2 w-full rounded-[20px] border px-4 py-3 text-center text-lg tracking-[0.22em] text-white outline-none transition placeholder:tracking-normal placeholder:text-neutral-600 ${
                      error
                        ? "border-red-400/70 bg-red-500/10 shadow-[0_0_0_3px_rgba(248,113,113,0.08)]"
                        : "border-white/10 bg-white/[0.04] focus:border-white/25"
                    }`}
                  />
                </div>
              )}

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
                  {cancelLabel}
                </button>
                <button
                  onClick={submit}
                  disabled={loading || (mode === "code" && code.length < 4)}
                  className={`rounded-[18px] px-4 py-3 text-sm font-semibold transition disabled:opacity-40 ${
                    destructive
                      ? "bg-red-300 text-black hover:bg-red-200"
                      : "bg-white text-black hover:bg-neutral-200"
                  }`}
                >
                  {loading ? "Saving..." : confirmLabel}
                </button>
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
