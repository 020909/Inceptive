"use client";

import { useEffect, useState } from "react";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase";
import { Loader2 } from "lucide-react";

export default function Home() {
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const checkAuth = async () => {
      const supabase = createClient();
      const { data: { session } } = await supabase.auth.getSession();

      if (session) {
        redirect("/dashboard");
      } else {
        redirect("/login");
      }
    };

    checkAuth();
  }, []);

  return (
    <div className="min-h-screen flex items-center justify-center" style={{ background: "var(--background)" }}>
      <Loader2 className="w-6 h-6 animate-spin text-[var(--foreground-secondary)]" />
    </div>
  );
}
