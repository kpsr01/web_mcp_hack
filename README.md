# WEAVE

**The intent-native web: temporary apps assembled from WebMCP capabilities, with user-controlled Passport delegation.**

WEAVE is an OpenAI WebMCP Challenge project exploring a different model for the open web: websites expose capabilities, an agent composes those capabilities into a task-specific interface for the human, and a private Passport controls which personal claims may be used for that task.

The global Passport is **not agent memory**. The agent initially sees only claim descriptors such as `identity.full_name` or `preferences.diet`, never their values. When a task needs personal context, the agent requests a scoped Mini Passport. The human chooses what to grant, how it may be used, and for how long.

## Demo thesis

> Apps are temporary. Your identity is not.

For the primary demo, the user asks WEAVE to help them **set up life in Tokyo**. Independent Housing, Bank, and Civic websites expose real WebMCP tools from separate origins. The agent composes a single temporary workspace, requests only the Passport claims required at each step, and the human can approve, deny, limit, or revoke those grants.

## Core principles

1. **Private by default** — Passport values are hidden until explicitly granted.
2. **Progressive disclosure** — planning should need less data than applications or transactions.
3. **Scoped delegation** — every grant has what/who/why/mode/duration.
4. **Shared live state** — human UI and agent tools operate on the same task state.
5. **Capability composition** — provider sites remain independent; WEAVE composes their WebMCP capabilities.
6. **Safe generated UI** — agents create a typed `WorkspaceManifest`, not arbitrary executable frontend code.

## Repository layout

```text
apps/
  weave/       Main WEAVE Canvas + Passport consent surface
  provider/    One provider app deployed as multiple origins (housing/bank/civic)
packages/
  protocol/    Shared manifests, claims, grants, capability types
  passport/    Demo Passport descriptors/values + grant helpers
  webmcp/      Thin typed wrapper around the experimental WebMCP API
docs/
  PRODUCT.md
  ARCHITECTURE.md
  ROADMAP.md
  PASSPORT_PROTOCOL.md
  WEBMCP_TOOL_STRATEGY.md
  SECURITY.md
  EVALS.md
  DEMO.md
```

## Local development

Prerequisites:

- Node.js 22+
- pnpm 10+
- Chrome with `chrome://flags/#enable-webmcp-testing` enabled, or ChatGPT's built-in browser for deployed testing

```bash
pnpm install
pnpm dev
```

Local origins:

- WEAVE: `http://localhost:3000`
- Housing provider: `http://localhost:3101`
- Bank provider: `http://localhost:3102`
- Civic provider: `http://localhost:3103`

The provider apps are deliberately separate origins. Each registers WebMCP tools with `exposedTo: [WEAVE_ORIGIN]`; WEAVE embeds them with the `tools` permission so cross-origin capability discovery can be exercised.

## Current phase

The repository is initialized for **Phase 0 / Phase 1**. The scaffold includes typed WebMCP registration, provider simulators, Passport claim metadata, grant-request UI, and a typed workspace manifest. See [docs/ROADMAP.md](docs/ROADMAP.md) for acceptance tests before moving between phases.

## Hackathon constraints baked into the plan

- Working public live URL
- Public source repository
- Open-source license
- Real `document.modelContext.registerTool(...)` implementation
- Sub-3-minute narrated demo
- Tested in ChatGPT's built-in browser and Chrome WebMCP mode
- Evals covering tool choice, parameters, sequencing, privacy, and recovery

## Source material

- https://openai.com/webmcp-challenge/
- https://webmcp.devpost.com/
- https://webmachinelearning.github.io/webmcp/
- https://developer.chrome.com/docs/ai/webmcp
- https://developer.chrome.com/docs/ai/webmcp/best-practices
- https://developer.chrome.com/docs/ai/webmcp/secure-tools
- https://developer.chrome.com/docs/ai/webmcp/evals
- https://learn.chatgpt.com/docs/webmcp

## License

MIT. See [LICENSE](LICENSE).
