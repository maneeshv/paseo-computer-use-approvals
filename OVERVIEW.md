Computer Use approvals answers repeat Codex Computer Use prompts for you. When a Codex agent asks "Allow Computer Use to use Safari?", you allow it once and the plugin approves later prompts for that app automatically, so the agent can keep working unattended.

It is a stopgap for a Paseo bug ([getpaseo/paseo#6368](https://github.com/getpaseo/paseo/issues/6368)) where Paseo drops Codex's "remember this" choice, so Codex asks again on every call. Remove the plugin once a Paseo release includes [#7719](https://github.com/getpaseo/paseo/pull/7719).

## How it works

- The first time Codex asks about an app, the app appears on the Computer Use approvals screen in the sidebar, switched off, and you answer the prompt as usual.
- Your first Allow for that app switches it on. From then on, the plugin approves that app's prompts on your behalf.
- Switch an app off on the screen to revoke it. Prompts for a revoked app wait for you again, and allowing one of them is a one-time answer. Only the screen switches a revoked app back on.
- The plugin only ever approves or leaves a prompt alone. It never denies anything.

## What it matches

Only Codex prompts from the Computer Use server (`cua_repl`) whose text is exactly "Allow Computer Use to use …?". Every other prompt, including other MCP servers, shell commands, and plans, is ignored.

## Setup and limits

Requires Paseo 0.14.0 or later with plugins enabled. The app list is stored per host in `~/.paseo/plugin-data/computer-use-approvals/state.json` and is not synced between machines. Codex still sends a request on every call; the plugin answers it immediately. Each auto-approval is logged in the plugin logs.
