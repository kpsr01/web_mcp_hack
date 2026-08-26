import type { ClaimDescriptor, ClaimPredicate, MiniPassportGrant } from "@weave/protocol";

export const demoClaimDescriptors: ClaimDescriptor[] = [
  { id: "identity.full_name", label: "Full name", category: "identity", sensitivity: "medium", allowedModes: ["reveal", "use"], description: "Legal full name." },
  { id: "identity.date_of_birth", label: "Date of birth", category: "identity", sensitivity: "high", allowedModes: ["use", "prove"], description: "Legal date of birth." },
  { id: "identity.nationality", label: "Nationality", category: "identity", sensitivity: "medium", allowedModes: ["reveal", "use", "prove"], description: "Nationality/citizenship claim." },
  { id: "credentials.passport_number", label: "Passport credential", category: "credential", sensitivity: "high", allowedModes: ["use", "prove"], description: "Synthetic passport credential for the demo." },
  { id: "preferences.diet", label: "Dietary preference", category: "preference", sensitivity: "low", allowedModes: ["reveal", "use"], description: "Food preference used for personalization." },
  { id: "financial.monthly_housing_budget", label: "Monthly housing budget", category: "financial", sensitivity: "medium", allowedModes: ["reveal", "use", "prove"], description: "Preferred maximum monthly housing spend." },
  { id: "location.current_city", label: "Current city", category: "location", sensitivity: "medium", allowedModes: ["reveal", "use"], description: "Current city, not precise street address." },
];

const passportStorageKey = "weave.demo.passport";
const syntheticClaimValues: Record<string, unknown> = {
  "identity.full_name": "Aarav Demo",
  "identity.date_of_birth": "1999-04-18",
  "identity.nationality": "Indian",
  "credentials.passport_number": "DEMO-PASSPORT-4831",
  "preferences.diet": "Vegetarian",
  "financial.monthly_housing_budget": 180000,
  "location.current_city": "Bengaluru",
};

function loadClaimValues(): Record<string, unknown> {
  if (typeof localStorage === "undefined") return syntheticClaimValues;
  try {
    const stored = localStorage.getItem(passportStorageKey);
    if (stored) {
      const parsed: unknown = JSON.parse(stored);
      if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) return parsed as Record<string, unknown>;
    }
    localStorage.setItem(passportStorageKey, JSON.stringify(syntheticClaimValues));
  } catch {
    // Private browsing or blocked storage still gets the synthetic demo vault.
  }
  return syntheticClaimValues;
}

const demoClaimValues = loadClaimValues();

function readDemoClaimValue(claimId: string): unknown {
  return demoClaimValues[claimId];
}

export interface OpaqueClaimHandle {
  handleId: string;
  grantId: string;
  claimId: string;
}

export function issueOpaqueClaimHandles(grant: MiniPassportGrant): OpaqueClaimHandle[] {
  return grant.claimIds.map((claimId) => ({
    handleId: `claim_${crypto.randomUUID()}`,
    grantId: grant.grantId,
    claimId,
  }));
}

function evaluatePredicate(claimId: string, value: unknown, predicate: ClaimPredicate, now: Date): boolean | null {
  if (predicate.kind === "present") return value !== undefined && value !== null && value !== "";
  if (!Number.isFinite(predicate.value) || predicate.value < 0) return null;
  if (predicate.kind === "numberAtLeast" && claimId === "financial.monthly_housing_budget" && typeof value === "number") {
    return value >= predicate.value;
  }
  if (predicate.kind === "ageAtLeast" && claimId === "identity.date_of_birth" && typeof value === "string") {
    const birthDate = new Date(`${value}T00:00:00.000Z`);
    if (Number.isNaN(birthDate.getTime())) return null;
    let age = now.getUTCFullYear() - birthDate.getUTCFullYear();
    const beforeBirthday = now.getUTCMonth() < birthDate.getUTCMonth()
      || (now.getUTCMonth() === birthDate.getUTCMonth() && now.getUTCDate() < birthDate.getUTCDate());
    if (beforeBirthday) age -= 1;
    return age >= predicate.value;
  }
  return null;
}

