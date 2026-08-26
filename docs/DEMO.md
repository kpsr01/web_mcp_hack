# Demo & Submission Plan

The public demo video must stay under three minutes. The goal is not to explain every feature; it is to make judges understand the new web primitive immediately.

## Canonical 2:45 storyboard

### 0:00–0:15 — Thesis

Show Global Passport with synthetic values.

Narration concept: “My agent doesn't own this profile. It can only see which kinds of claims exist.”

Ask the agent what it knows; show descriptors only.

### 0:15–0:40 — Open web composition

Show three independent provider sites / origins and their WebMCP tools.

Prompt: “Set me up to live in Tokyo.”

Agent discovers tools and calls `weave_compose_workspace`.

Animate provider capabilities becoming one Canvas.

### 0:40–1:15 — Mini Passport

Agent needs budget + preferences.

Consent sheet appears. Human removes one unnecessary claim, sets duration to task-only, approves.

Canvas personalizes.

### 1:15–1:50 — Progressive disclosure

Agent starts an application. A second request asks for more sensitive identity/credential claims.

Use a sensitive claim in **Use without reveal** mode. Make it visually explicit that the raw value never appears in the agent-visible output.

### 1:50–2:10 — Human control

Human revokes the Mini Passport.

Protected agent action fails. Canvas remains usable by the human.

### 2:10–2:30 — Technical credibility

Flash:

- `document.modelContext.registerTool`
- `exposedTo`
- Capability Graph / `toolchange`
- annotations
- eval results

### 2:30–2:45 — Closing thesis

“WebMCP lets sites expose capabilities. WEAVE asks what happens when those capabilities assemble around intent while identity stays under the user's control. Apps are temporary. Your identity is not.”

## Submission description structure

Use four short sections matching judge vocabulary exactly:

1. **WebMCP Leverage** — cross-origin tools, discovery, lifecycle, shared state, annotations, evals.
2. **Execution** — live coherent workflow, graceful unsupported state, deterministic reset.
3. **Potential Impact** — privacy/delegation problem for cross-site browser agents.
4. **Creativity & Ambition** — ephemeral generated apps + agent-blind Passport + sealed use.

## Judge test path

README should eventually include a 60-second manual test:

1. Open live WEAVE URL in supported browser.
2. Reset demo.
3. Ask agent to list available Passport claims.
4. Ask it to create Tokyo setup workspace.
5. Ask it to personalize workspace.
6. Approve Mini Passport.
7. Revoke and retry a protected action.

No account creation should be required for judges.
