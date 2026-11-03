import { homedir } from "node:os";
import { join } from "node:path";
import type { PluginServerContext } from "@getpaseo/plugin/server";
import { registerApprovals } from "#server/approvals";
import { loadStore } from "#server/store";

const STATE_FILE = join(homedir(), ".paseo", "plugin-data", "computer-use-approvals", "state.json");

export default function contribute(server: PluginServerContext) {
  registerApprovals(server, loadStore(STATE_FILE));
  return () => {};
}
