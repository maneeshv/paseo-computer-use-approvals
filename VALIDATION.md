# Validation

## Compatibility update (2026-11-22)

- Manifest admission range: `>=0.14.0`, without an arbitrary minor-version ceiling. Development dependencies remain pinned to 0.15.0. Admission is separate from tested coverage.
- `npm ci --ignore-scripts`, `npm run typecheck`, and `npm test` passed against the committed lockfile (21 tests). Full source and test typechecks and the same 21 unit tests also passed with SDK/protocol 0.14.0 and 0.17.2 installed temporarily using `npm install --ignore-scripts --no-save --package-lock=false @getpaseo/plugin@<version> @getpaseo/protocol@<version>`. The lockfile was unchanged; the pinned dependency installation was restored with `npm ci --ignore-scripts`.
- Inspected published SDK declarations: 0.14.0 has only legacy `on`; 0.15.0 and 0.17.2 expose `addHook`. The two permission payloads retain agent/request correlation. The plugin selects modern hooks when present, falling back only on hosts without `addHook`, preserving the actual minimum. Current [hook documentation](https://paseo.sh/docs/plugins/hooks) describes the renamed hooks and legacy removal after 2027-04-30; its general claim that `addHook` is available from 0.14 does not match the published 0.14.0 package.
- Regression coverage runs both registration paths: exact agent/request correlation, colliding request IDs across agents, unknown and consumed resolutions, successful auto-approval, other-server rejection, revoked apps, and unregister/forget on teardown. Existing matcher, failed-response, state, and persistence checks remain in place. No matching policy was broadened.
- This is compile and synthetic handler evidence, not live compatibility proof. No install, reload, daemon start/restart, UI capture, or actual permission response was performed. New live app/daemon acceptance, including 0.17.2, remains unrun. Future API changes can still break a minimum-only range.

## Historical live evidence (prior revision)

Tested locally on 2026-11-03 on macOS with Paseo app and daemon 0.14.0, `@getpaseo/plugin` 0.14.0, Codex CLI 0.162.1, and the Codex Computer Use app 26.1022.1001641. Agents used `codex/gpt-6.1-sol` in Auto-review mode.

- `npm ci --ignore-scripts`, `npm run typecheck`, and `npm test` passed: 19 checks covering the matcher (quoted and unquoted names, names with spaces, other servers, other text, other providers, other request types), state transitions, inherited-property app names, the race with a user answer, a denied first prompt, two concurrent first prompts, revoking while a prompt is pending, persistence, and a corrupt state file.
- The real request shape was captured from a live probe agent reading Safari: name `CodexMcpElicitation`, provider `codex`, title `MCP approval: cua_repl`, `metadata.serverName` `cua_repl`, text `Allow Computer Use to use "Safari"?`, `elicitationId` null. The probe also reproduced the bug: after Allow, the next call in the same turn prompted again with an identical request.
- The plugin installed from this directory reported `running`; logs showed Plugin ready without errors. The `#shared/*`, `#server/*`, and `#client/*` import aliases resolved in Paseo's plugin build.
- End to end with the installed plugin: a read-only Safari agent's first prompt waited and Safari was recorded as new. Allowing it switched Safari on. The agent's next two Safari prompts were approved by the plugin (two `auto-approved Computer Use: Safari` log lines) and the agent finished without further answers. The first Allow was sent through Paseo's permission API by the orchestrating agent, not by a click in the app.
- Paseo still sent a permission notification for each auto-approved prompt, at the time the prompt appeared.

Not yet verified: the screen's appearance in the Paseo app (wide and narrow windows, light and dark themes), switching an app off and on from the screen in the live app, that a non-Computer-Use prompt is left alone in the live app (covered by tests only), Windows and Linux, and native mobile.
- At that historical checkpoint, the manifest range was `>=0.14.0 <0.16.0`.

## Paseo 0.15

Checked on 2026-11-04 after building against `@getpaseo/plugin` and `@getpaseo/protocol` 0.15.0:

- `npm run typecheck` and `npm test` passed (19 tests).
- Compared the 0.14.0 and 0.15.0 SDK declarations. 0.15 adds `addHook` with renamed hooks (`agent.permission.before`, `agent.permission.after`) and keeps `on("agent.permission_requested" | "agent.permission_resolved")` as deprecated aliases that map to them, with identical payloads. `AgentPermissionRequest`, `AgentPermissionResponse`, `respondToPermission`, `defineRpc`, `useRpc`, and the client UI components used here are unchanged. That revision kept the old names because the 0.14.0 SDK has no `addHook`. The current revision instead selects modern hooks when available, keeping the fallback for 0.14.0.
- After `paseo plugin reload computer-use-approvals`, the plugin installed from this directory reported `running` on a local 0.15.0 daemon; logs showed Plugin ready.
- The installed 0.15.0 daemon maps `agent.permission_requested` to `agent.permission.before` and `agent.permission_resolved` to `agent.permission.after`, so the deprecated names are still routed at runtime.
- Not yet verified: an end-to-end auto-approval on 0.15, and running this build on a 0.14 daemon.
