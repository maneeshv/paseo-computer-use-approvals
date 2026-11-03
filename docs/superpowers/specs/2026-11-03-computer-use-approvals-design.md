# Computer Use approvals: Paseo plugin design

Date: 2026-11-03
Status: draft for review

## Intent

Codex agents running in Paseo cannot use Computer Use unattended. Every call to an app
("Allow Computer Use to use Safari?") produces a new approval card, even right after the
same app was allowed. The cause is Paseo bug
[getpaseo/paseo#6368](https://github.com/getpaseo/paseo/issues/6368): Paseo drops the
MCP elicitation `_meta.persist` options when it parses the request and always replies with
`_meta: null`, so Codex never stores the approval. The upstream fix is
[getpaseo/paseo#7719](https://github.com/getpaseo/paseo/pull/7719), which is open and unmerged
as of this date (latest stable v0.14.0, latest beta v0.15.0-beta.1).

A plugin cannot apply the real fix, because its answer goes through the same reply code and it
never sees `_meta`. It can answer repeat cards on Paseo's side instead. This plugin does that,
per app, with a screen where the user sees which apps Codex has asked about and turns
auto-approval on or off for each one.

This is a stopgap. Delete it once a Paseo release includes #7719.

## Goals

- Repeat Computer Use app-access cards for apps the user has approved are answered "allow"
  automatically, so Codex agents keep running.
- The user approves an app once, on the normal card, and the plugin remembers it.
- A sidebar item opens a screen that lists every app Codex has asked about on that host,
  with an on/off switch per app. Off means the normal card is shown (revoke).
- Works on both of the user's Macs. Each Mac (Paseo host) has its own list.

## Non-goals

- Making Codex itself persist the approval (needs #7719).
- Listing apps installed on the Mac or apps Codex has never asked about.
- Syncing the list between hosts.
- Publishing to npm or the Paseo registry. Installed from a local path on each Mac.
- Supporting Paseo older than 0.14.0.

## Anti-goals (failure even if it works)

- Approving anything that is not a Computer Use app-access card for an app the user turned on.
  The matching must be strict. A loose match that auto-approves another MCP server's prompt,
  a shell command, or a plan is the worst outcome.
- Ever answering "deny". The plugin only answers "allow" or leaves the card alone.
- Silently turning an app back on after the user revoked it.

## Constraints and verified facts

Environment: Paseo daemon 0.14.0 on both Macs (the user will upgrade the home Mac, which was on
0.13.2, and enable plugins there). `@getpaseo/plugin` latest is 0.15.0.

Verified against `packages/server/src/server/agent/providers/codex-app-server-agent.ts` at tag
v0.14.0 (`handleMcpElicitationRequest`, around line 7166). A Codex MCP elicitation becomes an
`AgentPermissionRequest` with:

| Field                  | Value                                                         |
| ---------------------- | ------------------------------------------------------------- |
| `provider`             | Codex provider id (`CODEX_PROVIDER`)                          |
| `name`                 | `"CodexMcpElicitation"`                                       |
| `kind`                 | `"tool"`                                                      |
| `title`                | `` `MCP approval: ${serverName}` ``                           |
| `description`          | the elicitation `message`, e.g. `Allow Computer Use to use Safari?` |
| `metadata.serverName`  | MCP server name                                               |
| `input.mode`           | `"form"` or `"openai/form"` (`url` mode is auto-declined by Paseo and never reaches plugins) |

The reply for `behavior: "allow"` is `{ action: "accept", content: {}, _meta: null }`.

From the bug report, Codex tags these requests with `connector_id: "computer-use"` inside
`_meta`, which Paseo drops. **The exact `metadata.serverName` for Computer Use has not been
observed.** It is probably `computer-use`, but the builder must confirm it (see Build order).

Plugin API (Paseo 0.14+, verified in `public-docs/plugins/hooks.md` and the 0.15.0 package types):

- `server.addHook("agent.permission.before", async ({ agent, request }, { paseo }) => …)`:
  notification, Paseo does not wait. Answer with
  `paseo.agents.ref(agent.id).respondToPermission({ requestId: request.id, response: { behavior: "allow" } })`.
  Responding to an already-resolved request throws.
- `server.addHook("agent.permission.after", async ({ agent, requestId, resolution }) => …)`:
  fires on every resolution. It carries only `requestId`, not the request, so the plugin must
  remember the matched request from `.before`, keyed by `requestId`.
- `server.registerSettings(...)` gives the server only `read()` and `subscribe()`. **The server
  cannot write Paseo settings.** Paseo also gives plugins no data directory. Therefore state lives
  in a plugin-owned JSON file (below), not in `defineSettings`.
- `server.handle(rpc, handler)` plus `useRpc` on the client for the screen.
- `client.addScreen` plus `client.addSidebarHeaderItem` (or `addSidebarFooterItem`) with
  `SidebarRow`. Settings UI components (`SettingsSection`, `SettingsCard`, `SettingsSwitch`,
  `SettingsRow`) from `@getpaseo/plugin/client/ui` may be used inside a screen.
- `paseo-plugin.json` `requirements.paseo`: `">=0.14.0"`.

## Behavior

### Matching a card

A pending request is a **Computer Use card** only if all of these hold:

1. `request.name === "CodexMcpElicitation"`
2. `request.provider` is the Codex provider
3. `request.metadata.serverName` equals the confirmed Computer Use server name (one constant)
4. `request.description` matches exactly `^Allow Computer Use to use (.+)\?$`; capture group 1
   is the **app name**, used verbatim (case-sensitive, no trimming beyond the regex)

Anything else is ignored entirely: not recorded, not answered.

### State

One JSON file per host:
`{ apps: { [appName]: { status: "new" | "on" | "revoked", firstSeenAt, lastSeenAt, lastAutoApprovedAt | null } } }`.

| Status    | Meaning                                                     | Leaves the state when               |
| --------- | ----------------------------------------------------------- | ----------------------------------- |
| `new`     | Codex has asked; the user has never allowed it              | any manual Allow on a card → `on`; screen switch on → `on` |
| `on`      | auto-approve                                                | screen switch off → `revoked`       |
| `revoked` | user switched it off on the screen; cards are shown         | screen switch on → `on` only        |

The screen shows `new` and `revoked` both as "off"; `new` rows may carry a hint such as
"Allow a card once, or switch on here".

### Flow

On `agent.permission.before` for a Computer Use card with app `A`:

- `A` unknown: add a row `{ status: "new" }` with timestamps, then treat as `new`.
- `A` is `new` or `revoked`: update `lastSeenAt`, remember `request.id → A` in memory, leave
  the card for the user.
- `A` is `on`: call `respondToPermission(allow)`, update `lastSeenAt` and
  `lastAutoApprovedAt`, and log one line (`auto-approved Computer Use: <A> agent=<id>`).
  If the call throws because the request is already resolved, ignore it.

On `agent.permission.after`:

- If `requestId` is remembered for app `A`, `resolution.behavior === "allow"`, and `A` is
  **currently** `new` (re-read the file, not the status at `.before` time), set `A` to `on`.
- A manual Allow on a `revoked` app is a one-time approval and does **not** turn it back on.
  Only the screen does that. (Confirmed with the user.)
- Deny, cancel, or dismissal leaves `A` as it was. The next manual Allow on any later card for
  a `new` app still turns it on, so a denied first card, two concurrent cards, or a lost
  in-memory entry after a restart never leave an app stuck.
- Forget the remembered `requestId` either way. The in-memory map does not need to survive
  restarts: a card left open across a restart simply is not recorded, and the next card is.

### Screen

- Sidebar item titled "Computer Use approvals" (Lucide icon, e.g. `MonitorCheck`) opens the
  plugin screen on that host.
- The screen lists every known app, sorted by name, each row with:
  - app name
  - a switch: on = `on`; off = `new` or `revoked` (switching off always writes `revoked`)
  - a hint line with last seen and last auto-approved time
- Empty state: a short line saying apps appear here after Codex asks to use one.
- Toggling calls an RPC that writes the file. Changes apply to the next card with no reload.
- The screen refetches on open and on a short interval while open (live push is not needed).
- Follows Paseo plugin UI rules: React Native primitives only, colors from `theme.colors`,
  works with `layout.compact`.

### RPCs (shared Zod contracts)

- `approvals.list` → `{ apps: Array<{ name, status, firstSeenAt, lastSeenAt, lastAutoApprovedAt }> }`
- `approvals.setEnabled({ name, enabled })` → updated app. `true` writes `on`, `false` writes
  `revoked`. Rejects unknown names (the screen
  cannot invent apps).

## Build order

1. Scaffold with `paseo plugin init`, set `requirements.paseo` to `>=0.14.0`.
2. **Confirm the server name first.** Add a temporary `agent.permission.before` hook that logs
   `name`, `provider`, `metadata.serverName`, and `description` for every request. Run a Codex
   agent that uses Computer Use on Safari, read `paseo plugin logs`, set the constant, remove
   the logging.
3. Matcher, state file, hooks, RPCs, then the screen.
4. One small runnable test for the matcher and the state transitions: unknown → `new`;
   `new` + manual allow → `on`; `new` + deny, then a later manual allow → `on`; `on` →
   auto-approve; screen off → `revoked`; `revoked` + manual allow → stays `revoked`;
   non-matching request untouched.
5. Write `OVERVIEW.md` stating plainly that this auto-approves on the user's behalf, what it
   matches, and that it should be removed once #7719 ships.

## Verification

- `npm run typecheck`, the test, `paseo plugin install <path>`, `paseo plugin ls` shows `running`.
- Real run on this Mac: first Safari card appears; click Allow; Safari row appears switched on;
  the next Safari card is answered without a click; log line present.
- Turn Safari off in the screen; next Safari card waits for the user; clicking Allow does not
  turn it back on.
- A non-Computer-Use card (for example a shell command approval or a `node_repl` MCP card)
  is untouched.
- Repeat install and the Safari check on the home Mac.

## Decided with the user

- Apps listed = every app Codex has asked about on that host.
- The first manual Allow on a card for a `new` app turns it on; the screen can switch any app
  on or off afterward.
- **Revoked stays revoked**: a manual Allow on a revoked app's card is one-time. Only the screen
  turns it back on.
- A sidebar item and screen are required.

## Calls made by the designer (review these)

- **node_repl is out of scope.** The same bug repeats `MCP approval: node_repl` cards
  ("Allow Codex to use Paseo?"). This plugin matches Computer Use only.
- **State file, not Paseo settings**, because server code cannot write settings.
- **No delete-row action.** Rows only switch on and off.
- **No live push to the screen**; it refetches while open.
- **Plugin id and repo name**: `computer-use-approvals` in
  `~/Developer/personal-project/paseo-computer-use-approvals`.

## Left to the builder

- State file location and atomic write approach. Something under the user's home on the daemon
  machine, stable across plugin reloads and updates.
- Refetch interval, timestamp formatting, exact copy and icon.
- Test runner choice (keep it to one file).
- Header vs footer sidebar placement.
