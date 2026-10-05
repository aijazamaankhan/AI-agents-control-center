import { randomBytes } from "node:crypto";
import { logIn, signUp } from "@/features/auth/server/auth-service";
import { createOrganization } from "@/features/organizations/server/organization-service";
import type { OrganizationInput } from "@/features/organizations/schemas";
import { resolveOrgContext, resolveSessionToken, type OrgContext } from "@/lib/auth/sessions";

export function uniqueEmail(label = "user") {
  return `${label}-${randomBytes(6).toString("hex")}@example.test`;
}

export const ORG_INPUT: OrganizationInput = {
  name: "Acme Corporation",
  industry: "Software & Technology",
  companySize: "51-200",
  country: "US",
  timezone: "America/New_York",
};

/** Signs up a user, creates an org as OWNER and returns the resolved server context. */
export async function createTenant(name = "Acme Corporation") {
  const email = uniqueEmail();
  const password = "s3cure-password!";
  const auth = await signUp({ name: "Test Owner", email, password });
  const session = await resolveSessionToken(auth.token);
  if (!session) throw new Error("session not created");
  const org = await createOrganization(
    { userId: auth.userId, sessionId: session.sessionId },
    { ...ORG_INPUT, name },
  );
  const ctx = (await resolveOrgContext((await resolveSessionToken(auth.token))!)) as OrgContext;
  return { email, password, token: auth.token, userId: auth.userId, org, ctx };
}

export { logIn };
