import { useEffect, useMemo, useRef, useState } from "react";
import { authorizeOpaqueClaim, createGrant, demoClaimDescriptors, issueOpaqueClaimHandles, isGrantActive, readGrantedClaim, resetDemoPassport } from "@weave/passport";
import type { OpaqueClaimHandle } from "@weave/passport";
import type { ClaimPredicate, GrantRequest, MiniPassportGrant, ProviderKind, WorkspaceManifest } from "@weave/protocol";
import { executeWebMCPTool, getWebMCPTools, hasWebMCP, registerWebMCPTool, subscribeWebMCPToolChanges } from "@weave/webmcp";
import type { RegisteredWebMCPTool } from "@weave/webmcp";
import { createWorkspaceManifest, summarizeProviderResult } from "./contracts";

const providerOrigins = {
  housing: import.meta.env.VITE_HOUSING_ORIGIN ?? "http://localhost:3101",
  bank: import.meta.env.VITE_BANK_ORIGIN ?? "http://localhost:3102",
  civic: import.meta.env.VITE_CIVIC_ORIGIN ?? "http://localhost:3103",
};
const weaveOrigin = import.meta.env.VITE_WEAVE_ORIGIN ?? (typeof window === "undefined" ? "http://localhost:3000" : window.location.origin);
const capabilityOrigins = [
  { label: "WEAVE", origin: weaveOrigin },
  { label: "HOUSING", origin: providerOrigins.housing },
  { label: "BANK", origin: providerOrigins.bank },
  { label: "CIVIC", origin: providerOrigins.civic },
];

type DiscoveryState = "loading" | "ready" | "unsupported" | "error";
type GrantResolver = (result: Record<string, unknown>) => void;

function schemaParameterNames(tool: RegisteredWebMCPTool): string {
  let schema = tool.inputSchema;
  if (typeof schema === "string") {
    try {
      schema = JSON.parse(schema) as Record<string, unknown>;
    } catch {
      return "No parameters";
    }
  }
  const properties = schema?.properties;
  if (!properties || typeof properties !== "object") return "No parameters";
  const names = Object.keys(properties);
  return names.length ? names.join(", ") : "No parameters";
}

function isGrantMode(value: unknown): value is GrantRequest["mode"] {
  return value === "reveal" || value === "use" || value === "prove";
}

function grantRequestValidationMessage(request: GrantRequest): string | null {
  if (!request.claimIds.length) return "Select at least one claim.";
  if (!request.purpose.trim()) return "Add a purpose so the human can assess this request.";
  if (!request.audience.trim()) return "Add an audience scope before approving.";
  if (!isGrantMode(request.mode)) return "Choose a valid grant mode.";
  if (!Number.isInteger(request.durationSeconds) || request.durationSeconds < 30 || request.durationSeconds > 3600) {
    return "Choose a duration between 30 and 3600 seconds.";
  }
  const unsupportedClaims = demoClaimDescriptors.filter((claim) =>
    request.claimIds.includes(claim.id) && !claim.allowedModes.includes(request.mode),
  );
  return unsupportedClaims.length
    ? `${unsupportedClaims.map((claim) => claim.label).join(", ")} cannot be shared in ${request.mode} mode.`
    : null;
}

function canApproveRequest(request: GrantRequest): boolean {
  return grantRequestValidationMessage(request) === null;
}

function normalizePredicate(value: unknown): ClaimPredicate | undefined {
  if (!value || typeof value !== "object" || Array.isArray(value)) return undefined;
  const candidate = value as Record<string, unknown>;
  if (candidate.kind === "present") return { kind: "present" };
  if ((candidate.kind === "ageAtLeast" || candidate.kind === "numberAtLeast")
    && typeof candidate.value === "number"
    && Number.isFinite(candidate.value)
    && candidate.value >= 0) {
    return { kind: candidate.kind, value: candidate.value };
  }
  return undefined;
}

function grantModeLabel(mode: MiniPassportGrant["mode"]): string {
  if (mode === "reveal") return "REVEAL · agent sees value";
  if (mode === "use") return "USE · no reveal";
  return "PROVE · predicate only";
}


function updatePendingClaim(request: GrantRequest, claimId: string): GrantRequest {
  const claimIds = request.claimIds.includes(claimId)
    ? request.claimIds.filter((id) => id !== claimId)
    : [...request.claimIds, claimId];
  return { ...request, claimIds };
}

