# Architecture

## System view

```text
                         HUMAN
                           |
                           v
+----------------------------------------------------+
|                    WEAVE ORIGIN                    |
|                                                    |
|  Canvas <---- WorkspaceManifest                    |
|    |               ^                               |
|    |               | compose_workspace             |
|    v               |                               |
| Task State <---- WebMCP tools <---- AGENT          |
|    |                         |                      |
|    |                         | claim descriptors    |
|    v                         v                      |
| Passport Vault ----> Grant Broker                  |
|   values private       |                            |
|                        | Mini Passport              |
+------------------------+----------------------------+
                         |
                  capability graph
          +--------------+--------------+
          |              |              |
          v              v              v
     Housing origin   Bank origin    Civic origin
       WebMCP tools    WebMCP tools    WebMCP tools
```

## Deployment topology

Development uses four origins:

- WEAVE `localhost:3000`
- Housing `localhost:3101`
- Bank `localhost:3102`
- Civic `localhost:3103`

`apps/provider` is one codebase run/deployed three times with different `VITE_PROVIDER_KIND` values. This proves that composition is based on WebMCP capability exposure rather than hard-coded same-origin function imports.

## Cross-origin WebMCP

Provider tools register with:

```ts
await document.modelContext.registerTool(tool, {
  exposedTo: [WEAVE_ORIGIN],
  signal,
});
```

WEAVE embeds provider pages with `allow="tools"`. The top-level deployment must configure the `tools` Permissions Policy for the exact provider origins. Local Vite configuration supplies development headers; production headers must be updated once final domains are known.

The current WebMCP draft defines `exposedTo`, origin-filtered `getTools({ fromOrigins })`, `toolchange`, `readOnlyHint`, `untrustedContentHint`, and abort signals. Do not invent unsupported browser APIs.

## Safe app generation

The agent does not write React components. It calls `weave_compose_workspace` with a typed manifest:

```ts
interface WorkspaceManifest {
  id: string;
  title: string;
  goal: string;
  sections: WorkspaceSection[];
}
```

WEAVE maps manifest sections to trusted components. This preserves the “generated app” experience without executing arbitrary model output.

## Passport boundaries

Three conceptual planes must stay separate:

### Descriptor plane

Visible to the agent by default:

```text
identity.full_name
identity.nationality
preferences.diet
```

No values.

### Grant plane

Visible after user consent:

```text
grant id
claim ids
mode
purpose
scope
expiry
```

### Value plane

Actual claim values. Values remain inside the Passport implementation unless a grant mode explicitly permits disclosure.

Phase 2 supports `reveal`. Phase 3 adds sealed `use` and predicate-style `prove` so an agent can trigger a provider action without necessarily seeing the raw value.

## Capability graph

WEAVE should maintain a normalized graph derived from `getTools()` / `toolchange` rather than a static list. Each capability records origin, tool name, title, annotations, and schema summary.

The UI should make this graph inspectable in a developer/debug panel during the demo. That is evidence of non-trivial WebMCP leverage.

## State model

Canonical state lives in the page/application, not in agent prose:

- Workspace manifest
- Provider state
- Active grants
- Pending consent request
- Audit trail

Every WebMCP mutation must update visible state before returning a success result where practical.

## Future production architecture

The prototype Passport stores synthetic values in-browser. A production design would move secrets/credentials into a hardened local wallet/browser/OS facility and issue opaque capability handles or attestations. Do not present the demo vault as production-grade security.
