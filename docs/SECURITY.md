# Security & Privacy Plan

This project is a prototype of a privacy/delegation model, so security behavior is part of the product demo rather than a disclaimer section.

## Threats we demonstrate

### Over-disclosure

A task asks for more Passport claims than it needs. Human must be able to remove fields before approval.

### Stale authority

A previously approved grant remains usable after the user believes the task is over. Every grant has explicit expiry and manual revoke.

### Cross-purpose reuse

A claim approved for one provider/task is reused elsewhere. Phase 3 grant scope validation rejects this.

### Prompt/tool output injection

Provider content can contain attacker-controlled text. Mark relevant outputs with `untrustedContentHint` and never interpret provider text as authorization to disclose Passport claims.

### Ambiguous consequential tools

Tool names/descriptions must state whether they search, hold, start, book, or commit. Avoid ambiguous terms such as `finalize`.

## Synthetic data only

The demo Passport is populated with fabricated data. Never ask hackathon judges to enter actual passport numbers, banking credentials, health information, or other sensitive secrets.

## Prototype limitations

The Phase 0 scaffold stores synthetic values in client JavaScript. That is **not** a production secret store. The prototype is demonstrating interaction semantics:

- descriptor-only discovery,
- scoped consent,
- progressive disclosure,
- sealed-use handles,
- revocation,
- auditability.

A production version would require hardened local storage and stronger origin/authentication guarantees.

## Browser security primitives

Respect WebMCP's current origin isolation and `tools` Permissions Policy requirements. Provider tools should only use `exposedTo` for explicitly trusted WEAVE origins.

## Consequential action rule

No real financial, legal, government, or identity action is performed by the hackathon demo. Provider writes are simulations with visible state changes.
