"use client";

import { useState } from "react";
import { HeaderMenuItem } from "./HeaderContext";

export default function HeaderMenu({ items }: { items: HeaderMenuItem[] }) {
  const [open, setOpen] = useState(false);

  return (
    <div className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        className="text-neutral-300 hover:text-white px-2"
      >
        ⋯
      </button>

      {open && (
        <div className="absolute right-0 mt-2 w-48 rounded-xl border border-neutral-800 bg-neutral-900 shadow-xl overflow-hidden">
          {items.map((item, i) => (
            <button
              key={i}
              onClick={() => {
                item.onClick();
                setOpen(false);
              }}
              className={`w-full px-4 py-2 text-left text-sm hover:bg-neutral-800 ${
                item.danger ? "text-red-400" : "text-neutral-200"
              }`}
            >
              {item.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
