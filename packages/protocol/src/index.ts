export type ClaimCategory = "identity" | "credential" | "preference" | "financial" | "location";
export type ClaimSensitivity = "low" | "medium" | "high";
export type ClaimAccessMode = "reveal" | "use" | "prove";
export type ClaimPredicate =
  | { kind: "ageAtLeast"; value: number }
  | { kind: "numberAtLeast"; value: number }
  | { kind: "present" };

export interface ClaimDescriptor {
  id: string;
  label: string;
  category: ClaimCategory;
  sensitivity: ClaimSensitivity;
  allowedModes: ClaimAccessMode[];
  description: string;
}

export interface GrantRequest {
  requestId: string;
  claimIds: string[];
  purpose: string;
  audience: string;
  mode: ClaimAccessMode;
  durationSeconds: number;
}

export interface MiniPassportGrant {
  grantId: string;
  claimIds: string[];
  purpose: string;
  audience: string;
  mode: ClaimAccessMode;
  issuedAt: string;
  expiresAt: string;
  revokedAt?: string;
}

export interface WorkspaceSection {
  id: string;
  title: string;
  description: string;
  provider: "housing" | "bank" | "civic" | "passport" | "overview";
  status?: "idle" | "ready" | "blocked" | "complete";
}

export type WorkspaceConstraintType = "text" | "number" | "boolean";

export interface WorkspaceConstraint {
  id: string;
  label: string;
  type: WorkspaceConstraintType;
  value: string | number | boolean;
  unit?: string;
}

export interface WorkspaceManifest {
  id: string;
  title: string;
  goal: string;
  summary?: string;
  constraints?: WorkspaceConstraint[];
  sections: WorkspaceSection[];
}

export interface CapabilitySummary {
  name: string;
  title?: string;
  description: string;
  origin?: string;
  readOnly?: boolean;
  untrustedContent?: boolean;
}

export type ProviderKind = "housing" | "bank" | "civic";
