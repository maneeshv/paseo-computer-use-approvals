import assert from "node:assert/strict";
import test from "node:test";
import {
  applyManualResolution,
  approvalsStateSchema,
  listApps,
  recordSeen,
  setEnabled,
  type ApprovalsState,
} from "#shared/state";

const T1 = "2026-11-03T10:00:00.000Z";
const T2 = "2026-11-03T11:00:00.000Z";
const empty = (): ApprovalsState => ({ apps: {} });

test("unknown app is recorded as new and later sightings keep firstSeenAt", () => {
  const state = empty();
  assert.equal(recordSeen(state, "Safari", T1), "new");
  assert.deepEqual(state.apps.Safari, { status: "new", firstSeenAt: T1, lastSeenAt: T1, lastAutoApprovedAt: null });
  assert.equal(recordSeen(state, "Safari", T2), "new");
  assert.equal(state.apps.Safari.firstSeenAt, T1);
  assert.equal(state.apps.Safari.lastSeenAt, T2);
});

test("manual allow turns a new app on", () => {
  const state = empty();
  recordSeen(state, "Safari", T1);
  assert.equal(applyManualResolution(state, "Safari", true), true);
  assert.equal(state.apps.Safari.status, "on");
});

test("a denied first card does not block a later manual allow", () => {
  const state = empty();
  recordSeen(state, "Safari", T1);
  assert.equal(applyManualResolution(state, "Safari", false), false);
  assert.equal(state.apps.Safari.status, "new");
  applyManualResolution(state, "Safari", true);
  assert.equal(state.apps.Safari.status, "on");
});

test("revoked stays revoked on manual allow until switched on", () => {
  const state = empty();
  recordSeen(state, "Safari", T1);
  applyManualResolution(state, "Safari", true);
  assert.equal(setEnabled(state, "Safari", false).status, "revoked");
  assert.equal(applyManualResolution(state, "Safari", true), false);
  assert.equal(state.apps.Safari.status, "revoked");
  assert.equal(setEnabled(state, "Safari", true).status, "on");
});

test("setEnabled rejects unknown apps", () => {
  assert.throws(() => setEnabled(empty(), "Finder", true), /Unknown app: Finder/);
});

test("listApps sorts by name", () => {
  const state = empty();
  recordSeen(state, "Safari", T1);
  recordSeen(state, "Notes", T1);
  assert.deepEqual(listApps(state).map((app) => app.name), ["Notes", "Safari"]);
});

test("schema defaults to empty and rejects unknown statuses", () => {
  assert.deepEqual(approvalsStateSchema.parse({}), { apps: {} });
  assert.throws(() => approvalsStateSchema.parse({ apps: { X: { status: "maybe" } } }));
});

test("inherited object property names are treated as unknown apps", () => {
  const state = empty();
  assert.throws(() => setEnabled(state, "__proto__", true), /Unknown app/);
  assert.throws(() => setEnabled(state, "toString", true), /Unknown app/);
  assert.equal(recordSeen(state, "constructor", T1), "new");
  assert.equal(state.apps["constructor"]?.status, "new");
  assert.equal(({} as { status?: string }).status, undefined);
});
