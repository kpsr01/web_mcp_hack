# WEAVE Submission Package

## Public links

- **Live WEAVE app:** <https://weave-webmcp-kpsr01.vercel.app>
- **Public repository:** <https://github.com/kpsr01/web_mcp_hack>
- **Narrated demo (2:48.75):** <https://github.com/kpsr01/web_mcp_hack/releases/download/phase-6-demo/weave-phase6-demo.mp4>
- **Architecture:** [docs/ARCHITECTURE.md](ARCHITECTURE.md)
- **WebMCP tool inventory:** [docs/WEBMCP_TOOL_STRATEGY.md](WEBMCP_TOOL_STRATEGY.md)
- **License:** [MIT](../LICENSE)

## Devpost description

### WebMCP Leverage

WEAVE is built around real WebMCP capabilities, not a mock function-calling layer. Three independent provider origins register tools with `document.modelContext.registerTool` and `exposedTo: [WEAVE_ORIGIN]`. The WEAVE origin discovers them with origin-filtered `getTools({ fromOrigins })` and refreshes its Capability Graph through `toolchange`. The live Tokyo scenario composes Housing, Bank, and Civic tools into one temporary Canvas while each provider remains independently deployed.

Tools have precise schemas and annotations: read-only discovery tools use `readOnlyHint`, housing listings use `untrustedContentHint`, and consequential tools are explicitly named. Every tool mutation updates the shared visible state. The committed eval dataset contains 25 cases covering tool choice, parameters, sequencing, privacy, and recovery.

### Execution

The public flow is a coherent, resettable experience:

1. Open WEAVE and see the preloaded synthetic identity.
2. Ask for a Tokyo relocation workspace.
3. Watch the agent discover three provider origins and compose the Canvas.
4. Review and narrow a Mini Passport request before approving it.
5. Start a simulated bank application with an opaque use handle.
6. Revoke the grant and retry; the protected action fails with `GRANT_REVOKED` while the Canvas remains usable.

The app reports an explicit unsupported-browser state, exposes a public **Reset demo** control, and keeps provider actions visibly simulated. No account or real credential is required.

### Potential Impact

Cross-site browser agents need personal context, but copying a complete identity profile into agent memory creates unnecessary disclosure and weakens human control. WEAVE inserts a user-controlled delegation boundary between intent and capability execution. The agent can discover claim descriptors without values, request only the claims needed for the current step, and receive a grant limited by claim, audience, mode, and duration.

This pattern is relevant to relocation, financial onboarding, civic workflows, and other tasks where useful automation crosses service boundaries but identity data should remain under the user's control. The repository uses synthetic data only; it is a prototype of the interaction and policy model, not a production identity wallet.

### Creativity & Ambition

WEAVE treats an app as a temporary projection of user intent. A typed `WorkspaceManifest` safely generates the Canvas without executing model-generated JavaScript or HTML. The Global Passport stays private while a task-scoped Mini Passport supports three deliberate modes: reveal a value, use a value without revealing it, or prove a predicate.

The memorable primitive is sealed use: a sensitive synthetic passport claim is resolved only at provider execution time through an opaque handle. The agent-visible result reports successful private use, never the raw credential. When the human revokes the grant, the same operation stops working immediately. Apps are temporary. Your identity is not.

## 60-second judge test

Use Chrome with `chrome://flags/#enable-webmcp-testing` enabled, or the supported deployed browser target. No account creation is required.

1. Open <https://weave-webmcp-kpsr01.vercel.app> and click **Reset demo**.
2. Ask the agent to list available Passport claims. Confirm it receives descriptors only, never values.
3. Ask: **“Set me up to live in Tokyo.”** Confirm the Canvas contains housing, bank, and civic sections.
4. Ask the agent to personalize the workspace. In the consent sheet, deselect one requested claim, keep the purpose/audience narrow, and approve.
5. Approve a second bank request in **Use (no reveal)** mode. Confirm the bank application result reports private claim use without a raw credential.
6. Click **Revoke** for the bank grant and retry the protected action. Confirm `GRANT_REVOKED`; confirm the Canvas remains present.

For a lower-level inspection, the live origin exposes these WEAVE tools: `weave_list_passport_claims`, `weave_compose_workspace`, `weave_request_passport_grant`, `weave_list_active_grants`, `weave_read_granted_claim`, and `weave_start_bank_application`. The three provider origins expose six additional tools listed in [WEBMCP_TOOL_STRATEGY.md](WEBMCP_TOOL_STRATEGY.md).

## Narrated demo beats

The released MP4 is a 1440×900 narrated recording measured at **2:48.75**, below the three-minute gate.

- **0:00–0:20 — Descriptors:** synthetic claims are visible; the agent sees names and metadata, not values.
- **0:20–0:50 — Composition:** live tools from HomeTokyo, SakuraBank, and Tokyo CityDesk become one Tokyo Life Setup Canvas.
- **0:50–1:20 — Minimized consent:** the agent requests housing context; the human removes the unnecessary budget claim and approves a short reveal grant.
- **1:20–1:55 — Sealed use:** the human approves a bank `use` grant; the application starts with an opaque handle and no raw credential in the result.
- **1:55–2:30 — Revocation:** the human revokes the bank grant; retrying the same operation returns `GRANT_REVOKED` while the Canvas stays usable.
- **2:30–2:48 — Closing:** typed manifests, origin-scoped exposure, `toolchange`, annotations, and the privacy thesis.

## Final production smoke record

The final smoke test was run after the Phase 5 deployment freeze against the public origins:

- Native Chrome WebMCP mode exposed **12 tools across four origins**.
- `weave_list_passport_claims` returned claim descriptors only; no synthetic claim value appeared in the result.
- `weave_compose_workspace` created the Tokyo workspace.
- Live `housing_search` and `civic_get_requirements` calls returned provider results.
- Human-edited reveal consent created a reduced-scope grant.
- Human-approved sealed `use` consent started the simulated bank application through `bank_start_application`; the result contained `claimUsed` and `privacy: claim_used_without_reveal`, not the credential.
- Revoking that grant made the same protected operation fail deterministically with `GRANT_REVOKED`.
- A browser without WebMCP reported **WebMCP needs a supported browser**.
- `GET /` returned the exact production policy: `tools=(self "https://weave-housing-kpsr01.vercel.app" "https://weave-bank-kpsr01.vercel.app" "https://weave-civic-kpsr01.vercel.app")`.
- The canonical flow produced no browser page errors in the smoke session.

The deterministic structural baseline remains reproducible with `pnpm test:evals`; the full repository gates are documented in the root [README](../README.md).
