"use client";

type ConfirmModalProps = {
  open: boolean;
  title: string;
  description?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  secondaryLabel?: string;
  danger?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
  onSecondary?: () => void;
};

export default function ConfirmModal({
  open,
  title,
  description,
  confirmLabel = "Confirm",
  cancelLabel = "Cancel",
  secondaryLabel,
  danger = false,
  onConfirm,
  onCancel,
  onSecondary,
}: ConfirmModalProps) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[120] flex items-end justify-center bg-black/70 p-3 backdrop-blur-md sm:items-center sm:p-4">
      <div className="w-full max-w-md rounded-[28px] border border-white/10 bg-[#111111]/96 p-5 shadow-[0_24px_80px_rgba(0,0,0,0.45)]">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="text-[17px] font-medium text-white">
              {title}
            </h2>

            {description && (
              <p className="mt-2 text-sm leading-relaxed text-neutral-400">
                {description}
              </p>
            )}
          </div>

          <button
            onClick={onCancel}
            aria-label="Close"
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-white/10 bg-white/[0.04] text-neutral-400 transition hover:bg-white/[0.07] hover:text-white"
          >
            <svg
              viewBox="0 0 24 24"
              className="h-4 w-4"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
            >
              <path d="M6 6l12 12" />
              <path d="M18 6 6 18" />
            </svg>
          </button>
        </div>

        <div className="mt-5 flex flex-col gap-2">
          <button
            onClick={onConfirm}
            className={`w-full rounded-[18px] px-4 py-3 text-sm font-medium transition ${
              danger
                ? "bg-red-600 text-white hover:bg-red-500"
                : "bg-white text-black hover:opacity-90"
            }`}
          >
            {confirmLabel}
          </button>

          {secondaryLabel && onSecondary && (
            <button
              onClick={onSecondary}
              className="w-full rounded-[18px] border border-white/10 bg-white/[0.05] px-4 py-3 text-sm font-medium text-white transition hover:bg-white/[0.08]"
            >
              {secondaryLabel}
            </button>
          )}

          <button
            onClick={onCancel}
            className="w-full rounded-[18px] px-4 py-3 text-sm text-neutral-400 transition hover:text-white"
          >
            {cancelLabel}
          </button>
        </div>
      </div>
    </div>
  );
}