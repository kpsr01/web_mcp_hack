import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const cases = JSON.parse(await readFile(new URL("./cases.json", import.meta.url), "utf8"));
const results = JSON.parse(await readFile(new URL("./results.json", import.meta.url), "utf8"));
const groups = ["tool-choice", "ambiguous-intent", "sequencing", "privacy-permission", "failure-adversarial"];
const dimensions = ["tool-choice", "parameters", "sequencing", "minimization", "denial-recovery", "revocation-recovery", "stale-capability", "provider-failure", "excessive-data", "grant-boundary"];
const tools = new Set([
  "weave_compose_workspace",
  "weave_list_passport_claims",
  "weave_request_passport_grant",
  "weave_start_bank_application",
  "weave_list_active_grants",
  "weave_read_granted_claim",
  "housing_search",
  "housing_hold",
  "bank_check_eligibility",
  "bank_start_application",
  "civic_get_requirements",
  "civic_book_registration",
]);
const claims = new Set([
  "identity.full_name",
  "identity.date_of_birth",
  "identity.nationality",
  "credentials.passport_number",
  "preferences.diet",
  "financial.monthly_housing_budget",
  "location.current_city",
]);

function sequenceTools(sequence) {
  return sequence.filter((step) => !step.startsWith("human:") && !step.startsWith("error:"));
}

test("Phase four commits exactly five cases in each evaluation group", () => {
  assert.equal(cases.length, 25);
  assert.equal(new Set(cases.map((item) => item.id)).size, 25);
  assert.deepEqual([...new Set(cases.map((item) => item.group))].sort(), [...groups].sort());
  for (const group of groups) assert.equal(cases.filter((item) => item.group === group).length, 5, group);
});

test("every eval case has a bounded, reproducible expectation", () => {
  for (const item of cases) {
    assert.ok(item.prompt.trim(), item.id);
    assert.ok(dimensions.includes(item.dimension), `${item.id}: unknown dimension`);
    assert.ok(Array.isArray(item.expected.tools), item.id);
    assert.ok(Array.isArray(item.expected.sequence), item.id);
    assert.ok(Array.isArray(item.expected.claims), item.id);
    assert.ok(Array.isArray(item.expected.parameters), item.id);
    assert.equal(typeof item.expected.outcome, "string", item.id);
    for (const tool of item.expected.tools) assert.ok(tools.has(tool), `${item.id}: unknown tool ${tool}`);
    for (const step of sequenceTools(item.expected.sequence)) assert.ok(tools.has(step), `${item.id}: unknown step ${step}`);
    for (const claim of item.expected.claims) {
      assert.ok(claims.has(claim) || item.id === "failure-02", `${item.id}: unknown claim ${claim}`);
    }
    for (const parameter of item.expected.parameters) {
      assert.ok(tools.has(parameter.tool), `${item.id}: unknown parameter tool`);
      assert.ok(parameter.required && typeof parameter.required === "object" && !Array.isArray(parameter.required), item.id);
      assert.ok(Array.isArray(parameter.forbidden), item.id);
    }
    assert.equal(JSON.stringify(item.expected).includes("DEMO-PASSPORT-4831"), false, item.id);
    assert.equal(JSON.stringify(item.expected).includes("Aarav Demo"), false, item.id);
  }
});

test("eval coverage includes each required adversarial dimension", () => {
  const covered = new Set(cases.map((item) => item.dimension));
  for (const dimension of ["parameters", "minimization", "denial-recovery", "revocation-recovery", "stale-capability", "provider-failure", "excessive-data"]) {
    assert.ok(covered.has(dimension), `missing ${dimension}`);
  }
});
test("recorded eval baseline names its environment and matches the dataset", () => {
  assert.match(results.date, /^\d{4}-\d{2}-\d{2}$/);
  assert.ok(results.model);
  assert.match(results.browser, /^Chrome \d+\.\d+\.\d+\.\d+$/);
  assert.equal(results.command, "pnpm test:evals");
  assert.equal(results.cases, cases.length);
  assert.equal(results.groups, groups.length);
  assert.equal(results.result, "pass");
});
