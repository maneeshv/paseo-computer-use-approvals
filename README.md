# Paseo Computer Use approvals

Approve a Codex Computer Use app once in Paseo, and stop answering the same prompt on every call.

This is a community plugin, not an official OpenAI or Paseo product. It is a stopgap for [getpaseo/paseo#6368](https://github.com/getpaseo/paseo/issues/6368). Remove it once a Paseo release includes [getpaseo/paseo#7719](https://github.com/getpaseo/paseo/pull/7719).

## Why it exists

When a Codex agent in Paseo uses Computer Use, Codex asks "Allow Computer Use to use "Safari"?" and offers to remember the choice. Paseo drops that remember option and always replies "don't remember", so Codex asks again on every call to the same app. An agent that reads Safari three times shows three approval cards, and it cannot run unattended.

A plugin cannot make Codex save the approval: its answer goes through the same Paseo reply path. Instead, this plugin answers the repeat prompts in Paseo for apps you have approved.

## What it does

- Watches Codex permission requests and picks out Computer Use app-access prompts.
- Lists every app Codex has asked about on a **Computer Use approvals** screen in the sidebar, with a switch per app.
- Switches an app on the first time you click **Allow** on its prompt. After that, prompts for that app are approved automatically.
- Lets you switch any app off (revoke) or back on from the screen.
- Leaves every other prompt for you. It never denies anything.

| App state | Meaning | Changes when |
| --- | --- | --- |
| New | Codex has asked; you have not allowed it yet | Your first **Allow** on a prompt, or switching it on, makes it **On** |
| On | Prompts are approved automatically | Switching it off makes it **Revoked** |
| Revoked | You switched it off; prompts wait for you | Only switching it on in the screen makes it **On** again. Allowing a prompt for a revoked app is a one-time answer |

## Requirements

| Component | Compatibility |
| --- | --- |
| Paseo app and daemon | 0.14.x, with plugins enabled. SDK pinned to 0.14.0 |
| Codex | Tested with Codex CLI 0.162.1 and the Codex Computer Use app 26.1022.1001641 on macOS |
| Development | Node.js 22.18 or later and npm; lockfile included |

The plugin uses Paseo's `agent.permission_requested` and `agent.permission_resolved` plugin events. Paseo marks them deprecated and supports them until 2027-04-30. Only macOS has been tested.

## Install

Paseo plugins are trusted, unsandboxed code. Review the source before enabling plugins in **Settings → Plugins**, and only enable them on a daemon you trust.

```sh
git clone https://github.com/maneeshv/paseo-computer-use-approvals.git
cd paseo-computer-use-approvals
npm ci --ignore-scripts
npm run typecheck
npm test
paseo plugin install "$PWD" --id computer-use-approvals --json
```

Run these on the daemon host and keep the cloned directory in place: Paseo installs from that local path. Repeat on each machine that runs a Paseo daemon. Each host keeps its own app list.

## Use

1. Ask a Codex agent to do something with Computer Use, for example read the title of Safari's front window.
2. The first prompt for an app appears as usual. The app shows up on the **Computer Use approvals** screen as off.
3. Click **Allow**. The app switches on, and later prompts for it are approved within about a second.
4. Open **Computer Use approvals** from the sidebar to see each app, when it was last seen and last auto-approved, and to switch apps on or off.

After pulling updates, run the checks and reload:

```sh
paseo plugin reload computer-use-approvals --json
```

To stop using it:

```sh
paseo plugin disable computer-use-approvals --json
```

## What it matches

A prompt is approved automatically only when all of these hold:

- It comes from a Codex agent (`provider` is `codex`) as an MCP approval request (`CodexMcpElicitation`).
- The MCP server is `cua_repl`, the server Codex Computer Use uses.
- The text is exactly `Allow Computer Use to use "<App>"?` (the unquoted form is also accepted).
- `<App>` is switched on.

Other MCP servers (for example `node_repl` prompts such as "Allow Codex to use Paseo?"), shell commands, file edits, plans, and questions are ignored and never recorded.

## Data and permissions

The plugin approves Computer Use access on your behalf for apps you switch on. That is broader than Codex's own per-app choice, which is why matching is strict and every auto-approval is logged:

```sh
paseo plugin logs computer-use-approvals --json
```

Each auto-approval logs `auto-approved Computer Use: <App> agent=<agent id>`. A failed attempt logs `auto-approve skipped: …` and leaves the prompt for you.

Paseo does not say who answered a prompt. An **Allow** sent by another agent, for example an orchestrator answering its child's prompt through Paseo's tools, also switches a new app on.

The app list is stored on the daemon host in `~/.paseo/plugin-data/computer-use-approvals/state.json`. It contains app names, states, and timestamps. Nothing is sent anywhere else. An unreadable state file is moved aside to `state.json.corrupt-<time>` instead of being overwritten. The plugin holds the list in memory while it runs, so stop or reload the plugin before editing the file by hand.

## Known limits

- Codex still sends a request on every call; the plugin just answers it.
- Paseo still sends a "needs permission" notification when a prompt appears, before the plugin answers it.
- Prompts already waiting when you switch an app on are not approved retroactively. Answer them once.
- App lists are per host and are not synced between machines.

## Troubleshooting

- **No sidebar item:** confirm plugins are enabled and `paseo plugin ls` shows `computer-use-approvals` as `running`. Sidebar items can also be hidden in Paseo settings.
- **Prompts still wait:** open the screen and check that the app is on. Check the logs for `auto-approve skipped`. If Codex changes its prompt text or server name, the plugin stops matching; report it with the prompt text.
- **An app is missing from the list:** it appears only after Codex has asked about it on this host.

## Contribute

See [CONTRIBUTING.md](CONTRIBUTING.md), [AGENTS.md](AGENTS.md), and the [code of conduct](CODE_OF_CONDUCT.md). Report vulnerabilities privately as described in [SECURITY.md](SECURITY.md). Validation notes are in [VALIDATION.md](VALIDATION.md). The design spec and implementation plan are in [docs/superpowers](docs/superpowers).

Licensed under the [MIT License](LICENSE).
