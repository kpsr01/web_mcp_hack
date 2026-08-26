import type { ClaimPredicate, ProviderKind } from "@weave/protocol";
import type { WebMCPTool } from "@weave/webmcp";

const weaveOrigin = import.meta.env.VITE_WEAVE_ORIGIN ?? "http://localhost:3000";

type ProviderAuthorization =
  | { status: "authorized"; claimId: string; value?: unknown; proof?: boolean }
  | { status: "error"; code: string };

function authorizeClaim(input: {
  claimHandle: string;
  mode: "use" | "prove";
  audience: ProviderKind;
  predicate?: ClaimPredicate;
}): Promise<ProviderAuthorization> {
  if (typeof window === "undefined" || window.parent === window) {
    return Promise.resolve({ status: "error", code: "PROVIDER_AUTH_UNAVAILABLE" });
  }

  const requestId = `provider_auth_${crypto.randomUUID()}`;
  return new Promise((resolve) => {
    let settled = false;
    const finish = (result: ProviderAuthorization) => {
      if (settled) return;
      settled = true;
      window.clearTimeout(timeout);
      window.removeEventListener("message", onMessage);
      resolve(result);
    };
    const onMessage = (event: MessageEvent) => {
      if (event.source !== window.parent || event.origin !== weaveOrigin) return;
      const data = event.data;
      if (!data || typeof data !== "object") return;
      const response = data as Record<string, unknown>;
      if (response.type !== "weave-passport-authorization-result" || response.requestId !== requestId) return;
      if (response.status !== "authorized" || typeof response.claimId !== "string") {
        finish({ status: "error", code: typeof response.code === "string" ? response.code : "PROVIDER_AUTH_UNAVAILABLE" });
        return;
      }
      finish({
        status: "authorized",
        claimId: response.claimId,
        ...(Object.prototype.hasOwnProperty.call(response, "value") ? { value: response.value } : {}),
        ...(typeof response.proof === "boolean" ? { proof: response.proof } : {}),
      });
    };
    const timeout = window.setTimeout(() => finish({ status: "error", code: "PROVIDER_AUTH_UNAVAILABLE" }), 3000);
    window.addEventListener("message", onMessage);
    try {
      window.parent.postMessage({
        type: "weave-passport-authorize",
        requestId,
        claimHandle: input.claimHandle,
        audience: input.audience,
        mode: input.mode,
        predicate: input.predicate,
      }, weaveOrigin);
    } catch {
      finish({ status: "error", code: "PROVIDER_AUTH_UNAVAILABLE" });
    }
  });
}

export interface ProviderDefinition {
  kind: ProviderKind;
  name: string;
  strapline: string;
  tools: WebMCPTool[];
}

function event(tool: string, result: unknown) {
  window.dispatchEvent(new CustomEvent("weave-provider-action", { detail: { tool, result } }));
  return result;
}

const housing: ProviderDefinition = {
  kind: "housing",
  name: "HomeTokyo",
  strapline: "Independent housing marketplace",
  tools: [
    {
      name: "housing_search",
      title: "Search housing",
      description: "Searches available Tokyo housing by monthly budget, furnished preference, and maximum commute time.",
      inputSchema: { type: "object", required: ["maxMonthlyRent"], properties: { maxMonthlyRent: { type: "number" }, furnished: { type: "boolean" }, maxCommuteMinutes: { type: "integer" } }, additionalProperties: false },
      annotations: { readOnlyHint: true, untrustedContentHint: true },
      execute: async (input) => event("housing_search", { results: [
        { id: "home_kichijoji", area: "Kichijoji", monthlyRent: Math.min(Number(input.maxMonthlyRent), 168000), furnished: true, commuteMinutes: 31 },
        { id: "home_koenji", area: "Koenji", monthlyRent: Math.min(Number(input.maxMonthlyRent), 151000), furnished: true, commuteMinutes: 27 },
      ] }),
    },
    {
      name: "housing_hold",
      title: "Hold housing listing",
      description: "Places a simulated temporary hold on one housing listing. Requires an active Mini Passport grant identifier.",
      inputSchema: { type: "object", required: ["listingId", "grantId"], properties: { listingId: { type: "string" }, grantId: { type: "string" } }, additionalProperties: false },
      execute: async (input) => event("housing_hold", { status: "held", listingId: input.listingId, holdMinutes: 15, grantId: input.grantId }),
    },
  ],
};

