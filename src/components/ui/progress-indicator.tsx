"use client";
import React from "react";
import type { TaskLog } from "@/lib/chat-context";
import { motion, AnimatePresence } from "framer-motion";

export function ProgressIndicator({ logs }: { logs: TaskLog[] }) {
  if (!logs || logs.length === 0) return null;

  return (
    <div className="mb-2 flex flex-col gap-1 w-full">
      <AnimatePresence>
        {logs.map((log) => (
          <motion.div
            layout
            key={log.id}
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            transition={{ duration: 0.15 }}
            className="flex items-center gap-2 py-1 text-[13px] text-[#9a9aaa]"
          >
            <span>{log.action || "Working..."}</span>
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
}
