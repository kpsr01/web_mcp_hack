import { useEffect, useMemo, useRef, useState } from "react";
import { createGrant, demoClaimDescriptors, isGrantActive, readDemoClaimValue } from "@weave/passport";
import type { GrantRequest, MiniPassportGrant, WorkspaceManifest } from "@weave/protocol";
import { hasWebMCP, registerWebMCPTool } from "@weave/webmcp";

const providerOrigins = {
  housing: import.meta.env.VITE_HOUSING_ORIGIN ?? "http://localhost:3101",
  bank: import.meta.env.VITE_BANK_ORIGIN ?? "http://localhost:3102",
  civic: import.meta.env.VITE_CIVIC_ORIGIN ?? "http://localhost:3103",
};

type GrantResolver = (result: Record<string, unknown>) => void;

export function App() {
  const [workspace, setWorkspace] = useState<WorkspaceManifest | null>(null);
  const [pendingRequest, setPendingRequest] = useState<GrantRequest | null>(null);
  const [grants, setGrants] = useState<MiniPassportGrant[]>([]);
  const [audit, setAudit] = useState<string[]>([]);
  const resolverRef = useRef<GrantResolver | null>(null);
  const grantsRef = useRef(grants);

  useEffect(() => { grantsRef.current = grants; }, [grants]);

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
          const manifest: WorkspaceManifest = {
            id: `workspace_${crypto.randomUUID()}`,
            title: String(input.title),
            goal: String(input.goal),
            summary: input.summary ? String(input.summary) : undefined,
            sections: (input.sections as WorkspaceManifest["sections"]).map((section) => ({
              ...section,
              id: section.id ?? `section_${crypto.randomUUID()}`,
            })),
          };
          setWorkspace(manifest);
          setAudit((items) => [`Workspace composed: ${manifest.title}`, ...items]);
          return { status: "created", workspaceId: manifest.id, sectionCount: manifest.sections.length };
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
          const requestedIds = (input.claimIds as unknown[]).map(String);
          const validIds = requestedIds.filter((id) => demoClaimDescriptors.some((claim) => claim.id === id));
          if (!validIds.length) return { status: "rejected", code: "UNKNOWN_CLAIMS" };

          const request: GrantRequest = {
            requestId: `request_${crypto.randomUUID()}`,
            claimIds: validIds,
            purpose: String(input.purpose),
            audience: String(input.audience),
            mode: input.mode as GrantRequest["mode"],
            durationSeconds: Number(input.durationSeconds),
          };
          setPendingRequest(request);
          setAudit((items) => [`Consent requested: ${validIds.join(", ")}`, ...items]);
          return new Promise<Record<string, unknown>>((resolve) => { resolverRef.current = resolve; });
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
          required: ["grantId", "claimId"],
          properties: { grantId: { type: "string" }, claimId: { type: "string" } },
          additionalProperties: false,
        },
        annotations: { readOnlyHint: true },
        execute: async (input) => {
          const grant = grantsRef.current.find((item) => item.grantId === String(input.grantId));
          if (!grant) return { status: "error", code: "GRANT_REQUIRED" };
          if (!isGrantActive(grant)) return { status: "error", code: grant.revokedAt ? "GRANT_REVOKED" : "GRANT_EXPIRED" };
          if (grant.mode !== "reveal" || !grant.claimIds.includes(String(input.claimId))) return { status: "error", code: "GRANT_SCOPE_VIOLATION" };
          return { claimId: String(input.claimId), value: readDemoClaimValue(String(input.claimId)) };
        },
      }),
    ];
    return () => cleanups.forEach((cleanup) => cleanup());
  }, []);

  const activeGrants = useMemo(() => grants.filter((grant) => isGrantActive(grant)), [grants]);

  function approveRequest() {
    if (!pendingRequest || !resolverRef.current) return;
    const grant = createGrant(pendingRequest);
    setGrants((items) => [grant, ...items]);
    setAudit((items) => [`Mini Passport approved: ${grant.grantId}`, ...items]);
    resolverRef.current({ status: "approved", ...grant });
    resolverRef.current = null;
    setPendingRequest(null);
  }

  function denyRequest() {
    if (!pendingRequest || !resolverRef.current) return;
    setAudit((items) => [`Consent denied: ${pendingRequest.claimIds.join(", ")}`, ...items]);
    resolverRef.current({ status: "denied", requestId: pendingRequest.requestId });
    resolverRef.current = null;
    setPendingRequest(null);
  }

  function revokeGrant(grantId: string) {
    setGrants((items) => items.map((grant) => grant.grantId === grantId ? { ...grant, revokedAt: new Date().toISOString() } : grant));
    setAudit((items) => [`Mini Passport revoked: ${grantId}`, ...items]);
  }

  return (
    <main>
      <header className="topbar">
        <div><span className="eyebrow">WEBMCP CHALLENGE</span><h1>WEAVE</h1></div>
        <div className={`status ${hasWebMCP() ? "ok" : "warn"}`}>{hasWebMCP() ? "WebMCP available" : "WebMCP unavailable"}</div>
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

        <section className="panel canvas">
          <div className="panelHead"><div><span className="eyebrow">WEAVE CANVAS</span><h3>{workspace?.title ?? "No temporary app yet"}</h3></div><span className="pill">agent-generated manifest</span></div>
          {workspace ? <>
            <p className="goal">{workspace.goal}</p>
            <div className="sections">{workspace.sections.map((section) => <article key={section.id}><span>{section.provider}</span><h4>{section.title}</h4><p>{section.description}</p><small>{section.status ?? "idle"}</small></article>)}</div>
          </> : <div className="empty">Ask your agent to compose a workspace from the available WebMCP capabilities.</div>}
        </section>
      </div>

      <section className="panel providers">
        <div className="panelHead"><div><span className="eyebrow">INDEPENDENT ORIGINS</span><h3>Capability providers</h3></div><span className="pill">iframe allow="tools"</span></div>
        <div className="frames">
          {Object.entries(providerOrigins).map(([name, origin]) => <iframe key={name} title={`${name} provider`} src={origin} allow="tools" />)}
        </div>
      </section>

      <div className="grid lower">
        <section className="panel">
          <div className="panelHead"><div><span className="eyebrow">MINI PASSPORTS</span><h3>Active grants</h3></div></div>
          {activeGrants.length ? activeGrants.map((grant) => <div className="grant" key={grant.grantId}><div><strong>{grant.mode.toUpperCase()} · {grant.audience}</strong><small>{grant.claimIds.join(" · ")}</small><small>expires {new Date(grant.expiresAt).toLocaleTimeString()}</small></div><button onClick={() => revokeGrant(grant.grantId)}>Revoke</button></div>) : <div className="empty compact">No active grants.</div>}
        </section>
        <section className="panel">
          <div className="panelHead"><div><span className="eyebrow">AUDIT</span><h3>Human-agent state</h3></div></div>
          {audit.length ? audit.slice(0, 6).map((event, index) => <div className="audit" key={`${event}-${index}`}>{event}</div>) : <div className="empty compact">Tool and consent events will appear here.</div>}
        </section>
      </div>

      {pendingRequest && <div className="scrim" role="presentation"><section className="consent" role="dialog" aria-modal="true" aria-labelledby="consent-title"><span className="eyebrow">MINI PASSPORT REQUEST</span><h3 id="consent-title">Your agent is asking for context</h3><p>{pendingRequest.purpose}</p><div className="consentClaims">{pendingRequest.claimIds.map((id) => <div key={id}>{demoClaimDescriptors.find((claim) => claim.id === id)?.label ?? id}</div>)}</div><dl><div><dt>Audience</dt><dd>{pendingRequest.audience}</dd></div><div><dt>Mode</dt><dd>{pendingRequest.mode}</dd></div><div><dt>Duration</dt><dd>{pendingRequest.durationSeconds}s</dd></div></dl><div className="actions"><button className="secondary" onClick={denyRequest}>Deny</button><button onClick={approveRequest}>Approve Mini Passport</button></div></section></div>}
    </main>
  );
}
