import { createServerSupabaseClient } from "@/lib/supabase-server";
import type { OrgSupabaseClient } from "./org-core";
import {
  queryCreateOrganizationWithAdmin,
  queryGetOrgBySlug,
  queryGetOrgMembers,
  queryGetOrgMembershipForUser,
  queryGetUserOrgs,
  queryInviteMember,
} from "./org-core";

export type {
  Organization,
  OrganizationMemberStatus,
  OrganizationMemberWithProfile,
  OrganizationMembership,
  OrganizationPlan,
  OrganizationRole,
  UserOrganization,
} from "./org-core";

export async function getUserOrgs(userId: string, client?: OrgSupabaseClient) {
  const supabase = client ?? (await createServerSupabaseClient());
  return queryGetUserOrgs(supabase, userId);
}

export async function getOrgBySlug(slug: string, client?: OrgSupabaseClient) {
  const supabase = client ?? (await createServerSupabaseClient());
  return queryGetOrgBySlug(supabase, slug);
}

export async function getOrgMembers(orgId: string, client?: OrgSupabaseClient) {
  const supabase = client ?? (await createServerSupabaseClient());
  return queryGetOrgMembers(supabase, orgId);
}

export async function inviteMember(
  orgId: string,
  email: string,
  invitedBy: string,
  client?: OrgSupabaseClient
) {
  const supabase = client ?? (await createServerSupabaseClient());
  return queryInviteMember(supabase, orgId, email, invitedBy);
}

export async function createOrganizationWithAdmin(
  userId: string,
  input: {
    name: string;
    slug: string;
    plan?: import("./org-core").OrganizationPlan;
  },
  client?: OrgSupabaseClient
) {
  const supabase = client ?? (await createServerSupabaseClient());
  return queryCreateOrganizationWithAdmin(supabase, userId, input);
}

export async function getOrgMembershipForUser(
  orgId: string,
  userId: string,
  client?: OrgSupabaseClient
) {
  const supabase = client ?? (await createServerSupabaseClient());
  return queryGetOrgMembershipForUser(supabase, orgId, userId);
}
