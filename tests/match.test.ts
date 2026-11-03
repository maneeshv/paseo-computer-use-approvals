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
