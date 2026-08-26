import type { ProviderKind } from "@weave/protocol";
import type { WebMCPTool } from "@weave/webmcp";

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
      annotations: { readOnlyHint: true },
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
      description: "Starts a simulated bank account application after eligibility review. Requires an active Mini Passport grant identifier.",
      inputSchema: { type: "object", required: ["accountId", "grantId"], properties: { accountId: { type: "string" }, grantId: { type: "string" } }, additionalProperties: false },
      execute: async (input) => event("bank_start_application", { status: "started", applicationId: `bank_${crypto.randomUUID()}`, accountId: input.accountId }),
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
