"use client";

import { useState, useRef, useEffect } from "react";
import {
  motion,
  AnimatePresence,
  useScroll,
  useTransform,
} from "framer-motion";
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

  const height = useTransform(scrollY, [0, 96], [74, 60]);
  const backdrop = useTransform(
    scrollY,
    [0, 96],
    ["blur(8px)", "blur(18px)"]
  );
  const bgColor = useTransform(
    scrollY,
    [0, 96],
    ["rgba(10,10,10,0.52)", "rgba(10,10,10,0.94)"]
  );
  const borderOpacity = useTransform(
    scrollY,
    [0, 96],
    [0.04, 0.1]
  );
  const scale = useTransform(scrollY, [0, 96], [1, 0.965]);
  const titleOpacity = useTransform(
    scrollY,
    [0, 48],
    [0.84, 1]
  );

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
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-white/[0.045] via-white/[0.015] to-transparent" />

      <motion.div
        style={{
          opacity: borderOpacity,
        }}
        className="absolute bottom-0 left-0 right-0 h-px bg-white"
      />

      <div className="relative mx-auto flex h-full max-w-xl items-center justify-between px-4">
        <div className="flex min-w-[72px] items-center gap-2">
          {leftSlot}
        </div>

        <motion.div
          style={{ scale, opacity: titleOpacity }}
          className="flex flex-1 flex-col items-center px-3 text-center"
        >
          {title && (
            <span className="truncate text-sm font-medium text-white">
              {title}
            </span>
          )}
          {subtitle && (
            <span className="truncate text-xs capitalize text-neutral-400">
              {subtitle}
            </span>
          )}
        </motion.div>

        <div className="relative flex min-w-[72px] items-center justify-end gap-2">
          {rightSlot}

          {menuItems && menuItems.length > 0 && (
            <>
              <button
                onClick={() => setOpen((v) => !v)}
                className="flex h-8 w-8 items-center justify-center rounded-full text-neutral-300 transition-all duration-200 hover:bg-neutral-800/80 hover:text-white active:scale-95"
              >
                ⋯
              </button>

              <AnimatePresence>
                {open && (
                  <motion.div
                    ref={menuRef}
                    initial={{ opacity: 0, scale: 0.96, y: -8 }}
                    animate={{ opacity: 1, scale: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.98, y: -4 }}
                    transition={{
                      type: "spring",
                      stiffness: 420,
                      damping: 30,
                    }}
                    className="absolute right-0 top-10 origin-top-right overflow-hidden rounded-2xl border border-white/10 bg-neutral-900/95 shadow-2xl backdrop-blur-xl"
                  >
                    <div className="min-w-[180px] py-1.5">
                      {menuItems.map((item, i) => (
                        <button
                          key={i}
                          onClick={() => {
                            setOpen(false);
                            item.onClick();
                          }}
                          className={`w-full px-4 py-2.5 text-left text-sm transition ${
                            item.danger
                              ? "text-red-400 hover:bg-red-500/10"
                              : item.highlight
                              ? "text-blue-400 hover:bg-blue-500/10"
                              : "text-neutral-200 hover:bg-neutral-800/90"
                          }`}
                        >
                          {item.label}
                        </button>
                      ))}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </>
          )}
        </div>
      </div>
    </motion.header>
  );
}