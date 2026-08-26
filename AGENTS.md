# Coding Agent Handoff

Read this file, `docs/ROADMAP.md`, `docs/ARCHITECTURE.md`, and `docs/WEBMCP_TOOL_STRATEGY.md` before changing architecture.

## Mission

Ship a polished WebMCP Challenge submission, not a general-purpose identity platform. The demo must prove four things within three minutes:

1. Independent websites expose genuine WebMCP tools.
2. An agent composes those capabilities into a temporary WEAVE app for a user goal.
3. Passport values remain private until a human grants selected claims.
4. Human interaction, grant changes, and revocation immediately affect what the agent can do.

## Non-negotiable invariants

- `list_passport_claims` returns descriptors only. It must never return claim values.
- Never place real personal data, credentials, API keys, or payment data in this repository.
- Default to synthetic/demo identities.
- Generated UI is schema/component driven. Do not execute arbitrary model-generated JavaScript/HTML.
- Consequential provider tools must be visibly simulated unless/until a safe real integration is intentionally added.
- Cross-origin provider demos must use WebMCP `exposedTo` and browser permissions intentionally; do not replace them with direct REST calls just to make the demo easier.
- All tools need precise names/descriptions/schemas; avoid overlapping tools.
- Read-only tools should use `readOnlyHint: true`; external/user-generated output should use `untrustedContentHint: true` where relevant.
- Tool execution must update visible UI state so human and agent share the same truth.
- Every phase ends with a runnable checkpoint before starting the next.

## Development order

Follow phase gates in `docs/ROADMAP.md`. Do not start visual polish or secondary scenarios before the Phase 3 end-to-end privacy flow works in both Chrome WebMCP mode and the deployed ChatGPT browser target.

## MVP scenario

User goal: **“Set me up to live in Tokyo.”**

Provider origins:

- Housing
- Bank
- Civic registration

The scenario is intentionally not a vacation planner. It demonstrates a longer-lived life task where data minimization and cross-site capability composition matter.

## Product vocabulary

- **Global Passport**: private vault containing claim descriptors + values. Agent initially sees descriptors only.
- **Claim**: one typed fact/preference/credential, e.g. `identity.nationality`.
- **Mini Passport**: temporary grant scoped to a task.
- **Grant mode**: `reveal`, `use`, or `prove`.
- **Canvas**: human-facing generated workspace.
- **Capability Graph**: tools WEAVE can discover from participating origins.
- **WorkspaceManifest**: safe JSON description of the temporary app.

## Before each PR/commit

- `pnpm typecheck`
- `pnpm build`
- Manually test current phase acceptance criteria.
- Update docs when tool names/schemas or grant semantics change.
- Add/adjust deterministic tests and eval cases for changed behavior.