const bank: ProviderDefinition = {
  kind: "bank",
  name: "SakuraBank",
  strapline: "New-resident banking simulator",
  tools: [
    {
      name: "bank_check_eligibility",
      title: "Check bank eligibility",
      description: "Checks simulated new-resident account eligibility using a Mini Passport grant identifier.",
      inputSchema: { type: "object", required: ["grantId"], properties: { grantId: { type: "string" } }, additionalProperties: false },
      annotations: { readOnlyHint: true },
      execute: async (input) => event("bank_check_eligibility", { eligible: true, account: "New Resident Everyday", next: "Residence registration required", grantId: input.grantId }),
    },
    {
      name: "bank_start_application",
      title: "Start bank application",
      description: "Starts a simulated bank application with an opaque use handle or proof predicate. Raw Passport values never appear in the result.",
      inputSchema: {
        type: "object",
        required: ["accountId", "claimHandle", "accessMode"],
        properties: {
          accountId: { type: "string" },
          claimHandle: { type: "string", description: "Opaque handle from an approved Mini Passport grant." },
          accessMode: { type: "string", enum: ["use", "prove"] },
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
        const bankError = (code: string) => event("bank_start_application", { status: "error", code });
        const mode = input.accessMode === "use" || input.accessMode === "prove" ? input.accessMode : null;
        if (!mode) return bankError("INVALID_ACCESS_MODE");
        const authorization = await authorizeClaim({
          claimHandle: String(input.claimHandle),
          mode,
          audience: "bank",
          predicate: input.predicate as ClaimPredicate | undefined,
        });
        if (authorization.status !== "authorized") return event("bank_start_application", authorization);

        const expectedClaim = mode === "use" ? "credentials.passport_number" : "identity.date_of_birth";
        if (authorization.claimId !== expectedClaim) return bankError("GRANT_SCOPE_VIOLATION");
        if (mode === "use" && (typeof authorization.value !== "string" || !authorization.value.startsWith("DEMO-PASSPORT-"))) {
          return bankError("PROVIDER_INELIGIBLE");
        }
        if (mode === "prove" && authorization.proof !== true) return bankError("PROVIDER_INELIGIBLE");

        return event("bank_start_application", {
          status: "started",
          applicationId: `bank_${crypto.randomUUID()}`,
          accountId: String(input.accountId),
          accessMode: mode,
          claimUsed: authorization.claimId,
          ...(mode === "prove" ? { proof: authorization.proof } : {}),
          privacy: mode === "use" ? "claim_used_without_reveal" : "predicate_proven",
        });
      },
    },
  ],
};

const civic: ProviderDefinition = {
  kind: "civic",
  name: "Tokyo CityDesk",
  strapline: "Civic registration simulator",
  tools: [
    {
      name: "civic_get_requirements",
      title: "Get civic requirements",
      description: "Returns simulated city registration requirements for a new resident and the Passport claim names required later.",
      inputSchema: { type: "object", required: ["city"], properties: { city: { type: "string" } }, additionalProperties: false },
      annotations: { readOnlyHint: true },
      execute: async (input) => event("civic_get_requirements", { city: input.city, requirements: ["identity.full_name", "identity.nationality", "credentials.passport_number"], note: "Demo requirements only." }),
    },
    {
      name: "civic_book_registration",
      title: "Book civic registration",
      description: "Books a simulated resident-registration appointment. Requires an active Mini Passport grant identifier.",
      inputSchema: { type: "object", required: ["slotId", "grantId"], properties: { slotId: { type: "string" }, grantId: { type: "string" } }, additionalProperties: false },
      execute: async (input) => event("civic_book_registration", { status: "booked", slotId: input.slotId, confirmation: `city_${crypto.randomUUID()}` }),
    },
  ],
};

export function getProvider(kind: string | undefined): ProviderDefinition {
  if (kind === "bank") return bank;
  if (kind === "civic") return civic;
  return housing;
}
