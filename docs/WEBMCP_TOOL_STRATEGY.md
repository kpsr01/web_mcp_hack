# WebMCP Tool Strategy

Chrome recommends a deliberate tool strategy: single-purpose tools, precise names/descriptions, non-overlapping schemas, dynamic registration when appropriate, visible UI updates, graceful failures, and evals.

## WEAVE-owned tools

### `weave_list_passport_claims`

Read-only. Returns claim descriptors only.

### `weave_compose_workspace`

Mutates the Canvas from a typed `WorkspaceManifest`. This is the app-generation primitive.
- Accepts typed task constraints; when the same goal is re-composed without constraints, current human Canvas edits remain canonical.

### `weave_request_passport_grant`

Creates a visible consent request and asynchronously waits for human approval/denial. Never auto-approves.

### `weave_list_active_grants`

Read-only grant metadata; no values.

### `weave_read_granted_claim`

Phase 2 only. Accepts `grantId`, `claimId`, and the grant's exact `audience`. Returns a value only when the active grant explicitly uses `reveal` mode and includes the requested claim.

### `weave_start_bank_application`

Phase 3 broker operation. Accepts `accountId`, an opaque `claimHandle`, and `mode` (`use` or `prove`). `prove` also requires one small predicate (`ageAtLeast`, `numberAtLeast`, or `present`). WEAVE validates the grant before invoking the exact bank provider tool and returns only provider-safe metadata.

Provider-side `bank_start_application` repeats audience, scope, mode, expiry, and revocation checks through the trusted WEAVE parent bridge. In `use` mode the provider may consume the selected synthetic credential without returning it; in `prove` mode it receives only the derived predicate result.

## Provider tools — MVP

Housing:

- `housing_search`
- `housing_hold`

Bank:

- `bank_check_eligibility`
- `bank_start_application`

Civic:

- `civic_get_requirements`
- `civic_book_registration`

## Annotations

Use:

```ts
annotations: { readOnlyHint: true }
```

for pure reads.

Use:

```ts
annotations: { untrustedContentHint: true }
```

when output intentionally represents external/user-controlled content.

Do not mark state-changing tools as read-only.

Use dynamic exposure to make state legible:

- Before workspace exists: composition + discovery tools.
- After a Passport request: consent remains a human UI action, not a hidden tool.
- After grants: broker operations accept only opaque handles issued by the approved grant.
- On revoke/expiry: sealed provider operations reliably reject with explicit grant errors.

The tool surface should be inspectable in the demo.

## Output discipline

Follow current Chrome guidance where practical:

- Tool names <= ~30 chars.
- Parameter names <= ~30 chars.
- Tool descriptions <= ~500 chars.
- Parameter descriptions <= ~150 chars.
- Individual tool output <= ~1.5K chars.

Return structured concise JSON-like objects. Errors should be machine-actionable:

```text
GRANT_REQUIRED
GRANT_EXPIRED
GRANT_REVOKED
GRANT_MODE_VIOLATION
GRANT_SCOPE_VIOLATION
PROVIDER_UNAVAILABLE
STALE_CAPABILITY
INVALID_PREDICATE
INVALID_SEALED_REQUEST
PROVIDER_INELIGIBLE
```

## Cross-origin requirements

Provider registration uses current standard primitives:

- `document.modelContext.registerTool(...)`
- `exposedTo: [WEAVE_ORIGIN]`
- `AbortSignal` for lifecycle cleanup
- `getTools({ fromOrigins })` for WEAVE-side discovery
- `toolchange` to refresh the Capability Graph

The top-level document must delegate the `tools` Permissions Policy to the embedded provider origins.
