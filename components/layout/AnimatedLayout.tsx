"use client";

import { motion, AnimatePresence } from "framer-motion";

export function AnimatedLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <AnimatePresence mode="wait">
      <motion.div
        initial={{
          opacity: 0,
          y: 12,
          scale: 0.98,
          filter: "blur(6px)",
        }}
        animate={{
          opacity: 1,
          y: 0,
          scale: 1,
          filter: "blur(0px)",
        }}
        exit={{
          opacity: 0,
          y: -12,
          scale: 0.985,
          filter: "blur(4px)",
        }}
        transition={{
          type: "spring",
          stiffness: 320,
          damping: 32,
        }}
      >
        {children}
      </motion.div>
    </AnimatePresence>
  );
}