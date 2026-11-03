# Computer Use Approvals Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A Paseo plugin that auto-approves repeat Codex Computer Use app-access cards for apps the user has turned on, with a sidebar screen to switch apps on and off.

**Architecture:** Pure matcher and state-transition modules in `shared/` (unit-tested with `node --test`). A server entry loads a JSON state file, registers `agent.permission.before/after` hooks and two RPCs. A client entry adds a sidebar item and a screen that lists apps through the RPCs.

**Tech Stack:** TypeScript, `@getpaseo/plugin` 0.14.0, Zod 4, React Native primitives, `@tanstack/react-query`, Node 22 `node --test` with type stripping.

**Spec:** `docs/superpowers/specs/2026-11-03-computer-use-approvals-design.md` (read it first; this plan argues from it).

## Global Constraints

- Plugin id `computer-use-approvals`; `paseo-plugin.json` `requirements.paseo` = `">=0.14.0"`.
- Dev dependency versions follow `~/Developer/personal-project/paseo-quote-reply/package.json` (`@getpaseo/plugin` and `@getpaseo/protocol` pinned `0.14.0`, `zod ^4.4.3`, `react 19.1.0`, `react-native 0.81.5`, `typescript ^5.9.3`, `@tanstack/react-query ^5.90.11`, `@types/react ~19.2.0`). npm, not another package manager (matches the sibling repo and `paseo plugin init`).
- Imports between plugin modules use package `imports` aliases (user prefers absolute imports): `"#shared/*": "./shared/*.ts"`, `"#server/*": "./server/*.ts"`, `"#client/*": "./client/*.tsx"`. If Paseo's bundler rejects pattern aliases at install, fall back to one explicit alias per file as the sibling repo does (`"#match": "./shared/match.ts"`).
- Match exactly: `name === "CodexMcpElicitation"`, `provider === "codex"`, `metadata.serverName === "cua_repl"`, description regex `^Allow Computer Use to use (?:"([^"]+)"|([^"?]+))\?$`.
- The plugin only ever responds `{ behavior: "allow" }`. Never deny.
- Statuses: `"new" | "on" | "revoked"`. Manual Allow turns on only a currently-`new` app. Screen switch off writes `revoked`, on writes `on`.
- RPC names `approvals.list` and `approvals.setEnabled`.
- Auto-approve log line, exact: `auto-approved Computer Use: <app> agent=<agentId>`.
- State file: `~/.paseo/plugin-data/computer-use-approvals/state.json` (builder call from the spec, fixed here). Shape `{ "apps": { [name]: { status, firstSeenAt, lastSeenAt, lastAutoApprovedAt } } }`, ISO timestamps, `lastAutoApprovedAt` nullable.
- Client UI: React Native primitives only, colors from `theme.colors`, respects `layout.compact`. No `document`, `window`, `className`, `onClick`.

## Review Focus

1. **Race: user clicks the card while the plugin answers it.** `respondToPermission` rejects for an already-resolved request; the hook must swallow it and still not crash or double-record. Test in Task 3.
2. **Corrupt or hand-edited state file.** Missing file starts empty. Unparseable or schema-invalid file must not be silently overwritten: rename it to `state.json.corrupt-<epochMs>`, log once, start empty. Test in Task 3.
3. **Lookalike prompts.** Same text from another server, `cua_repl` with other text (`Allow Codex to use "Paseo"?`), a non-Codex provider, or a shell-command card must be ignored entirely (not recorded). App names with spaces (`"Google Chrome"`) must match. Tests in Task 1.
4. **Two agents ask about a new app at once; the user allows the second card.** App becomes `on`. Test in Task 3.
5. **User revokes on the screen while a card for that app is still pending, then clicks Allow.** App stays `revoked`, because `.after` checks the status at resolution time, not at `.before` time. Test in Task 3.

---

### Task 1: Scaffold and matcher

