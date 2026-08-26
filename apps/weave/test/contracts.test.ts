import assert from "node:assert/strict";
import test from "node:test";
import { createWorkspaceManifest, summarizeProviderResult } from "../src/contracts.ts";

const section = { id: "housing", title: "Housing", description: "Search suitable homes", provider: "housing" } as const;

function workspaceInput(overrides: Record<string, unknown> = {}) {
  return { title: "Tokyo setup", goal: "Set me up to live in Tokyo", sections: [section], ...overrides };
}

test("workspace manifests keep only validated schema fields", () => {
  const manifest = createWorkspaceManifest(workspaceInput({ summary: "  Long-term move  ", extra: "drop me" }), null);
  assert.ok(manifest);
  assert.match(manifest.id, /^workspace_/);
  assert.equal(manifest.summary, "Long-term move");
  assert.equal("extra" in manifest, false);
  assert.deepEqual(manifest.sections, [section]);
  assert.equal(manifest.constraints?.length, 3);
});

test("same-goal composition preserves existing constraints", () => {
  const current = createWorkspaceManifest(workspaceInput(), null);
  assert.ok(current);
  const custom = [{ id: "budget", label: "Budget", type: "number", value: 220000, unit: "JPY" }];
  const next = createWorkspaceManifest(workspaceInput({ constraints: custom }), current);
  assert.ok(next);
  assert.deepEqual(next.constraints, custom);
  const preserved = createWorkspaceManifest(workspaceInput(), next);
  assert.deepEqual(preserved?.constraints, custom);
});

test("malformed workspace sections are rejected before state changes", () => {
  assert.equal(createWorkspaceManifest(workspaceInput({ sections: [] }), null), null);
  assert.equal(createWorkspaceManifest(workspaceInput({ sections: [{ ...section, provider: "unknown" }] }), null), null);
  assert.equal(createWorkspaceManifest(workspaceInput({ sections: [{ ...section, title: " " }] }), null), null);
  assert.equal(createWorkspaceManifest(workspaceInput({ sections: Array.from({ length: 9 }, () => section) }), null), null);
  assert.equal(createWorkspaceManifest(workspaceInput({ title: " " }), null), null);
});

test("provider summaries expose safe status metadata only", () => {
  assert.deepEqual(
    summarizeProviderResult({ status: "error", code: "PROVIDER_UNAVAILABLE", rawValue: "secret", message: "external text", listings: [{ address: "private" }] }),
    { status: "error", code: "PROVIDER_UNAVAILABLE" },
  );
  assert.deepEqual(summarizeProviderResult({ status: "completed", privacy: "opaque" }), { status: "completed", privacy: "opaque" });
  assert.deepEqual(summarizeProviderResult("provider text"), { status: "completed" });
});
