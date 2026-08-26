import type { WorkspaceConstraint, WorkspaceManifest, WorkspaceSection } from "@weave/protocol";

const providers: WorkspaceSection["provider"][] = ["housing", "bank", "civic", "passport", "overview"];
const statuses: NonNullable<WorkspaceSection["status"]>[] = ["idle", "ready", "blocked", "complete"];

function defaultConstraints(): WorkspaceConstraint[] {
  return [
    { id: "monthly_budget", label: "Monthly housing budget", type: "number", value: 180000, unit: "JPY" },
    { id: "max_commute", label: "Maximum commute", type: "number", value: 45, unit: "minutes" },
    { id: "furnished", label: "Furnished home", type: "boolean", value: true },
  ];
}

function normalizeConstraints(value: unknown): WorkspaceConstraint[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((item) => {
    if (!item || typeof item !== "object") return [];
    const candidate = item as Record<string, unknown>;
    const id = typeof candidate.id === "string" ? candidate.id.trim() : "";
    const label = typeof candidate.label === "string" ? candidate.label.trim() : "";
    const type = candidate.type;
    if (!id || !label || (type !== "text" && type !== "number" && type !== "boolean")) return [];

    let normalizedValue: string | number | boolean;
    if (type === "number") {
      const numberValue = typeof candidate.value === "number" ? candidate.value : Number(candidate.value);
      if (!Number.isFinite(numberValue)) return [];
      normalizedValue = numberValue;
    } else if (type === "boolean") {
      if (typeof candidate.value === "boolean") normalizedValue = candidate.value;
      else if (candidate.value === "true") normalizedValue = true;
      else if (candidate.value === "false") normalizedValue = false;
      else return [];
    } else {
      if (!["string", "number", "boolean"].includes(typeof candidate.value)) return [];
      normalizedValue = String(candidate.value);
    }

    const unit = typeof candidate.unit === "string" ? candidate.unit.trim() : "";
    return [{ id, label, type, value: normalizedValue, ...(unit ? { unit } : {}) }];
  });
}

function normalizeSections(value: unknown): WorkspaceSection[] {
  if (!Array.isArray(value) || value.length < 1 || value.length > 8) return [];
  return value.flatMap((item) => {
    if (!item || typeof item !== "object") return [];
    const candidate = item as Record<string, unknown>;
    const title = typeof candidate.title === "string" ? candidate.title.trim() : "";
    const description = typeof candidate.description === "string" ? candidate.description.trim() : "";
    const provider = providers.find((item) => item === candidate.provider);
    if (!title || !description || !provider) return [];
    const status = statuses.find((item) => item === candidate.status);
    return [{
      id: typeof candidate.id === "string" && candidate.id.trim() ? candidate.id.trim() : `section_${crypto.randomUUID()}`,
      title,
      description,
      provider,
      ...(status ? { status } : {}),
    }];
  });
}

export function createWorkspaceManifest(input: Record<string, unknown>, current: WorkspaceManifest | null): WorkspaceManifest | null {
  const title = typeof input.title === "string" ? input.title.trim() : "";
  const goal = typeof input.goal === "string" ? input.goal.trim() : "";
  if (!Array.isArray(input.sections) || input.sections.length < 1 || input.sections.length > 8) return null;
  const sections = normalizeSections(input.sections);
  if (!title || !goal || sections.length !== input.sections.length) return null;

  const requestedConstraints = normalizeConstraints(input.constraints);
  const constraints = requestedConstraints.length
    ? requestedConstraints
    : current?.goal === goal && current.constraints?.length
      ? current.constraints
      : defaultConstraints();

  const summary = typeof input.summary === "string" ? input.summary.trim() : "";
  return {
    id: `workspace_${crypto.randomUUID()}`,
    title,
    goal,
    ...(summary ? { summary } : {}),
    constraints,
    sections,
  };
}

export function summarizeProviderResult(result: unknown): Record<string, unknown> {
  if (!result || typeof result !== "object" || Array.isArray(result)) return { status: "completed" };
  const record = result as Record<string, unknown>;
  const allowed = ["status", "code", "applicationId", "accountId", "accessMode", "claimUsed", "proof", "privacy"];
  return Object.fromEntries(allowed.filter((key) => key in record).map((key) => [key, record[key]]));
}