export function App() {
  const [workspace, setWorkspace] = useState<WorkspaceManifest | null>(null);
  const [capabilities, setCapabilities] = useState<RegisteredWebMCPTool[]>([]);
  const [discoveryState, setDiscoveryState] = useState<DiscoveryState>(hasWebMCP() ? "loading" : "unsupported");
  const [discoveryError, setDiscoveryError] = useState<string | null>(null);
  const [pendingRequest, setPendingRequest] = useState<GrantRequest | null>(null);
  const [grants, setGrants] = useState<MiniPassportGrant[]>([]);
  const [audit, setAudit] = useState<string[]>([]);
  const [canvasRevision, setCanvasRevision] = useState(0);
  const resolverRef = useRef<GrantResolver | null>(null);
  const workspaceRef = useRef<WorkspaceManifest | null>(workspace);
  const capabilityRefreshRef = useRef<(() => void) | null>(null);
  const grantsRef = useRef(grants);
  const opaqueHandlesRef = useRef<OpaqueClaimHandle[]>([]);
  const consentRef = useRef<HTMLDialogElement | null>(null);
  const requestedClaimIdsRef = useRef<string[]>([]);

  useEffect(() => { workspaceRef.current = workspace; }, [workspace]);
  useEffect(() => {
    const dialog = consentRef.current;
    if (!dialog || !pendingRequest) return;
    if (!dialog.open) dialog.showModal();
    dialog.querySelector<HTMLInputElement>("input[type='checkbox']")?.focus();
    return () => {
      if (dialog.open) dialog.close();
    };
  }, [pendingRequest?.requestId]);

  useEffect(() => {
    const providersByOrigin = new Map<string, ProviderKind>(
      Object.entries(providerOrigins).map(([kind, origin]) => [origin, kind as ProviderKind]),
    );
    const respond = (event: MessageEvent, requestId: string, result: Record<string, unknown>) => {
      (event.source as Window).postMessage({
        type: "weave-passport-authorization-result",
        requestId,
        ...result,
      }, event.origin);
    };
    const onMessage = (event: MessageEvent) => {
      const providerKind = providersByOrigin.get(event.origin);
      if (!providerKind || !event.source || !event.data || typeof event.data !== "object") return;
      const request = event.data as Record<string, unknown>;
      if (request.type !== "weave-passport-authorize" || typeof request.requestId !== "string" || typeof request.claimHandle !== "string") return;
      if (request.audience !== providerKind || (request.mode !== "use" && request.mode !== "prove")) {
        respond(event, request.requestId, { status: "error", code: "GRANT_SCOPE_VIOLATION" });
        return;
      }
      const predicate = request.predicate === undefined ? undefined : normalizePredicate(request.predicate);
      if (request.predicate !== undefined && !predicate) {
        respond(event, request.requestId, { status: "error", code: "INVALID_PREDICATE" });
        return;
      }
      const authorization = authorizeOpaqueClaim(
        grantsRef.current,
        opaqueHandlesRef.current,
        {
          handleId: request.claimHandle,
          audience: providerKind,
          mode: request.mode,
          predicate,
        },
      );
      if (authorization.status === "error") {
        setAudit((items) => [`Provider authorization blocked: ${authorization.code}`, ...items]);
        respond(event, request.requestId, authorization);
        return;
      }
      setAudit((items) => [`Provider authorized ${providerKind} ${request.mode} access (${authorization.claimId})`, ...items]);
      respond(event, request.requestId, authorization);
    };
    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, []);

  useEffect(() => {
    if (!hasWebMCP()) {
      setDiscoveryState("unsupported");
      return;
    }

    let alive = true;
    let requestId = 0;
    const refreshCapabilities = async () => {
      const currentRequest = ++requestId;
      try {
        const tools = await getWebMCPTools(Object.values(providerOrigins));
        if (!alive || currentRequest !== requestId) return;
        setCapabilities(tools);
        setDiscoveryError(null);
        setDiscoveryState("ready");
      } catch (error) {
        if (!alive || currentRequest !== requestId) return;
        setDiscoveryError(String(error));
        setDiscoveryState("error");
      }
    };
    capabilityRefreshRef.current = () => { void refreshCapabilities(); };
    const unsubscribe = subscribeWebMCPToolChanges(() => { void refreshCapabilities(); });
    void refreshCapabilities();
    return () => {
      alive = false;
      capabilityRefreshRef.current = null;
      unsubscribe();
    };
  }, []);

  useEffect(() => {
    const cleanups = [
      registerWebMCPTool({
        name: "weave_list_passport_claims",
        title: "List Passport claims",
        description: "Lists Passport claim descriptors available to request. Returns names and metadata only, never private claim values.",
        inputSchema: { type: "object", properties: {}, additionalProperties: false },
        annotations: { readOnlyHint: true },
        execute: async () => ({ claims: demoClaimDescriptors }),
      }),
      registerWebMCPTool({
        name: "weave_compose_workspace",
        title: "Compose WEAVE workspace",
        description: "Creates or replaces the human-facing temporary workspace for the user's current goal using safe typed sections.",
        inputSchema: {
          type: "object",
          required: ["title", "goal", "sections"],
          properties: {
            title: { type: "string", description: "Short workspace title." },
            goal: { type: "string", description: "The user's task goal." },
            summary: { type: "string", description: "Optional concise plan summary." },
            constraints: {
              type: "array",
              minItems: 1,
              maxItems: 8,
              items: {
                type: "object",
                required: ["id", "label", "type", "value"],
                properties: {
                  id: { type: "string" },
                  label: { type: "string" },
                  type: { type: "string", enum: ["text", "number", "boolean"] },
                  value: { type: ["string", "number", "boolean"] },
                  unit: { type: "string" },
                },
                additionalProperties: false,
              },
            },
            sections: {
              type: "array",
              minItems: 1,
              maxItems: 8,
              items: {
                type: "object",
                required: ["title", "description", "provider"],
                properties: {
                  title: { type: "string" },
                  description: { type: "string" },
                  provider: { type: "string", enum: ["housing", "bank", "civic", "passport", "overview"] },
                  status: { type: "string", enum: ["idle", "ready", "blocked", "complete"] },
                },
                additionalProperties: false,
              },
            },
          },
          additionalProperties: false,
        },
        execute: async (input) => {
          const current = workspaceRef.current;
          const manifest = createWorkspaceManifest(input, current);
          if (!manifest) return { status: "rejected", code: "INVALID_WORKSPACE_MANIFEST" };
          workspaceRef.current = manifest;
          setWorkspace(manifest);
          setCanvasRevision((revision) => revision + 1);
          setAudit((items) => [`Workspace composed: ${manifest.title}`, ...items]);
          return { status: "created", workspaceId: manifest.id, sectionCount: manifest.sections.length, constraints: manifest.constraints };
        },
      }),
      registerWebMCPTool({
        name: "weave_request_passport_grant",
        title: "Request Mini Passport",
        description: "Requests scoped access to selected Passport claims. Opens a visible consent UI and waits for the human to approve or deny.",
        inputSchema: {
          type: "object",
          required: ["claimIds", "purpose", "audience", "mode", "durationSeconds"],
          properties: {
            claimIds: { type: "array", minItems: 1, items: { type: "string" } },
            purpose: { type: "string", description: "Why these claims are needed now." },
            audience: { type: "string", description: "Task/provider scope for this grant." },
            mode: { type: "string", enum: ["reveal", "use", "prove"] },
            durationSeconds: { type: "integer", minimum: 30, maximum: 3600 },
          },
          additionalProperties: false,
        },
        execute: async (input) => {
          if (resolverRef.current) return { status: "busy", code: "CONSENT_ALREADY_PENDING" };
          const requestedIds = Array.isArray(input.claimIds) ? Array.from(new Set(input.claimIds.map(String))) : [];
          const validIds = requestedIds.filter((id) => demoClaimDescriptors.some((claim) => claim.id === id));
          if (!requestedIds.length || validIds.length !== requestedIds.length) return { status: "rejected", code: "UNKNOWN_CLAIMS" };

          const request: GrantRequest = {
            requestId: `request_${crypto.randomUUID()}`,
            claimIds: validIds,
            purpose: String(input.purpose ?? "").trim(),
            audience: String(input.audience ?? "").trim(),
            mode: input.mode as GrantRequest["mode"],
            durationSeconds: Number(input.durationSeconds),
          };
          if (grantRequestValidationMessage(request)) return { status: "rejected", code: "INVALID_GRANT_REQUEST" };
          requestedClaimIdsRef.current = validIds;
          setPendingRequest(request);
          setAudit((items) => [`Consent requested: ${validIds.join(", ")}`, ...items]);
          return new Promise<Record<string, unknown>>((resolve) => { resolverRef.current = resolve; });
        },
      }),
      registerWebMCPTool({
        name: "weave_start_bank_application",
        title: "Start bank application privately",
        description: "Starts the bank application with a scoped Passport use handle or proof predicate. Raw claim values never return to the agent.",
        inputSchema: {
          type: "object",
          required: ["accountId", "claimHandle", "mode"],
          properties: {
            accountId: { type: "string" },
            claimHandle: { type: "string", description: "Opaque handle from an approved use or prove grant." },
            mode: { type: "string", enum: ["use", "prove"] },
            predicate: {
              type: "object",
              required: ["kind"],
              properties: {
                kind: { type: "string", enum: ["ageAtLeast", "numberAtLeast", "present"] },
                value: { type: "number" },
              },
              additionalProperties: false,
            },
          },
          additionalProperties: false,
        },
        execute: async (input) => {
          const mode = input.mode === "use" || input.mode === "prove" ? input.mode : null;
          const claimHandle = typeof input.claimHandle === "string" ? input.claimHandle : "";
          const accountId = typeof input.accountId === "string" ? input.accountId : "";
          if (!mode || !claimHandle || !accountId) return { status: "error", code: "INVALID_SEALED_REQUEST" };
          const predicate = input.predicate === undefined ? undefined : normalizePredicate(input.predicate);
          if ((input.predicate !== undefined && !predicate) || (mode === "prove" && !predicate)) {
            return { status: "error", code: "INVALID_PREDICATE" };
          }

          const authorization = authorizeOpaqueClaim(
            grantsRef.current,
            opaqueHandlesRef.current,
            { handleId: claimHandle, audience: "bank", mode, predicate },
          );
          if (authorization.status === "error") {
            setAudit((items) => [`Bank application blocked: ${authorization.code}`, ...items]);
            return authorization;
          }
          const expectedClaim = mode === "use" ? "credentials.passport_number" : "identity.date_of_birth";
          if (authorization.claimId !== expectedClaim) {
            setAudit((items) => ["Bank application blocked: claim outside action scope", ...items]);
            return { status: "error", code: "GRANT_SCOPE_VIOLATION" };
          }

          try {
            const tools = await getWebMCPTools([providerOrigins.bank]);
            const providerTool = tools.find((tool) => tool.name === "bank_start_application" && tool.origin === providerOrigins.bank);
            if (!providerTool) {
              setAudit((items) => ["Bank application blocked: stale provider capability", ...items]);
              return { status: "error", code: "STALE_CAPABILITY" };
            }
            const result = await executeWebMCPTool(providerTool, {
              accountId,
              claimHandle,
              accessMode: mode,
              ...(predicate ? { predicate } : {}),
            });
            const summary = summarizeProviderResult(result);
            if (summary.status === "error") {
              setAudit((items) => [`Bank application blocked: ${String(summary.code ?? "PROVIDER_REJECTED")}`, ...items]);
              return summary;
            }
            setAudit((items) => [`Bank application started privately (${grantModeLabel(mode)})`, ...items]);
            return { provider: "bank", tool: providerTool.name, ...summary };
          } catch {
            setAudit((items) => ["Bank application blocked: provider unavailable", ...items]);
            return { status: "error", code: "PROVIDER_UNAVAILABLE" };
          }
        },
      }),
      registerWebMCPTool({
        name: "weave_list_active_grants",
        title: "List active Mini Passports",
        description: "Lists active grant metadata only. Does not return Passport values.",
        inputSchema: { type: "object", properties: {}, additionalProperties: false },
        annotations: { readOnlyHint: true },
        execute: async () => ({ grants: grantsRef.current.filter((grant) => isGrantActive(grant)) }),
      }),
      registerWebMCPTool({
        name: "weave_read_granted_claim",
        title: "Read revealed Passport claim",
        description: "Reads one claim only when an active Mini Passport explicitly grants that claim in reveal mode.",
        inputSchema: {
          type: "object",
          required: ["grantId", "claimId", "audience"],
          properties: {
            grantId: { type: "string" },
            claimId: { type: "string" },
            audience: { type: "string", description: "Audience named in the active grant." },
          },
          additionalProperties: false,
        },
        annotations: { readOnlyHint: true },
        execute: async (input) => readGrantedClaim(grantsRef.current, {
          grantId: String(input.grantId),
          claimId: String(input.claimId),
          audience: String(input.audience),
        }),
      }),
    ];
    return () => cleanups.forEach((cleanup) => cleanup());
  }, []);

  const capabilityGroups = useMemo(() => {
    const groups = capabilityOrigins.map((item) => ({ ...item, tools: [] as RegisteredWebMCPTool[] }));
    const byOrigin = new Map(groups.map((group) => [group.origin, group]));
    capabilities.forEach((tool) => {
      const origin = tool.origin ?? "unknown";
      const group = byOrigin.get(origin);
      if (group) {
        group.tools.push(tool);
      } else {
        const other = { label: "OTHER ORIGIN", origin, tools: [tool] };
        groups.push(other);
        byOrigin.set(origin, other);
      }
    });
    return groups;
  }, [capabilities]);

  const activeGrants = useMemo(() => grants.filter((grant) => isGrantActive(grant)), [grants]);
  const consentIssue = pendingRequest ? grantRequestValidationMessage(pendingRequest) : null;

  function updateConstraint(id: string, value: string | number | boolean) {
    const current = workspaceRef.current;
    const constraint = current?.constraints?.find((item) => item.id === id);
    if (!current || !constraint) return;
    const next = {
      ...current,
      constraints: current.constraints?.map((item) => item.id === id ? { ...item, value } : item),
    };
    workspaceRef.current = next;
    setWorkspace(next);
    setAudit((items) => [`Human constraint updated: ${constraint.label}`, ...items]);
  }

  function approveRequest() {
    if (!pendingRequest || !resolverRef.current || !canApproveRequest(pendingRequest)) return;
    const grant = createGrant(pendingRequest);
    const handles = grant.mode === "reveal" ? [] : issueOpaqueClaimHandles(grant);
    opaqueHandlesRef.current = [...opaqueHandlesRef.current, ...handles];
    const nextGrants = [grant, ...grantsRef.current];
    grantsRef.current = nextGrants;
    setGrants(nextGrants);
    setAudit((items) => [`Mini Passport approved: ${grant.grantId}`, ...items]);
    resolverRef.current({
      status: "approved",
      ...grant,
      ...(handles.length ? { claimHandles: handles.map((handle) => handle.handleId) } : {}),
    });
    resolverRef.current = null;
    requestedClaimIdsRef.current = [];
    setPendingRequest(null);
  }

  function denyRequest() {
    if (!pendingRequest || !resolverRef.current) return;
    setAudit((items) => [`Consent denied: ${pendingRequest.claimIds.join(", ")}`, ...items]);
    resolverRef.current({ status: "denied", requestId: pendingRequest.requestId });
    resolverRef.current = null;
    requestedClaimIdsRef.current = [];
    setPendingRequest(null);
  }

  function revokeGrant(grantId: string) {
    const nextGrants = grantsRef.current.map((grant) => grant.grantId === grantId ? { ...grant, revokedAt: new Date().toISOString() } : grant);
    grantsRef.current = nextGrants;
    setGrants(nextGrants);
    setAudit((items) => [`Mini Passport revoked: ${grantId}`, ...items]);
  }
  function resetDemo() {
    if (resolverRef.current && pendingRequest) {
      resolverRef.current({ status: "denied", requestId: pendingRequest.requestId, code: "DEMO_RESET" });
      resolverRef.current = null;
    }
    resetDemoPassport();
    window.location.reload();
  }

  return (
    <>
      <main>
      <header className="topbar">
        <div><span className="eyebrow">WEBMCP CHALLENGE</span><h1>WEAVE</h1><p className="demoIdentity">Synthetic demo identity · 7 private claims</p></div>
        <div className="topbarActions">
          <div className={`status ${hasWebMCP() ? "ok" : "warn"}`} role="status" aria-live="polite">{hasWebMCP() ? "WebMCP available" : "WebMCP needs a supported browser"}</div>
          <button className="resetButton" type="button" onClick={resetDemo}>Reset demo</button>
        </div>
      </header>

      <section className="hero">
        <p className="eyebrow">THE INTENT-NATIVE WEB</p>
        <h2>Apps are temporary.<br />Your identity is not.</h2>
        <p>Independent websites expose capabilities. Your agent composes a task app. Passport decides what personal context it may use.</p>
      </section>

      <div className="grid">
        <section className="panel passport">
          <div className="panelHead"><div><span className="eyebrow">GLOBAL PASSPORT</span><h3>Private claims</h3></div><span className="pill">values hidden from agent</span></div>
          <div className="claims">{demoClaimDescriptors.map((claim) => <div className="claim" key={claim.id}><div><strong>{claim.label}</strong><small>{claim.id}</small></div><span>{claim.sensitivity}</span></div>)}</div>
        </section>

        <section className={`panel canvas ${workspace ? "canvasReady" : ""}`} key={canvasRevision}>
          <div className="panelHead"><div><span className="eyebrow">WEAVE CANVAS</span><h3>{workspace?.title ?? "No temporary app yet"}</h3></div><span className="pill">agent-generated manifest</span></div>
          {workspace ? <>
            <p className="goal">{workspace.goal}</p>
            <div className="sections">{workspace.sections.map((section) => <article key={section.id}><span>{section.provider}</span><h4>{section.title}</h4><p>{section.description}</p><small>{section.status ?? "idle"}</small></article>)}</div>
            {workspace.constraints?.length ? <fieldset className="constraints" data-testid="canvas-constraints">
              <legend><span>Task constraints</span><small>human-controlled state</small></legend>
              <div className="constraintList">{workspace.constraints.map((constraint) => {
                const inputId = `constraint-${constraint.id}`;
                return <div className="constraint" key={constraint.id}>
                  <label htmlFor={inputId}><strong>{constraint.label}</strong><small>{constraint.unit ?? constraint.type}</small></label>
                  <div className="constraintValue">
                    {constraint.type === "boolean"
                      ? <input id={inputId} type="checkbox" checked={constraint.value === true} onChange={(event) => updateConstraint(constraint.id, event.target.checked)} />
                      : <><input id={inputId} type={constraint.type === "number" ? "number" : "text"} value={String(constraint.value)} onChange={(event) => updateConstraint(constraint.id, constraint.type === "number" ? Number(event.target.value) : event.target.value)} />{constraint.unit && <span>{constraint.unit}</span>}</>}
                  </div>
                </div>;
              })}</div>
            </fieldset> : null}
          </> : <div className="empty">Ask your agent to compose a workspace from the available WebMCP capabilities.</div>}
        </section>
      </div>

      <section className="panel capabilityPanel" data-testid="capability-graph">
        <div className="panelHead">
          <div><span className="eyebrow">CAPABILITY GRAPH</span><h3>Live web capabilities</h3></div>
          <span className={`pill graphStatus ${discoveryState}`} data-testid="capability-count">
            {discoveryState === "loading" ? "Discovering…" : discoveryState === "ready" ? `${capabilities.length} tools live` : discoveryState === "error" ? "Discovery error" : "WebMCP unavailable"}
          </span>
        </div>
        <p className="graphIntro">Normalized from <code>getTools({"{ fromOrigins }"})</code> and refreshed on <code>toolchange</code>.</p>
        {discoveryError && <p className="graphError">{discoveryError}</p>}
        {discoveryState === "unsupported" && <aside className="browserHelp" aria-labelledby="browser-help-title">
          <strong id="browser-help-title">Turn on WebMCP to run the live demo</strong>
          <p>Use ChatGPT’s built-in browser, or Chrome with WebMCP testing enabled, then reload this page.</p>
          <ol>
            <li>Open this URL in one of those supported browsers.</li>
            <li>Reload until the status shows live tools.</li>
          </ol>
          <code>Chrome flag: --enable-features=WebMCP</code>
        </aside>}
        <div className="capabilityGroups">
          {capabilityGroups.map((group) => <article className="capabilityGroup" key={group.origin} data-origin={group.origin}>
            <div className="originHead">
              <div className="originIdentity"><span className="originMark" aria-hidden="true" /><div><strong>{group.label}</strong><code>{group.origin}</code></div></div>
              <span className="originCount">{group.tools.length} {group.tools.length === 1 ? "tool" : "tools"}</span>
            </div>
            {group.tools.length ? <div className="capabilityList">{group.tools.map((tool) => <div className="capability" key={`${group.origin}-${tool.name}`}>
              <div className="capabilityTitle"><code>{tool.name}</code><span>{tool.annotations?.readOnlyHint ? "READ ONLY" : "ACTION"}</span></div>
              <strong>{tool.title ?? tool.name}</strong>
              <p>{tool.description}</p>
              <small>Inputs: {schemaParameterNames(tool)}</small>
            </div>)}</div> : <p className="graphEmpty">{discoveryState === "unsupported" ? "WebMCP is unavailable in this browser." : "Waiting for this origin to expose tools…"}</p>}
          </article>)}
        </div>
      </section>

      <section className="panel providers">
        <div className="panelHead"><div><span className="eyebrow">INDEPENDENT ORIGINS</span><h3>Capability providers</h3></div><span className="pill">iframe allow="tools"</span></div>
        <div className="frames">
          {Object.entries(providerOrigins).map(([name, origin]) => <iframe key={name} title={`${name} provider`} src={origin} allow="tools" onLoad={() => capabilityRefreshRef.current?.()} />)}
        </div>
      </section>

      <div className="grid lower">
        <section className="panel">
          <div className="panelHead"><div><span className="eyebrow">MINI PASSPORTS</span><h3>Active grants</h3></div></div>
          {activeGrants.length ? activeGrants.map((grant) => <div className="grant" key={grant.grantId}><div><strong>{grantModeLabel(grant.mode)} · {grant.audience}</strong><small>{grant.claimIds.join(" · ")}</small><small>expires {new Date(grant.expiresAt).toLocaleTimeString()}</small></div><button onClick={() => revokeGrant(grant.grantId)}>Revoke</button></div>) : <div className="empty compact">No active grants.</div>}
        </section>
        <section className="panel">
          <div className="panelHead"><div><span className="eyebrow">AUDIT</span><h3>Human-agent state</h3></div></div>
          {audit.length ? audit.slice(0, 6).map((event, index) => <div className="audit" key={`${event}-${index}`}>{event}</div>) : <div className="empty compact">Tool and consent events will appear here.</div>}
        </section>
      </div>

    </main>
      {pendingRequest && <dialog className="consent consentDialog" ref={consentRef} aria-labelledby="consent-title" aria-describedby="consent-purpose consent-validation" onCancel={(event) => { event.preventDefault(); denyRequest(); }}>
        <span className="eyebrow">MINI PASSPORT REQUEST</span>
        <h3 id="consent-title">Your agent is asking for context</h3>
        <p className="consentPurpose" id="consent-purpose">{pendingRequest.purpose}</p>
        <fieldset className="consentClaims">
          <legend>Requested claims <small>Select only what this task needs.</small></legend>
          {demoClaimDescriptors.filter((claim) => requestedClaimIdsRef.current.includes(claim.id)).map((claim) => <label key={claim.id}>
            <input type="checkbox" checked={pendingRequest.claimIds.includes(claim.id)} onChange={() => setPendingRequest((request) => request ? updatePendingClaim(request, claim.id) : request)} />
            <span><strong>{claim.label}</strong><small>{claim.id}</small></span>
            <em>{claim.sensitivity}</em>
          </label>)}
        </fieldset>
        <div className="consentControlGrid">
          <label>Audience<input type="text" value={pendingRequest.audience} onChange={(event) => setPendingRequest((request) => request ? { ...request, audience: event.target.value } : request)} /></label>
          <label>Mode<select value={pendingRequest.mode} onChange={(event) => setPendingRequest((request) => request ? { ...request, mode: event.target.value as GrantRequest["mode"] } : request)}><option value="reveal">Reveal (agent sees value)</option><option value="use">Use (no reveal)</option><option value="prove">Prove (predicate only)</option></select></label>
          <label>Duration<input type="number" min="30" max="3600" step="1" value={pendingRequest.durationSeconds} onChange={(event) => setPendingRequest((request) => request ? { ...request, durationSeconds: Number(event.target.value) } : request)} /><small>30–3600 seconds</small></label>
        </div>
        <p className="consentHint" id="consent-mode-hint">{pendingRequest.mode === "reveal" ? "The agent can read selected values while this grant is active." : pendingRequest.mode === "use" ? "The provider can use the selected value; the agent receives only an opaque handle." : "The provider receives only a predicate result, never the selected value."}</p>
        <p className={`consentValidation ${consentIssue ? "invalid" : "valid"}`} id="consent-validation" role="status" aria-live="polite">{consentIssue ?? "All selected claims fit this grant scope."}</p>
        <div className="actions"><button className="secondary" type="button" onClick={denyRequest}>Deny</button><button type="button" disabled={Boolean(consentIssue)} onClick={approveRequest}>Approve Mini Passport</button></div>
      </dialog>}
    </>
  );
}
