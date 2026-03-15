"use client";

import {
  motion,
  useMotionValue,
  useTransform,
  animate,
  PanInfo,
} from "framer-motion";
import { useRef } from "react";

export function SwipeableItem({
  children,
  onSwipeDelete,
}: {
  children: React.ReactNode;
  onSwipeDelete: () => void;
}) {
  const x = useMotionValue(0);
  const ref = useRef<HTMLDivElement>(null);

  const opacity = useTransform(x, [-300, 0], [1, 0]);

  const handleDragEnd = (_: any, info: PanInfo) => {
    const width = ref.current?.offsetWidth || 300;
    const threshold = -width * 0.7;

    if (info.offset.x < threshold || info.velocity.x < -1000) {
      animate(x, -width, {
        duration: 0.25,
        ease: "easeOut",
        onComplete: onSwipeDelete,
      });
      return;
    }

    animate(x, 0, {
      type: "spring",
      stiffness: 400,
      damping: 35,
    });
  };

  return (
    <div
      ref={ref}
      className="relative overflow-hidden rounded-2xl"
    >
      {/* Premium Delete Background */}
      <motion.div
        style={{ opacity }}
        className="
          absolute inset-0
          flex items-center justify-end pr-6
          bg-gradient-to-l
          from-red-600 via-red-500 to-red-500
          text-white
        "
      >
        <div className="flex items-center gap-2">
          {/* Minimal icon */}
          <svg
            xmlns="http://www.w3.org/2000/svg"
            className="w-4 h-4"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.8"
          >
            <path d="M3 6h18" />
            <path d="M8 6V4h8v2" />
            <path d="M6 6l1 14h10l1-14" />
            <path d="M10 11v6" />
            <path d="M14 11v6" />
          </svg>

          <span className="text-sm font-medium">
            Delete
          </span>
        </div>
      </motion.div>

      <motion.div
        drag="x"
        dragConstraints={{ left: -1000, right: 0 }}
        dragElastic={0.05}
        style={{ x, touchAction: "pan-y" }}
        onDragEnd={handleDragEnd}
        className="relative cursor-grab active:cursor-grabbing"
      >
        {children}
      </motion.div>
    </div>
  );
}