"use client";

import { useState, useRef, useEffect } from "react";
import { motion, useScroll, useTransform } from "framer-motion";
import { useHeader } from "./HeaderContext";

export function Header() {
  const { header } = useHeader();
  const {
    title,
    subtitle,
    leftSlot,
    rightSlot,
    menuItems,
  } = header;

  const [open, setOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement | null>(null);

  const { scrollY } = useScroll();

  // Height shrink
  const height = useTransform(scrollY, [0, 80], [72, 60]);

  // Softer blur curve
  const backdrop = useTransform(
    scrollY,
    [0, 80],
    ["blur(6px)", "blur(14px)"]
  );

  // More premium opacity curve
  const bgColor = useTransform(
    scrollY,
    [0, 80],
    ["rgba(10,10,10,0.55)", "rgba(10,10,10,0.92)"]
  );

  // Title scale
  const scale = useTransform(scrollY, [0, 80], [1, 0.96]);

  // Title opacity shift
  const titleOpacity = useTransform(
    scrollY,
    [0, 40],
    [0.85, 1]
  );

  // close on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (
        menuRef.current &&
        !menuRef.current.contains(e.target as Node)
      ) {
        setOpen(false);
      }
    }

    document.addEventListener("mousedown", handleClick);
    return () =>
      document.removeEventListener("mousedown", handleClick);
  }, []);

  if (
    !title &&
    !subtitle &&
    !leftSlot &&
    !rightSlot &&
    !menuItems
  ) {
    return null;
  }

  return (
    <motion.header
      style={{
        height,
        backdropFilter: backdrop,
        backgroundColor: bgColor,
      }}
      className="fixed top-0 left-0 right-0 z-50"
    >
      {/* subtle gradient depth */}
      <div className="absolute inset-0 pointer-events-none bg-gradient-to-b from-white/[0.04] to-transparent" />

      {/* hairline separator */}
      <div className="absolute bottom-0 left-0 right-0 h-px bg-white/[0.06]" />

      <div className="relative mx-auto flex h-full max-w-xl items-center justify-between px-4">
        {/* LEFT */}
        <div className="flex items-center gap-2">
          {leftSlot}
        </div>

        {/* CENTER */}
        <motion.div
          style={{ scale, opacity: titleOpacity }}
          className="flex flex-col items-center"
        >
          {title && (
            <span className="text-sm font-medium text-white">
              {title}
            </span>
          )}
          {subtitle && (
            <span className="text-xs text-neutral-400 capitalize">
              {subtitle}
            </span>
          )}
        </motion.div>

        {/* RIGHT */}
        <div className="relative flex items-center gap-2">
          {rightSlot}

          {menuItems && menuItems.length > 0 && (
            <>
              <button
                onClick={() => setOpen((v) => !v)}
                className="flex h-8 w-8 items-center justify-center rounded-full text-neutral-300 transition-all hover:bg-neutral-800 hover:text-white active:scale-95"
              >
                ⋯
              </button>

              {open && (
                <motion.div
                  ref={menuRef}
                  initial={{ opacity: 0, scale: 0.96, y: -6 }}
                  animate={{ opacity: 1, scale: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.98 }}
                  transition={{
                    type: "spring",
                    stiffness: 400,
                    damping: 30,
                  }}
                  className="absolute right-0 top-10 w-44 overflow-hidden rounded-xl border border-white/10 bg-neutral-900 shadow-2xl origin-top-right"
                >
                  {menuItems.map((item, i) => (
                    <button
                      key={i}
                      onClick={() => {
                        setOpen(false);
                        item.onClick();
                      }}
                      className={`w-full px-4 py-2 text-left text-sm transition ${
                        item.danger
                          ? "text-red-400 hover:bg-red-500/10"
                          : item.highlight
                          ? "text-blue-400 hover:bg-blue-500/10"
                          : "text-neutral-200 hover:bg-neutral-800"
                      }`}
                    >
                      {item.label}
                    </button>
                  ))}
                </motion.div>
              )}
            </>
          )}
        </div>
      </div>
    </motion.header>
  );
}