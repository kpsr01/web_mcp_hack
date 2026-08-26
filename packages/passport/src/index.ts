import type { ClaimDescriptor, MiniPassportGrant } from "@weave/protocol";

export const demoClaimDescriptors: ClaimDescriptor[] = [
  { id: "identity.full_name", label: "Full name", category: "identity", sensitivity: "medium", allowedModes: ["reveal", "use"], description: "Legal full name." },
  { id: "identity.date_of_birth", label: "Date of birth", category: "identity", sensitivity: "high", allowedModes: ["use", "prove"], description: "Legal date of birth." },
  { id: "identity.nationality", label: "Nationality", category: "identity", sensitivity: "medium", allowedModes: ["reveal", "use", "prove"], description: "Nationality/citizenship claim." },
  { id: "credentials.passport_number", label: "Passport credential", category: "credential", sensitivity: "high", allowedModes: ["use", "prove"], description: "Synthetic passport credential for the demo." },
  { id: "preferences.diet", label: "Dietary preference", category: "preference", sensitivity: "low", allowedModes: ["reveal", "use"], description: "Food preference used for personalization." },
  { id: "financial.monthly_housing_budget", label: "Monthly housing budget", category: "financial", sensitivity: "medium", allowedModes: ["reveal", "use", "prove"], description: "Preferred maximum monthly housing spend." },
  { id: "location.current_city", label: "Current city", category: "location", sensitivity: "medium", allowedModes: ["reveal", "use"], description: "Current city, not precise street address." },
];

// Synthetic values only. In production these must not live in frontend source.
const demoClaimValues: Record<string, unknown> = {
  "identity.full_name": "Aarav Demo",
  "identity.date_of_birth": "1999-04-18",
  "identity.nationality": "Indian",
  "credentials.passport_number": "DEMO-PASSPORT-4831",
  "preferences.diet": "Vegetarian",
  "financial.monthly_housing_budget": 180000,
  "location.current_city": "Bengaluru",
};

export function readDemoClaimValue(claimId: string): unknown {
  return demoClaimValues[claimId];
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