**Files:**
- Create (via `paseo plugin init`, then edit): `paseo-plugin.json`, `package.json`, `tsconfig.json`, `OVERVIEW.md`, `.gitignore` (`node_modules/`)
- Create: `tsconfig.tests.json` (copy the sibling's: extends `tsconfig.json`, `types: ["node"]`, `allowImportingTsExtensions: true`, includes `tests/**/*.ts`, `shared/**/*.ts`)
- Delete: scaffold sample files `client/greeting.tsx`, `server/greeting.ts`, `shared/greeting.ts`; reduce `index.client.tsx` and `index.server.ts` to empty `contribute` functions returning `() => {}`
- Create: `shared/match.ts`
- Test: `tests/match.test.ts`

**Interfaces:**
- Produces: `matchComputerUseApp(request: MatchableRequest): string | null` where
  `type MatchableRequest = { name: string; provider: string; description?: string | null; metadata?: Record<string, unknown> | null }`
  (structurally compatible with `AgentPermissionRequest`).
- `package.json` scripts: `"typecheck": "tsc --noEmit -p tsconfig.json && tsc --noEmit -p tsconfig.tests.json"`, `"test": "node --test tests/*.test.ts"`; `"type": "module"`; `engines.node ">=22.18.0"`; the `imports` map from Global Constraints.

- [ ] **Step 1: Scaffold**

Run from `~/Developer/personal-project/paseo-computer-use-approvals`: `paseo plugin init "$PWD"` (if it refuses the non-empty directory, init into `$TMPDIR/cua-scaffold` and copy the files in, leaving `docs/` untouched). Set id, `name: "Computer Use approvals"`, description, `requirements.paseo: ">=0.14.0"`. Edit `package.json` per Interfaces and Global Constraints. `npm install`.

- [ ] **Step 2: Write the failing test** `tests/match.test.ts`

```ts
import assert from "node:assert/strict";
import test from "node:test";
import { matchComputerUseApp } from "#shared/match";

const card = (over: Partial<Parameters<typeof matchComputerUseApp>[0]> = {}) => ({
  name: "CodexMcpElicitation",
  provider: "codex",
  description: 'Allow Computer Use to use "Safari"?',
  metadata: { serverName: "cua_repl" },
  ...over,
});

test("quoted and unquoted app names", () => {
  assert.equal(matchComputerUseApp(card()), "Safari");
  assert.equal(matchComputerUseApp(card({ description: "Allow Computer Use to use Safari?" })), "Safari");
  assert.equal(matchComputerUseApp(card({ description: 'Allow Computer Use to use "Google Chrome"?' })), "Google Chrome");
});

test("lookalikes are ignored", () => {
  assert.equal(matchComputerUseApp(card({ metadata: { serverName: "node_repl" } })), null);
  assert.equal(matchComputerUseApp(card({ description: 'Allow Codex to use "Paseo"?' })), null);
  assert.equal(matchComputerUseApp(card({ provider: "claude" })), null);
  assert.equal(matchComputerUseApp(card({ name: "Bash" })), null);
  assert.equal(matchComputerUseApp(card({ description: 'Allow Computer Use to use "Safari"? Also run rm' })), null);
  assert.equal(matchComputerUseApp(card({ description: null, metadata: null })), null);
});
```

- [ ] **Step 3: Run it, expect FAIL** — `npm test` → cannot resolve `#shared/match`.

- [ ] **Step 4: Implement `matchComputerUseApp` in `shared/match.ts`** with the constants and regex from Global Constraints; return capture group 1 ?? group 2.

- [ ] **Step 5: Run** `npm test && npm run typecheck` → PASS, no type errors.

- [ ] **Step 6: Commit** — `git add -A && git commit -m "feat: scaffold plugin and Computer Use card matcher"`

---

### Task 2: State transitions

**Files:**
- Create: `shared/state.ts`
- Test: `tests/state.test.ts`

**Interfaces:**
- Consumes: nothing.
- Produces (all mutate `state` in place; `now` is an ISO string):
  - `type AppStatus = "new" | "on" | "revoked"`
  - `type AppRecord = { status: AppStatus; firstSeenAt: string; lastSeenAt: string; lastAutoApprovedAt: string | null }`
  - `type ApprovalsState = { apps: Record<string, AppRecord> }`
  - `const approvalsStateSchema` (Zod, `.default`s so `parse({})` → `{ apps: {} }`)
  - `recordSeen(state, app: string, now: string): AppStatus` — adds `{ status: "new", firstSeenAt: now, lastSeenAt: now, lastAutoApprovedAt: null }` if unknown, else updates `lastSeenAt`; returns the status.
  - `recordAutoApproved(state, app: string, now: string): void` — sets `lastAutoApprovedAt`.
  - `applyManualResolution(state, app: string, allowed: boolean): boolean` — `new` + allowed → `on`; returns whether it changed.
  - `setEnabled(state, app: string, enabled: boolean): AppRecord` — `on` / `revoked`; throws `Error("Unknown app: <app>")` for unknown names.
  - `listApps(state): Array<AppRecord & { name: string }>` sorted by name with `localeCompare`.

- [ ] **Step 1: Write the failing test** `tests/state.test.ts` with these cases (`T1`, `T2` fixed ISO strings):
  - unknown → `recordSeen` returns `"new"`, record has `firstSeenAt === lastSeenAt === T1`, `lastAutoApprovedAt === null`; second `recordSeen(T2)` keeps `firstSeenAt === T1`, `lastSeenAt === T2`.
  - `new` + `applyManualResolution(…, true)` → `"on"`, returns `true`.
  - `new` + `applyManualResolution(…, false)` → stays `"new"`; a later `applyManualResolution(…, true)` → `"on"`.
  - `setEnabled(…, false)` on `on` → `"revoked"`; then `applyManualResolution(…, true)` → stays `"revoked"`, returns `false`; `setEnabled(…, true)` → `"on"`.
  - `setEnabled` on unknown name throws `/Unknown app: Finder/`.
  - `listApps` returns `["Notes", "Safari"]` order for apps added as Safari then Notes.
  - `approvalsStateSchema.parse({})` deep-equals `{ apps: {} }`; parsing `{ apps: { X: { status: "maybe" } } }` throws.

- [ ] **Step 2: Run** `npm test` → FAIL (module missing).
- [ ] **Step 3: Implement** `shared/state.ts` per Interfaces.
- [ ] **Step 4: Run** `npm test && npm run typecheck` → PASS.
- [ ] **Step 5: Commit** — `git commit -am "feat: approval state transitions"` (add the new files first).

---

### Task 3: Store, hooks, RPCs, server entry

**Files:**
- Create: `shared/rpc.ts`, `server/store.ts`, `server/approvals.ts`
- Modify: `index.server.ts`
- Test: `tests/approvals.test.ts`

**Interfaces:**
- Consumes: `matchComputerUseApp` (Task 1); everything from `#shared/state` (Task 2).
- Produces:
  - `shared/rpc.ts`: `appEntrySchema` (Zod for `AppRecord & { name }`), `listApprovals = defineRpc({ name: "approvals.list", input: z.object({}), output: z.object({ apps: z.array(appEntrySchema) }) })`, `setApprovalEnabled = defineRpc({ name: "approvals.setEnabled", input: z.object({ name: z.string().min(1), enabled: z.boolean() }), output: appEntrySchema })`.
  - `server/store.ts`: `type ApprovalsStore = { state: ApprovalsState; save(): Promise<void> }`; `loadStore(filePath: string, log?: (msg: string) => void): ApprovalsStore` (sync read so `contribute` stays sync). Missing file → empty state. Unparseable / schema-invalid → `renameSync` to `<filePath>.corrupt-<Date.now()>`, `log("state file unreadable, moved to …")`, empty state. `save()` creates the parent dir, writes `<filePath>.tmp` then `rename` (atomic); calls are serialized through one promise chain so concurrent saves never interleave. The in-memory `state` is authoritative (this subprocess is the only writer).
  - `server/approvals.ts`: `registerApprovals(server: Pick<PluginServerContext, "addHook" | "handle">, store: ApprovalsStore, options?: { now?: () => string; log?: (msg: string) => void }): void`. Defaults: `now = () => new Date().toISOString()`, `log = console.log`.
  - `index.server.ts`: `registerApprovals(server, loadStore(join(homedir(), ".paseo", "plugin-data", "computer-use-approvals", "state.json")))`; return `() => {}`.

Behavior of `registerApprovals` (spec "Flow"):
- `agent.permission.before`: `app = matchComputerUseApp(request)`; `null` → return. `status = recordSeen(...)`. If `on`: `await paseo.agents.ref(agent.id).respondToPermission({ requestId: request.id, response: { behavior: "allow" } })` inside try/catch (on rejection skip `recordAutoApproved` and the log line, but still save); on success `recordAutoApproved`, log the exact line. Otherwise put `request.id → app` in a module-local `Map`. Always `await store.save()`.
- `agent.permission.after`: look up and delete `requestId` in the map; if found and `resolution.behavior === "allow"` and `applyManualResolution(...)` returns `true`, `await store.save()`.
- `server.handle(listApprovals, () => ({ apps: listApps(store.state) }))`; `server.handle(setApprovalEnabled, async ({ name, enabled }) => { const r = setEnabled(...); await store.save(); return { name, ...r }; })`.

- [ ] **Step 1: Write the failing test** `tests/approvals.test.ts`. Build a fake server that records `addHook` handlers by name and `handle` handlers by `contract.name`, and a fake `paseo` whose `agents.ref(id).respondToPermission` pushes `{ agentId, requestId, response }` into an array (and can be told to reject). Use a `mkdtempSync` dir for the store file. Helpers `before(app|desc, requestId, agentId)` and `after(requestId, behavior)` call the handlers with `{ agent: { id }, request }` / `{ agent: { id }, requestId, resolution: { behavior } }` and context `{ paseo, signal: new AbortController().signal }`. Cases:
  - first Safari card → no response sent; `approvals.list` shows Safari `new`; `after(allow)` → Safari `on`; next Safari card → one response `{ behavior: "allow" }` with the right `requestId`, `lastAutoApprovedAt` set, log captured equals `auto-approved Computer Use: Safari agent=a1`.
  - first card denied, second card allowed → `on`.
  - two concurrent first cards (r1, r2) for Notes; `after(r2, allow)` → `on`; `after(r1, deny)` afterward → still `on`.
  - Review Focus 5: Safari `new` with card r1 pending, `approvals.setEnabled({name:"Safari", enabled:false})`, `after(r1, allow)` → `revoked`; next Safari card → no response sent.
  - Review Focus 1: Safari `on`, fake `respondToPermission` rejects with `Error("already resolved")` → handler resolves (no throw), `lastAutoApprovedAt` unchanged.
  - non-matching request (`name: "Bash"`) → no response, `approvals.list` empty.
  - `setEnabled` for unknown name rejects `/Unknown app/`.
  - persistence: after Safari is `on`, `loadStore(samePath).state.apps.Safari.status === "on"`.
  - Review Focus 2: write `"{not json"` to the path; `loadStore` returns empty state, a `state.json.corrupt-*` file exists in the dir, log captured once.

- [ ] **Step 2: Run** `npm test` → FAIL (modules missing).
- [ ] **Step 3: Implement** `shared/rpc.ts`, `server/store.ts`, `server/approvals.ts`, `index.server.ts` per Interfaces.
- [ ] **Step 4: Run** `npm test && npm run typecheck` → PASS.
- [ ] **Step 5: Install and confirm it runs**

Run: `paseo plugin install "$PWD"` then `paseo plugin ls` → `computer-use-approvals` is `running`, no error. `paseo plugin logs computer-use-approvals` shows no errors. (These need the real daemon; run outside the sandbox.)

- [ ] **Step 6: Commit** — `git add -A && git commit -m "feat: auto-approve hooks, state store and RPCs"`

---

### Task 4: Sidebar item and screen

**Files:**
- Create: `client/approvals.tsx`
- Modify: `index.client.tsx`
- Test: none automated (UI); verified by typecheck, the audit grep and manual check.

**Interfaces:**
- Consumes: `listApprovals`, `setApprovalEnabled`, `appEntrySchema` from `#shared/rpc` (Task 3).
- Produces: `ApprovalsScreen(props: PluginScreenProps)`, `ApprovalsSidebarItem(props: PluginSidebarItemProps)` exported from `client/approvals.tsx`. `index.client.tsx` registers `client.addScreen({ id: "main", title: "Computer Use approvals", Component: ApprovalsScreen })` and `client.addSidebarHeaderItem({ id: "main", title: "Computer Use approvals", Component: ApprovalsSidebarItem })`, returns `() => {}`.

- [ ] **Step 1: Implement the sidebar item**: one `SidebarRow` (from `@getpaseo/plugin/client/ui`), icon `"MonitorCheck"`, `active={currentScreen?.screenId === "main"}`, `onPress={() => openScreen({ screenId: "main" })}`.

- [ ] **Step 2: Implement the screen**
  - `useQuery({ queryKey: ["approvals"], queryFn: () => list({}), refetchInterval: 5000 })` where `list = useRpc(listApprovals)`; `useMutation` around `useRpc(setApprovalEnabled)` that invalidates `["approvals"]` on settle.
  - Layout with `SettingsSection` (title "Apps") / `SettingsCard` / `SettingsSwitch` from `@getpaseo/plugin/client/ui`, one switch per app keyed by name: `value={app.status === "on"}`, disabled while that app's mutation is pending.
  - Hint per row: `new` → `Allow a card once, or switch on here`; otherwise `Last seen <relative or locale time>` plus ` · last auto-approved <time>` when set.
  - States: loading text; error text with the message; empty text exactly `Apps appear here after Codex asks to use one.`
  - Short explanatory line at the top: `Codex Computer Use cards for apps switched on are approved automatically on this host.`
  - All `Text` colored from `theme.colors.foreground` / `foregroundMuted`; root `backgroundColor: theme.colors.surface0`; padding from `layout.compact` (16 vs 24).

- [ ] **Step 3: Verify**

Run: `npm run typecheck` → no errors.
Run: `rg -n "document\.|window\.|localStorage|navigator\.|<[a-z]+[ >]|className=|onClick=" client/` → no hits.
Run: `paseo plugin reload computer-use-approvals && paseo plugin ls` → `running`.
Manual: the sidebar shows "Computer Use approvals"; the screen opens with the empty state (or rows if Task 5 ran first); check a narrow window and a dark and light theme.

- [ ] **Step 4: Commit** — `git add -A && git commit -m "feat: approvals sidebar item and screen"`

---

### Task 5: Overview and end-to-end check

**Files:**
- Modify: `OVERVIEW.md`

- [ ] **Step 1: Write `OVERVIEW.md`** (plain, sentence case, no em dashes, no install commands): what it does; that it approves on the user's behalf for apps switched on; exactly what it matches (`cua_repl`, the "Allow Computer Use to use …?" text, Codex only); where state lives (`~/.paseo/plugin-data/computer-use-approvals/state.json`, per host); that it never denies; that it is a stopgap for getpaseo/paseo#6368 and should be removed once a release includes #7719.

- [ ] **Step 2: End-to-end on this Mac** (spec "Verification")

Start a Paseo agent `codex/gpt-6.1-sol`, mode `auto-review`, prompt: read-only, report Safari's frontmost window title, then read Safari's UI state again; no clicks or typing.
Expected: first card appears and the screen shows Safari *off* with the `new` hint → click Allow → Safari switches *on* in the screen within 5 s → the second card never waits (`paseo plugin logs computer-use-approvals` shows `auto-approved Computer Use: Safari agent=<id>`).
Then switch Safari off in the screen, run the same prompt: the card waits; click Allow; Safari stays off.
Confirm a non-Computer-Use card (e.g. a shell command approval in a Codex agent in `auto` mode) is untouched.

- [ ] **Step 3: Commit** — `git add -A && git commit -m "docs: plugin overview"`

- [ ] **Step 4: Home Mac** (user-run, after upgrading Paseo there to ≥0.14.0 and enabling plugins): clone or copy the repo, `npm install`, `paseo plugin install <path>`, repeat Step 2's first check.
