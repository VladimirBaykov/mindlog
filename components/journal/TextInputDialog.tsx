"use client";

import { AnimatePresence, motion } from "framer-motion";
import { useEffect, useRef, useState } from "react";

type TextInputDialogProps = {
  open: boolean;
  title: string;
  description: string;
  initialValue?: string;
  label?: string;
  placeholder?: string;
  confirmLabel: string;
  cancelLabel?: string;
  loading?: boolean;
  maxLength?: number;
  onClose: () => void;
  onConfirm: (value: string) => Promise<void> | void;
};

export default function TextInputDialog({
  open,
  title,
  description,
  initialValue = "",
  label = "Name",
  placeholder = "Type here",
  confirmLabel,
  cancelLabel = "Cancel",
  loading = false,
  maxLength = 80,
  onClose,
  onConfirm,
}: TextInputDialogProps) {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [value, setValue] = useState(initialValue);
  const [error, setError] = useState("");
  const [shakeKey, setShakeKey] = useState(0);

  useEffect(() => {
    if (!open) return;

    setValue(initialValue);
    setError("");
    setShakeKey(0);

    const timer = window.setTimeout(() => {
      inputRef.current?.focus();
      inputRef.current?.select();
    }, 110);

    return () => window.clearTimeout(timer);
  }, [initialValue, open]);

  async function submit() {
    if (loading) return;

    const nextValue = value.trim();

    if (!nextValue) {
      setError("Enter a title.");
      setShakeKey((key) => key + 1);
      return;
    }

    if (nextValue.length > maxLength) {
      setError(`Keep it under ${maxLength} characters.`);
      setShakeKey((key) => key + 1);
      return;
    }

    try {
      setError("");
      await onConfirm(nextValue);
    } catch (error) {
      setError(
        error instanceof Error
          ? error.message
          : "Something went wrong. Please try again.",
      );
      setShakeKey((key) => key + 1);
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
                    MindLog Journal
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

              <div className="mt-5">
                <label className="text-[11px] uppercase tracking-[0.16em] text-neutral-500">
                  {label}
                </label>
                <input
                  ref={inputRef}
                  value={value}
                  onChange={(event) => {
                    setValue(event.target.value.slice(0, maxLength));
                    if (error) setError("");
                  }}
                  onKeyDown={(event) => {
                    if (event.key === "Enter") submit();
                  }}
                  autoComplete="off"
                  placeholder={placeholder}
                  className={`mt-2 w-full rounded-[20px] border px-4 py-3 text-[15px] text-white outline-none transition placeholder:text-neutral-600 ${
                    error
                      ? "border-red-400/70 bg-red-500/10 shadow-[0_0_0_3px_rgba(248,113,113,0.08)]"
                      : "border-white/10 bg-white/[0.04] focus:border-white/25"
                  }`}
                />
              </div>

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
                  disabled={loading || !value.trim()}
                  className="rounded-[18px] bg-white px-4 py-3 text-sm font-semibold text-black transition hover:bg-neutral-200 disabled:opacity-40"
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
