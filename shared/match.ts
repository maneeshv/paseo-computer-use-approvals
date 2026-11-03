// Observed on Paseo 0.14.0: Computer Use app-access cards arrive as Codex MCP
// elicitations from the `cua_repl` server. See the design spec, "Observed card".
const COMPUTER_USE_SERVER = "cua_repl";
const COMPUTER_USE_PROMPT = /^Allow Computer Use to use (?:"([^"]+)"|([^"?]+))\?$/;

export type MatchableRequest = {
  name: string;
  provider: string;
  description?: string | null;
  metadata?: Record<string, unknown> | null;
};

/** Returns the app name when the request is a Computer Use app-access card, otherwise null. */
export function matchComputerUseApp(request: MatchableRequest): string | null {
  if (request.name !== "CodexMcpElicitation" || request.provider !== "codex") return null;
  if (request.metadata?.serverName !== COMPUTER_USE_SERVER) return null;
  const match = COMPUTER_USE_PROMPT.exec(request.description ?? "");
  return match ? (match[1] ?? match[2]) : null;
}
