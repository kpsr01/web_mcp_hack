# Product Brief

## One-line pitch

**WEAVE assembles temporary applications from WebMCP capabilities while a private Passport gives agents only the personal context the user explicitly delegates.**

## Problem

The agentic web has two separate problems:

1. Websites are designed as isolated interfaces even when user goals span many services.
2. Useful agents need personal context, but copying an entire user profile into agent memory creates unnecessary disclosure and weak control over purpose, duration, and recipients.

WebMCP addresses the first half by allowing websites to expose structured capabilities. WEAVE explores what happens when those capabilities become composable while personal context remains user-controlled.

## Product model

### Global Passport

A private local vault. The agent can discover that claims exist, but not their values.

Example descriptors:

- `identity.full_name`
- `identity.date_of_birth`
- `identity.nationality`
- `credentials.passport_number`
- `preferences.diet`
- `financial.monthly_housing_budget`

### WEAVE Canvas

A temporary task-specific app generated from a safe `WorkspaceManifest`. It combines the relevant capabilities and current task state into one human-facing interface.

### Mini Passport

When the agent needs context it creates a grant request with:

- WHAT claims
- WHO receives/uses them
- WHY they are needed
- HOW they may be used (`reveal`, `use`, `prove`)
- HOW LONG the grant survives

The user approves, edits, or denies the request.

## Primary demo scenario

**Goal:** “Set me up to live in Tokyo.”

Independent provider origins:

1. Housing — search listings, hold a listing.
2. Bank — check eligibility, start an account application.
3. Civic — retrieve registration requirements, book an appointment.

The agent first composes a workspace without private values. Planning uses low-sensitivity claims. Later actions trigger progressively more sensitive requests. The user can revoke the Mini Passport and the agent loses access without destroying the human UI.

## Target audience / potential impact

The long-term audience is anyone delegating cross-site tasks to browser agents, especially tasks involving identity, preferences, credentials, or financial boundaries. The immediate prototype targets browser/platform developers by demonstrating a user-controlled data/delegation layer that could sit between personal context and WebMCP-enabled sites.

## Why WebMCP is essential

This is not a generic function-calling demo. The central interaction depends on:

- Sites exposing tools from the same live applications humans see.
- Cross-origin tool exposure and discovery.
- Tool state changing as the page/task changes.
- Human UI reflecting tool execution immediately.
- Agent actions remaining inside the signed-in/local browser context.

Without WebMCP, WEAVE becomes a collection of bespoke backend integrations—the opposite of the open-web thesis.

## What we are intentionally not building

- A production identity wallet.
- A password manager.
- A generic no-code platform.
- A full travel booking app.
- Real financial or government transactions.
- Arbitrary AI-generated frontend code.

The hackathon deliverable is a coherent research-quality product prototype with a flawless end-to-end demo.
