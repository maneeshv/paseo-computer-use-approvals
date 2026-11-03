# Security

## Reporting a vulnerability

Use [GitHub private vulnerability reporting](https://github.com/maneeshv/paseo-computer-use-approvals/security/advisories/new). Do not publish credentials, exploit details, or private conversation content in a public issue. If private reporting is unavailable, open an issue asking for a private contact without disclosing the vulnerability.

Include the affected commit, Paseo, Codex, and Computer Use versions, operating system, reproduction steps using non-sensitive data, and expected versus actual behavior. This is a community project; there is no guaranteed response time. Fixes target the latest main branch, not older snapshots.

Reports that matter most: any request other than a Computer Use app-access prompt for an app the user switched on being approved, or an app turning on without the user's action.

## Trust model

Paseo plugins are trusted, unsandboxed programs. This plugin approves Codex Computer Use access on the user's behalf for apps they switch on. Computer Use can see and control those apps, so an app switched on here can be driven by any Codex agent on that daemon without a further prompt. Only switch on apps you are comfortable with any of your Codex agents using.

Approval decisions are made on the daemon host from the request's provider, name, MCP server name, and text. Paseo does not identify who answered a prompt, so an Allow sent by another agent or plugin also switches a new app on. Anyone who can use the daemon or its plugin RPCs can switch apps on or off; this plugin is not a separate authorization layer.

The state file at `~/.paseo/plugin-data/computer-use-approvals/state.json` holds app names, states, and timestamps. Anyone who can write it and reload the plugin can change which apps are approved.

## Dependency status

On 2026-11-03, `npm audit` reported 12 moderate findings in the pinned React Native development dependency chain, originating from a minimatch denial-of-service advisory. There were no high or critical findings. npm's suggested direct-package update changes the React Native version supplied by Paseo; do not apply `npm audit fix --force` without checking host compatibility. These packages support local typechecking and tests; Paseo supplies its own runtime modules. Audit results for this lockfile do not assess Paseo's runtime dependencies.
