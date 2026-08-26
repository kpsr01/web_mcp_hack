import assert from "node:assert/strict";
import test from "node:test";
import { authorizeOpaqueClaim, demoClaimDescriptors, isGrantActive, issueOpaqueClaimHandles, readGrantedClaim } from "../src/index.ts";
import type { MiniPassportGrant } from "@weave/protocol";

const now = new Date("2025-01-01T00:00:00.000Z");

function grant(overrides: Partial<MiniPassportGrant> = {}): MiniPassportGrant {
  return {
    grantId: "grant_test",
    claimIds: ["preferences.diet"],
    purpose: "Personalize Tokyo housing search",
    audience: "housing",
    mode: "reveal",
    issuedAt: "2025-01-01T00:00:00.000Z",
    expiresAt: "2025-01-01T00:01:00.000Z",
    ...overrides,
  };
}

test("claim discovery exposes descriptors without values", () => {
  assert.ok(demoClaimDescriptors.length > 0);
  assert.ok(demoClaimDescriptors.every((claim) => !("value" in claim)));
});

test("active reveal grants return only their selected claim", () => {
  assert.deepEqual(
    readGrantedClaim([grant()], { grantId: "grant_test", claimId: "preferences.diet", audience: "housing" }, now),
    { claimId: "preferences.diet", value: "Vegetarian" },
  );
  assert.deepEqual(
    readGrantedClaim([grant()], { grantId: "grant_test", claimId: "financial.monthly_housing_budget", audience: "housing" }, now),
    { status: "error", code: "GRANT_SCOPE_VIOLATION" },
  );
  assert.deepEqual(
    readGrantedClaim([grant()], { grantId: "grant_test", claimId: "preferences.diet", audience: "bank" }, now),
    { status: "error", code: "GRANT_SCOPE_VIOLATION" },
  );
});

test("revoked, expired, and non-reveal grants never return values", () => {
  assert.deepEqual(
    readGrantedClaim([grant({ revokedAt: "2025-01-01T00:00:10.000Z" })], { grantId: "grant_test", claimId: "preferences.diet", audience: "housing" }, now),
    { status: "error", code: "GRANT_REVOKED" },
  );
  const expired = grant({ expiresAt: "2025-01-01T00:00:00.000Z" });
  assert.equal(isGrantActive(expired, now), false);
  assert.deepEqual(
    readGrantedClaim([expired], { grantId: "grant_test", claimId: "preferences.diet", audience: "housing" }, now),
    { status: "error", code: "GRANT_EXPIRED" },
  );
  assert.deepEqual(
    readGrantedClaim([grant({ mode: "use" })], { grantId: "grant_test", claimId: "preferences.diet", audience: "housing" }, now),
    { status: "error", code: "GRANT_MODE_VIOLATION" },
  );
});

test("opaque use handles authorize provider access without exposing the raw value", () => {
  const useGrant = grant({
    grantId: "grant_use",
    claimIds: ["credentials.passport_number"],
    audience: "bank",
    mode: "use",
  });
  const [handle] = issueOpaqueClaimHandles(useGrant);
  assert.equal("value" in handle, false);
  assert.deepEqual(
    authorizeOpaqueClaim([useGrant], [handle], {
      handleId: handle.handleId,
      audience: "bank",
      mode: "use",
    }, now),
    { status: "authorized", claimId: "credentials.passport_number", value: "DEMO-PASSPORT-4831" },
  );
});

test("prove handles return predicates and reject scope, mode, revocation, and expiry", () => {
  const proveGrant = grant({
    grantId: "grant_prove",
    claimIds: ["identity.date_of_birth"],
    audience: "bank",
    mode: "prove",
  });
  const [handle] = issueOpaqueClaimHandles(proveGrant);
  const proof = authorizeOpaqueClaim([proveGrant], [handle], {
    handleId: handle.handleId,
    audience: "bank",
    mode: "prove",
    predicate: { kind: "ageAtLeast", value: 18 },
  }, now);
  assert.deepEqual(proof, { status: "authorized", claimId: "identity.date_of_birth", proof: true });
  assert.equal("value" in proof, false);
  assert.deepEqual(
    authorizeOpaqueClaim([proveGrant], [handle], { handleId: handle.handleId, audience: "housing", mode: "prove", predicate: { kind: "ageAtLeast", value: 18 } }, now),
    { status: "error", code: "GRANT_SCOPE_VIOLATION" },
  );
  assert.deepEqual(
    authorizeOpaqueClaim([proveGrant], [handle], { handleId: handle.handleId, audience: "bank", mode: "use" }, now),
    { status: "error", code: "GRANT_MODE_VIOLATION" },
  );
  assert.deepEqual(
    authorizeOpaqueClaim([{ ...proveGrant, revokedAt: "2025-01-01T00:00:10.000Z" }], [handle], { handleId: handle.handleId, audience: "bank", mode: "prove", predicate: { kind: "ageAtLeast", value: 18 } }, now),
    { status: "error", code: "GRANT_REVOKED" },
  );
  assert.deepEqual(
    authorizeOpaqueClaim([{ ...proveGrant, expiresAt: "2025-01-01T00:00:00.000Z" }], [handle], { handleId: handle.handleId, audience: "bank", mode: "prove", predicate: { kind: "ageAtLeast", value: 18 } }, now),
    { status: "error", code: "GRANT_EXPIRED" },
  );
});
