# Passport Protocol (Prototype)

Passport is WEAVE's experimental delegation layer. It is not part of the current WebMCP standard.

## Design goal

The default relationship should be:

```text
agent knows claim exists != agent knows claim value
```

The Global Passport separates descriptors from values.

## Claim descriptor

```ts
interface ClaimDescriptor {
  id: string;
  label: string;
  category: "identity" | "credential" | "preference" | "financial" | "location";
  sensitivity: "low" | "medium" | "high";
  allowedModes: Array<"reveal" | "use" | "prove">;
}
```

`weave_list_passport_claims` may return these descriptors. It must never join them with values.

## Mini Passport request

A request contains:

- `claimIds`: requested claims.
- `purpose`: concise human-readable reason.
- `audience`: tool/provider/task scope.
- `mode`: reveal/use/prove.
- `durationSeconds`: requested lifetime.

The consent UI lets the human remove claims or shorten duration before approval.

## Grant modes

### Reveal

The agent may read the actual value for the duration/scope of the grant. Use only for values where direct reasoning benefits outweigh privacy cost, e.g. dietary preference or a non-sensitive budget preference.

Phase 2 reads also require the exact grant audience and fail after revocation or expiry, for claims outside the grant, or for non-`reveal` modes.

### Use

The agent receives an opaque handle and may pass it into a compatible provider operation. WEAVE resolves the real value at execution time. The model should not receive the raw value.

### Prove

The agent/provider receives a derived result, not the underlying value. Examples:

```text
age >= 18 -> true
monthly_housing_budget >= 150000 -> true
has_valid_passport -> true
```

Phase 3 implements a deliberately small predicate set. Do not create a general expression evaluator.

## Grant lifecycle

```text
REQUESTED -> APPROVED -> ACTIVE -> EXPIRED
              |            |
              |            -> REVOKED
              -> DENIED
```

Every state transition enters the local audit trail.

## Security semantics

A grant is necessary but not sufficient for a consequential action. Provider-specific business validation still applies.

Use/prove handles are opaque random identifiers. The broker validates the handle's grant, audience, claim scope, mode, expiry, and revocation at execution time. Providers repeat that validation before a consequential action; they receive the selected value only in `use` mode and receive a predicate result only in `prove` mode.

Phase 3 supports only `ageAtLeast`, `numberAtLeast`, and `present` predicates. Opaque handles should encode no secret value. For the prototype they can be random UUIDs mapped to a local in-memory/IndexedDB record.

## Agent-visible grant result

Approved grant output should contain only metadata:

```json
{
  "status": "approved",
  "grantId": "grant_...",
  "claimIds": ["credentials.passport_number"],
  "claimHandles": ["claim_..."],
  "mode": "use",
  "expiresAt": "..."
}
```

`claimHandles` are returned for `use` and `prove` grants. They authorize compatible provider operations but never reveal claim values to the agent. Reveal grants may return no handles and remain the only mode supported by `weave_read_granted_claim`.

No values in `use` or `prove` modes.

## Consent UX requirement

The UI must answer at a glance:

- What is being requested?
- Why?
- Who/which provider can use it?
- Does the agent see it, merely use it, or only prove a condition?
- When does access end?
- Can I revoke now?
