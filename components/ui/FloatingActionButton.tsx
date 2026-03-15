"use client";

import { motion } from "framer-motion";

export function FloatingActionButton({
  onClick,
}: {
  onClick: () => void;
}) {
  return (
    <motion.button
      onClick={onClick}
      initial={{ opacity: 0, y: 40, scale: 0.9 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{
        type: "spring",
        stiffness: 260,
        damping: 20,
      }}
      whileHover={{
        scale: 1.08,
        boxShadow: "0px 8px 30px rgba(59,130,246,0.35)",
      }}
      whileTap={{
        scale: 0.94,
      }}
      className="
        fixed bottom-6 right-6
        h-14 w-14
        rounded-2xl
        bg-blue-600
        text-white
        flex items-center justify-center
        shadow-lg
        backdrop-blur
        transition-colors
        hover:bg-blue-500
        active:bg-blue-600
      "
    >
      +
    </motion.button>
  );
}