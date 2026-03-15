"use client";

import { motion } from "framer-motion";

export default function Test() {
  return (
    <div className="p-20">
      <motion.div
        drag="x"
        className="w-40 h-40 bg-red-500"
        onDragStart={() => console.log("drag works")}
      />
    </div>
  );
}