# Contributing

Small, focused issues and pull requests are welcome. For a larger change, open an issue describing the user problem before implementing it. Follow the [code of conduct](CODE_OF_CONDUCT.md).

## Local development

Fork and clone the repository, then use Node.js 22.18 or later (see `.nvmrc`):

```sh
npm ci --ignore-scripts
npm run typecheck
npm test
```

The tests use a fake Paseo server and a temporary state file; they do not need Codex, Computer Use, or a running Paseo daemon. Host SDK packages are development dependencies because Paseo supplies the runtime modules. `private: true` prevents accidental npm publication; distribution is through Git.

For manual testing on a trusted development daemon:

```sh
paseo plugin install "$PWD" --id computer-use-approvals-dev --json
paseo plugin reload computer-use-approvals-dev --json
paseo plugin logs computer-use-approvals-dev --json
```

Do not run two installations of this plugin on the same daemon unless you intend to: both would answer the same prompts and share the same state file. Do not restart the daemon.

## Before submitting

- Run typecheck and tests. Add regression coverage for behavioral changes.
- Explain the problem, the changed behavior, and how you verified it.
- Changes to matching need evidence of the real request shape (provider, name, server name, text) and a test. Never broaden what gets approved without it.
- For UI changes, include screenshots with private task names, paths, and conversations removed.
- Update public docs and the manifest's Paseo compatibility range when behavior or API requirements change.
- Keep the runtime boundaries and import aliases described in [AGENTS.md](AGENTS.md).
- Use Conventional Commit titles such as `fix: ignore prompts from other MCP servers`.

Do not include credentials, state files, or private agent output. Report security problems privately as described in [SECURITY.md](SECURITY.md).

By contributing, you agree that your contribution is licensed under the repository's MIT License. No separate contributor agreement is required.

## Optional GitHub Actions setup

The repository includes a ready-to-use CI template at [docs/ci.yml.example](docs/ci.yml.example). It is not active: the publishing account's GitHub CLI token does not currently have the `workflow` scope. Local checks above remain the verification path.

A maintainer who wants automated checks can authorize that scope using `gh auth refresh -h github.com -s workflow`, then copy the template to `.github/workflows/ci.yml`, commit, and push it. The template runs the same lockfile installation, typecheck, and tests on Node.js 22 with read-only repository permissions.