export type ClaimAuthorization =
  | { status: "authorized"; claimId: string; value?: unknown; proof?: boolean }
  | { status: "error"; code: "GRANT_REQUIRED" | "GRANT_EXPIRED" | "GRANT_REVOKED" | "GRANT_MODE_VIOLATION" | "GRANT_SCOPE_VIOLATION" | "CLAIM_UNAVAILABLE" | "INVALID_PREDICATE" };

export function authorizeOpaqueClaim(
  grants: MiniPassportGrant[],
  handles: OpaqueClaimHandle[],
  input: { handleId: string; audience: string; mode: "use" | "prove"; predicate?: ClaimPredicate },
  now = new Date(),
): ClaimAuthorization {
  const handle = handles.find((item) => item.handleId === input.handleId);
  if (!handle) return { status: "error", code: "GRANT_REQUIRED" };
  const grant = grants.find((item) => item.grantId === handle.grantId);
  if (!grant) return { status: "error", code: "GRANT_REQUIRED" };
  if (grant.revokedAt) return { status: "error", code: "GRANT_REVOKED" };
  if (!isGrantActive(grant, now)) return { status: "error", code: "GRANT_EXPIRED" };
  if (grant.audience !== input.audience || !grant.claimIds.includes(handle.claimId)) {
    return { status: "error", code: "GRANT_SCOPE_VIOLATION" };
  }
  if (grant.mode !== input.mode) return { status: "error", code: "GRANT_MODE_VIOLATION" };
  const descriptor = demoClaimDescriptors.find((claim) => claim.id === handle.claimId);
  if (!descriptor) return { status: "error", code: "CLAIM_UNAVAILABLE" };
  if (!descriptor.allowedModes.includes(input.mode)) return { status: "error", code: "GRANT_MODE_VIOLATION" };

  const value = readDemoClaimValue(handle.claimId);
  if (value === undefined) return { status: "error", code: "CLAIM_UNAVAILABLE" };
  if (input.mode === "use") return { status: "authorized", claimId: handle.claimId, value };

  if (!input.predicate) return { status: "error", code: "INVALID_PREDICATE" };
  const proof = evaluatePredicate(handle.claimId, value, input.predicate, now);
  return proof === null
    ? { status: "error", code: "INVALID_PREDICATE" }
    : { status: "authorized", claimId: handle.claimId, proof };
}

export function createGrant(input: {
  claimIds: string[];
  purpose: string;
  audience: string;
  mode: MiniPassportGrant["mode"];
  durationSeconds: number;
}): MiniPassportGrant {
  const issuedAt = new Date();
  const expiresAt = new Date(issuedAt.getTime() + input.durationSeconds * 1000);
  return {
    grantId: `grant_${crypto.randomUUID()}`,
    ...input,
    issuedAt: issuedAt.toISOString(),
    expiresAt: expiresAt.toISOString(),
  };
}

export function isGrantActive(grant: MiniPassportGrant, now = new Date()): boolean {
  return !grant.revokedAt && now.getTime() < new Date(grant.expiresAt).getTime();
}

export function readGrantedClaim(
  grants: MiniPassportGrant[],
  input: { grantId: string; claimId: string; audience: string },
  now = new Date(),
): Record<string, unknown> {
  const grant = grants.find((item) => item.grantId === input.grantId);
  if (!grant) return { status: "error", code: "GRANT_REQUIRED" };
  if (grant.revokedAt) return { status: "error", code: "GRANT_REVOKED" };
  if (!isGrantActive(grant, now)) return { status: "error", code: "GRANT_EXPIRED" };
  if (grant.mode !== "reveal") return { status: "error", code: "GRANT_MODE_VIOLATION" };
  if (grant.audience !== input.audience || !grant.claimIds.includes(input.claimId)) {
    return { status: "error", code: "GRANT_SCOPE_VIOLATION" };
  }
  const descriptor = demoClaimDescriptors.find((claim) => claim.id === input.claimId);
  if (!descriptor) return { status: "error", code: "CLAIM_UNAVAILABLE" };
  if (!descriptor.allowedModes.includes("reveal")) return { status: "error", code: "GRANT_MODE_VIOLATION" };
  const value = readDemoClaimValue(input.claimId);
  return value === undefined
    ? { status: "error", code: "CLAIM_UNAVAILABLE" }
    : { claimId: input.claimId, value };
}
