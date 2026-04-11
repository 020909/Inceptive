import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { createServerSupabaseClient } from "@/lib/supabase-server";

export type OrganizationPlan = "starter" | "team" | "business";
export type OrganizationRole = "admin" | "member";
export type OrganizationMemberStatus = "active" | "pending";

export interface Organization {
  id: string;
  name: string;
  slug: string;
  plan: OrganizationPlan;
  created_at: string;
  owner_id: string | null;
}

export interface OrganizationMembership {
  id: string;
  organization_id: string;
  user_id: string | null;
  role: OrganizationRole;
  invited_email: string | null;
  status: OrganizationMemberStatus;
  joined_at: string;
}

export interface UserOrganization extends Organization {
  membership_role: OrganizationRole;
  membership_status: OrganizationMemberStatus;
  joined_at: string;
}

export interface OrganizationMemberWithProfile extends OrganizationMembership {
  email: string | null;
  name: string;
}

type OrgSupabaseClient = SupabaseClient<any, "public", any>;

async function getSupabaseClient(client?: OrgSupabaseClient) {
  return client ?? createServerSupabaseClient();
}

function getServiceRoleClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !serviceRoleKey) {
    return null;
  }

  return createClient(url, serviceRoleKey);
}

function titleCaseEmailPrefix(value: string | null | undefined) {
  const prefix = (value ?? "member").split("@")[0] ?? "member";
  return prefix
    .split(/[._-]+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

export async function getUserOrgs(userId: string, client?: OrgSupabaseClient): Promise<UserOrganization[]> {
  const supabase = await getSupabaseClient(client);
  const { data, error } = await supabase
    .from("organization_members")
    .select(
      `
        role,
        status,
        joined_at,
        organization:organizations (
          id,
          name,
          slug,
          plan,
          created_at,
          owner_id
        )
      `
    )
    .eq("user_id", userId)
    .eq("status", "active")
    .order("joined_at", { ascending: true });

  if (error) {
    throw new Error(error.message);
  }

  return (data ?? [])
    .map((row: any) => {
      const org = Array.isArray(row.organization) ? row.organization[0] : row.organization;
      if (!org) return null;

      return {
        ...org,
        membership_role: row.role,
        membership_status: row.status,
        joined_at: row.joined_at,
      } satisfies UserOrganization;
    })
    .filter(Boolean) as UserOrganization[];
}

export async function getOrgBySlug(slug: string, client?: OrgSupabaseClient): Promise<Organization | null> {
  const supabase = await getSupabaseClient(client);
  const { data, error } = await supabase
    .from("organizations")
    .select("id, name, slug, plan, created_at, owner_id")
    .eq("slug", slug)
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  return data;
}

export async function getOrgMembers(
  orgId: string,
  client?: OrgSupabaseClient
): Promise<OrganizationMemberWithProfile[]> {
  const supabase = await getSupabaseClient(client);
  const { data: memberships, error: membershipsError } = await supabase
    .from("organization_members")
    .select("id, organization_id, user_id, role, invited_email, status, joined_at")
    .eq("organization_id", orgId)
    .order("joined_at", { ascending: true });

  if (membershipsError) {
    throw new Error(membershipsError.message);
  }

  const userIds = (memberships ?? [])
    .map((member) => member.user_id)
    .filter((value): value is string => Boolean(value));

  const profileClient = getServiceRoleClient() ?? supabase;
  const profiles = userIds.length
    ? await profileClient.from("users").select("id, email").in("id", userIds)
    : { data: [], error: null };

  if (profiles.error) {
    throw new Error(profiles.error.message);
  }

  const emailByUserId = new Map(
    (profiles.data ?? []).map((profile) => [profile.id, profile.email as string | null])
  );

  return (memberships ?? []).map((member) => {
    const email = member.user_id ? emailByUserId.get(member.user_id) ?? null : member.invited_email;

    return {
      ...member,
      email,
      name: titleCaseEmailPrefix(email ?? member.invited_email),
    };
  });
}

export async function inviteMember(
  orgId: string,
  email: string,
  invitedBy: string,
  client?: OrgSupabaseClient
) {
  const supabase = await getSupabaseClient(client);
  const normalizedEmail = email.trim().toLowerCase();

  const { data: inviterMembership, error: inviterError } = await supabase
    .from("organization_members")
    .select("id")
    .eq("organization_id", orgId)
    .eq("user_id", invitedBy)
    .eq("role", "admin")
    .eq("status", "active")
    .maybeSingle();

  if (inviterError) {
    throw new Error(inviterError.message);
  }

  if (!inviterMembership) {
    throw new Error("Only organization admins can invite members.");
  }

  const { data, error } = await supabase
    .from("organization_members")
    .insert({
      organization_id: orgId,
      user_id: null,
      invited_email: normalizedEmail,
      role: "member",
      status: "pending",
    })
    .select("id, organization_id, user_id, role, invited_email, status, joined_at")
    .single();

  if (error) {
    throw new Error(error.message);
  }

  return data as OrganizationMembership;
}

export async function createOrganizationWithAdmin(
  userId: string,
  input: {
    name: string;
    slug: string;
    plan?: OrganizationPlan;
  },
  client?: OrgSupabaseClient
) {
  const supabase = await getSupabaseClient(client);
  const normalizedSlug = input.slug.trim().toLowerCase();

  const { data: organization, error: organizationError } = await supabase
    .from("organizations")
    .insert({
      name: input.name.trim(),
      slug: normalizedSlug,
      plan: input.plan ?? "starter",
      owner_id: userId,
    })
    .select("id, name, slug, plan, created_at, owner_id")
    .single();

  if (organizationError) {
    throw new Error(organizationError.message);
  }

  const { error: memberError } = await supabase.from("organization_members").insert({
    organization_id: organization.id,
    user_id: userId,
    role: "admin",
    status: "active",
  });

  if (memberError) {
    await supabase.from("organizations").delete().eq("id", organization.id);
    throw new Error(memberError.message);
  }

  return organization as Organization;
}

export async function getOrgMembershipForUser(
  orgId: string,
  userId: string,
  client?: OrgSupabaseClient
): Promise<OrganizationMembership | null> {
  const supabase = await getSupabaseClient(client);
  const { data, error } = await supabase
    .from("organization_members")
    .select("id, organization_id, user_id, role, invited_email, status, joined_at")
    .eq("organization_id", orgId)
    .eq("user_id", userId)
    .eq("status", "active")
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  return data;
}
