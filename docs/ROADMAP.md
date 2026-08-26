# Phase Roadmap

Each phase is independently runnable. Do not advance until its acceptance gate passes.

## Phase 0 — Repository + browser plumbing

**Goal:** all apps run and WebMCP availability is visible.

Build:

- pnpm workspace and shared packages.
- WEAVE app on port 3000.
- Provider app runnable as housing/bank/civic on 3101/3102/3103.
- Typed `document.modelContext` wrapper with graceful unsupported state.
- Chrome local headers / iframe permissions.

Acceptance:

- `pnpm install && pnpm dev` starts four origins.
- Each provider visually reports WebMCP registration state.
- Chrome Model Context Tool Inspector can see provider tools on provider pages.
- `pnpm typecheck` and `pnpm build` pass.

## Phase 1 — Capability composition + generated Canvas

**Goal:** prove the open-web composition thesis before privacy complexity.

Build:

- Provider tools with precise schemas and annotations.
- WEAVE capability discovery with `getTools({ fromOrigins })`.
- `toolchange` subscription.
- Capability Graph debug view grouped by origin.
- `weave_compose_workspace` tool.
- Typed Canvas components driven by `WorkspaceManifest`.
- Agent can create a Tokyo relocation workspace from provider capabilities.

Acceptance:

- Agent discovers at least 6 useful tools across 3 independent origins.
- Agent creates/updates the Canvas through WebMCP.
- Human manually changes one Canvas constraint and agent works from the updated state.
- No private Passport values are needed yet.

**Judging target:** WebMCP Leverage + Creativity.

## Phase 2 — Global Passport + Mini Passport consent

**Goal:** prove descriptors-only privacy and progressive disclosure.

Build:

- Synthetic Global Passport stored locally.
- `weave_list_passport_claims` exposes descriptors only.
- `weave_request_passport_grant` opens a blocking human consent surface.
- Grant fields: claims, purpose, audience/scope, mode, duration.
- Active grant panel + manual revoke.
- `reveal` mode for low-risk claims.
- Audit log of request/approve/deny/revoke.

Acceptance:

- Asking the agent what it knows returns claim names but no values.
- Agent requests `preferences.diet` + budget for a concrete purpose.
- User can deselect a requested field before approval.
- Agent can read only fields granted in `reveal` mode.
- Revocation makes subsequent reads fail deterministically.

**Judging target:** Potential Impact + human-agent UX.

## Phase 3 — Sealed use + proof mode

**Goal:** create the memorable privacy primitive.

Build:

- `use` grant mode: agent receives opaque claim handles, not values.
- Provider execution broker resolves permitted handles at execution time.
- `prove` grant mode for simple predicates such as `age >= 18` or `budget >= X`.
- Provider-side grant/scope verification in demo architecture.
- Progressive permission escalation: explore -> eligibility -> application.

Acceptance:

- A provider action succeeds using a sensitive Passport claim whose raw value never appears in tool output/chat.
- A claim outside the Mini Passport fails with `GRANT_SCOPE_VIOLATION`.
- An expired/revoked grant fails with `GRANT_EXPIRED` / `GRANT_REVOKED`.
- UI clearly labels Reveal vs Use without reveal vs Prove.

**Killer line:** “The agent can use your data without owning your data.”

## Phase 4 — Reliability, adversarial cases, evals

**Goal:** make the demo resilient rather than happy-path-only.

Build:

- Deterministic tests for grant engine/tool logic.
- Eval dataset for direct + ambiguous user prompts.
- Tool-selection and sequencing evals.
- Failure cases: denied grant, expired grant, missing provider, stale capability, tool failure.
- Malicious/excessive claim request demo; WEAVE warns or user denies.
- `untrustedContentHint` where provider output contains external-style text.

Acceptance:

- At least 25 eval cases committed.
- 100% deterministic grant-boundary tests.
- Demo can intentionally deny a request and recover.
- Tool descriptions stay within Chrome guidance budgets.

**Judging target:** Execution + skillful WebMCP implementation.

## Phase 5 — Product polish + deployment

**Goal:** judges can understand the project with no explanation from the builder.

Build:

- Strong visual hierarchy and animated capability -> Canvas transition.
- First-run demo identity preloaded with synthetic values.
- “WebMCP unsupported” instructions.
- Production cross-origin deployment and exact Permissions-Policy.
- Public demo reset button.
- Accessible consent interactions and keyboard navigation.
- README screenshots/GIF if time permits.

Acceptance:

- Fresh browser can complete the canonical flow without developer intervention.
- Deployed app works in ChatGPT built-in browser and Chrome WebMCP testing mode.
- No console errors in canonical flow.
- Live reset restores deterministic demo state.

## Phase 6 — Submission package

**Goal:** optimize the judging experience.

Build:

- <3 minute narrated YouTube demo.
- Devpost description mapped explicitly to all four judging criteria.
- Architecture diagram + WebMCP tool inventory.
- Public repo cleanup, visible MIT license, setup instructions.
- Final smoke test after deployment freeze.

Demo beats:

1. Passport values exist but agent sees names only.
2. Agent discovers independent sites and generates the Canvas.
3. Agent requests a Mini Passport; human narrows/approves it.
4. Agent personalizes the app.
5. Sensitive action uses sealed claim without exposing raw value.
6. Human revokes grant; tool access fails while Canvas remains usable.

## Scope kill list

Do not build before submission unless all gates above pass:

- Authentication accounts.
- Real bank/government integrations.
- Mobile app.
- Browser extension.
- Multi-user Passport syncing.
- Cryptographic verifiable credentials.
- More than one polished scenario.
- General visual app builder.
