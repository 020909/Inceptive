/**
 * Browser-safe org helpers: pass the Supabase client from `@/lib/supabase` (createClient()).
 * Do not import `@/lib/supabase/org` from Client Components — it pulls in the server cookie client.
 */
import type { OrgSupabaseClient } from "./org-core";
import {
  queryCreateOrganizationWithAdmin,
  queryGetUserOrgs,
  queryInviteMember,
} from "./org-core";

export type {
  Organization,
  OrganizationMembership,
  OrganizationPlan,
  UserOrganization,
} from "./org-core";

export async function getUserOrgs(userId: string, client: OrgSupabaseClient) {
  return queryGetUserOrgs(client, userId);
}

export async function inviteMember(
  orgId: string,
  email: string,
  invitedBy: string,
  client: OrgSupabaseClient
) {
  return queryInviteMember(client, orgId, email, invitedBy);
}

export async function createOrganizationWithAdmin(
  userId: string,
  input: {
    name: string;
    slug: string;
    plan?: import("./org-core").OrganizationPlan;
  },
  client: OrgSupabaseClient
) {
  return queryCreateOrganizationWithAdmin(client, userId, input);
}
