type UndoToastProps = {
  message: string;
  onUndo: () => void;
};

export function UndoToast({ message, onUndo }: UndoToastProps) {
  return (
    <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50">
      <div className="flex items-center gap-4 rounded-full bg-neutral-900 px-5 py-3 shadow-lg ring-1 ring-neutral-800">
        <span className="text-sm text-neutral-300">{message}</span>
        <button
          onClick={onUndo}
          className="text-sm font-medium text-white hover:underline"
        >
          Undo
        </button>
      </div>
    </div>
  );
}
