import assert from "node:assert/strict";
import { mkdtempSync, readdirSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { registerApprovals } from "#server/approvals";
import { loadStore } from "#server/store";

type Handler = (input: any, context?: any) => Promise<unknown> | unknown;
type Sent = { agentId: string; requestId: string; response: unknown };

function setup(options: { rejectResponses?: boolean } = {}) {
  const dir = mkdtempSync(join(tmpdir(), "cua-approvals-"));
  const path = join(dir, "state.json");
  const hooks = new Map<string, Handler>();
  const rpcs = new Map<string, Handler>();
  const sent: Sent[] = [];
  const logs: string[] = [];
  const paseo = {
    agents: {
      ref: (agentId: string) => ({
        respondToPermission: async ({ requestId, response }: { requestId: string; response: unknown }) => {
          if (options.rejectResponses) throw new Error("already resolved");
          sent.push({ agentId, requestId, response });
        },
      }),
    },
  };
  const server = {
    on: (name: string, handler: Handler) => (hooks.set(name, handler), () => {}),
    handle: (contract: { name: string }, handler: Handler) => void rpcs.set(contract.name, handler),
  };
  const store = loadStore(path);
  registerApprovals(server as any, store, { now: () => "2026-11-03T10:00:00.000Z", log: (m) => logs.push(m) });
  const context = { paseo, signal: new AbortController().signal };

  const before = (app: string, requestId: string, agentId = "a1", over: Record<string, unknown> = {}) =>
    hooks.get("agent.permission_requested")!(
      {
        agent: { id: agentId },
        request: {
          id: requestId,
          provider: "codex",
          name: "CodexMcpElicitation",
          kind: "tool",
          description: `Allow Computer Use to use "${app}"?`,
          metadata: { serverName: "cua_repl" },
          ...over,
        },
      },
      context,
    );
  const after = (requestId: string, behavior: "allow" | "deny", agentId = "a1") =>
    hooks.get("agent.permission_resolved")!({ agent: { id: agentId }, requestId, resolution: { behavior } }, context);
  const list = async () => ((await rpcs.get("approvals.list")!({})) as { apps: Array<{ name: string; status: string; lastAutoApprovedAt: string | null }> }).apps;
  const status = async (name: string) => (await list()).find((app) => app.name === name)?.status;
  const setEnabledRpc = (name: string, enabled: boolean) => rpcs.get("approvals.set-enabled")!({ name, enabled });

  return { dir, path, sent, logs, before, after, list, status, setEnabledRpc };
}

test("first manual allow turns an app on and the next card is auto-approved", async () => {
  const t = setup();
  await t.before("Safari", "r1");
  assert.equal(t.sent.length, 0);
  assert.equal(await t.status("Safari"), "new");
  await t.after("r1", "allow");
  assert.equal(await t.status("Safari"), "on");
  await t.before("Safari", "r2");
  assert.deepEqual(t.sent, [{ agentId: "a1", requestId: "r2", response: { behavior: "allow" } }]);
  assert.equal((await t.list())[0].lastAutoApprovedAt, "2026-11-03T10:00:00.000Z");
  assert.deepEqual(t.logs, ["auto-approved Computer Use: Safari agent=a1"]);
});

test("a denied first card, then a manual allow, turns the app on", async () => {
  const t = setup();
  await t.before("Safari", "r1");
  await t.after("r1", "deny");
  assert.equal(await t.status("Safari"), "new");
  await t.before("Safari", "r2");
  await t.after("r2", "allow");
  assert.equal(await t.status("Safari"), "on");
});

test("two concurrent first cards: allowing the second turns the app on", async () => {
  const t = setup();
  await t.before("Notes", "r1", "a1");
  await t.before("Notes", "r2", "a2");
  await t.after("r2", "allow", "a2");
  assert.equal(await t.status("Notes"), "on");
  await t.after("r1", "deny", "a1");
  assert.equal(await t.status("Notes"), "on");
});

test("revoking while a card is pending keeps the app revoked after a manual allow", async () => {
  const t = setup();
  await t.before("Safari", "r1");
  await t.setEnabledRpc("Safari", false);
  await t.after("r1", "allow");
  assert.equal(await t.status("Safari"), "revoked");
  await t.before("Safari", "r2");
  assert.equal(t.sent.length, 0);
});

test("a rejected auto-approval is swallowed and not recorded as approved", async () => {
  const t = setup({ rejectResponses: true });
  await t.before("Safari", "r1");
  await t.after("r1", "allow");
  await t.before("Safari", "r2");
  assert.equal((await t.list())[0].lastAutoApprovedAt, null);
  assert.deepEqual(t.logs, []);
});

test("non-matching requests are ignored entirely", async () => {
  const t = setup();
  await t.before("Safari", "r1", "a1", { name: "Bash" });
  await t.after("r1", "allow");
  assert.equal(t.sent.length, 0);
  assert.deepEqual(await t.list(), []);
});

test("setEnabled rejects unknown apps", async () => {
  const t = setup();
  await assert.rejects(async () => t.setEnabledRpc("Finder", true), /Unknown app/);
});

test("state persists across loads", async () => {
  const t = setup();
  await t.before("Safari", "r1");
  await t.after("r1", "allow");
  assert.equal(loadStore(t.path).state.apps.Safari.status, "on");
});

test("an unreadable state file is moved aside, not overwritten", () => {
  const dir = mkdtempSync(join(tmpdir(), "cua-approvals-"));
  const path = join(dir, "state.json");
  writeFileSync(path, "{not json");
  const logs: string[] = [];
  const store = loadStore(path, (m) => logs.push(m));
  assert.deepEqual(store.state, { apps: {} });
  assert.equal(readdirSync(dir).filter((f) => f.startsWith("state.json.corrupt-")).length, 1);
  assert.equal(logs.length, 1);
});
