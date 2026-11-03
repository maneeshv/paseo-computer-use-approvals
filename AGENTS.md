# Repository instructions

## Scope and structure

This is a trusted local Paseo plugin, not Paseo core. It approves permission requests on the user's behalf, so prefer the smallest complete change and keep its behavior narrow.

- `index.server.ts`: loads the state file and registers the approval logic.
- `server/approvals.ts`: permission event handlers and RPC handlers.
- `server/store.ts`: JSON state file with atomic, serialized writes and corrupt-file handling.
- `index.client.tsx`: sidebar item and screen registration.
- `client/approvals.tsx`: React Native sidebar row and approvals screen.
- `shared/match.ts`: decides whether a request is a Computer Use app-access prompt.
- `shared/state.ts`: pure app-state transitions (`new`, `on`, `revoked`) and the state schema.
- `shared/rpc.ts`: Zod RPC contracts shared by both runtimes.
- `tests/`: `node --test` suites for the matcher, state transitions, and handler flows.
- `docs/superpowers/`: design spec and implementation plan. Read the spec before changing behavior.

## Conventions

- Use TypeScript and the package `imports` aliases (`#shared/*`, `#server/*`, `#client/*`) for project code instead of relative imports.
- Use npm with the committed lockfile. Do not add dependencies for a few lines of code.
- Check the installed SDK types in `node_modules/@getpaseo/plugin/dist` and official documentation before using APIs. Use Context7 when available; otherwise verify against pinned source instead of inventing APIs.
- Keep React Native UI themed and accessible: React Native primitives only, colors from `theme.colors`, padding from `layout.compact`. Never import server code or Node modules into client code.
- Keep matching strict. A request is auto-approved only for provider `codex`, name `CodexMcpElicitation`, server `cua_repl`, the exact "Allow Computer Use to use …?" text, and an app the user switched on. Do not broaden matching without new evidence of the real request shape and a test for it.
- The plugin only ever answers `allow` or leaves a request alone. Never deny, and never answer requests that are not Computer Use app-access prompts.
- A manual Allow turns on only a `new` app. Revoked apps change only through the screen.
- Treat app names as untrusted input: look up records with own-property checks, never through inherited object properties.
- Never commit credentials, state files, personal paths, private agent output, local screenshots, or dependency directories.
- Use `trash` for manual deletions when available; otherwise ask before deleting files.
- Use Conventional Commit messages, for example `fix: ignore prompts from other MCP servers`.

## Verification

Run `npm ci --ignore-scripts`, `npm run typecheck`, and `npm test` from the repository root. Add a small regression test for any behavior change, especially in matching or state transitions.

For UI changes, check wide and narrow layouts and light and dark themes. For matching changes, capture a real request (provider, name, `metadata.serverName`, description) before writing code, and record it in the spec.

Reload only a development installation the user has authorized. Never restart the user's Paseo daemon. Installing on other machines, publishing, or changing global plugin trust requires authorization.

Keep README.md, OVERVIEW.md, VALIDATION.md, and the manifest's Paseo version range accurate. Do not claim compatibility beyond what was checked.
