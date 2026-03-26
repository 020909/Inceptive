"use client";

import React from "react";
import { AuthProvider } from "@/lib/auth-context";
import { ChatProvider } from "@/lib/chat-context";
import { AgentProvider } from "@/lib/agent-context";
import { Sidebar } from "@/components/layout/sidebar";
import { motion } from "framer-motion";

function LayoutInner({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-[#1E1E1C]">
      <Sidebar />
      <motion.main
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.3 }}
        className="ml-64 min-h-screen"
      >
        {children}
      </motion.main>
    </div>
  );
}

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <AuthProvider>
      <AgentProvider>
        <ChatProvider>
          <LayoutInner>{children}</LayoutInner>
        </ChatProvider>
      </AgentProvider>
    </AuthProvider>
  );
}