"use client";

import React, { createContext, useContext, useEffect, useMemo, useState } from "react";
import { usePathname } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import { createClient } from "@/lib/supabase";
import { getUserOrgs, type UserOrganization } from "@/lib/supabase/org";

interface OrgContextValue {
  orgs: UserOrganization[];
  currentOrg: UserOrganization | null;
  loading: boolean;
  refreshOrgs: () => Promise<void>;
}

const OrgContext = createContext<OrgContextValue>({
  orgs: [],
  currentOrg: null,
  loading: true,
  refreshOrgs: async () => {},
});

function getOrgSlugFromPathname(pathname: string) {
  const match = pathname.match(/^\/org\/([^/]+)/);
  return match?.[1] ? decodeURIComponent(match[1]) : null;
}

export function OrgProvider({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { user, loading: authLoading } = useAuth();
  const [orgs, setOrgs] = useState<UserOrganization[]>([]);
  const [loading, setLoading] = useState(true);

  const refreshOrgs = async () => {
    if (!user?.id) {
      setOrgs([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    try {
      const data = await getUserOrgs(user.id, createClient());
      setOrgs(data);
    } catch (error) {
      console.error("Failed to load organizations", error);
      setOrgs([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (authLoading) return;
    void refreshOrgs();
  }, [authLoading, user?.id]);

  const currentOrgSlug = getOrgSlugFromPathname(pathname);

  const currentOrg = useMemo(() => {
    if (orgs.length === 0) return null;
    if (currentOrgSlug) {
      return orgs.find((org) => org.slug === currentOrgSlug) ?? orgs[0];
    }
    return orgs[0];
  }, [currentOrgSlug, orgs]);

  return (
    <OrgContext.Provider value={{ orgs, currentOrg, loading, refreshOrgs }}>
      {children}
    </OrgContext.Provider>
  );
}

export function useOrg() {
  return useContext(OrgContext);
}
