import type { PluginServerContext } from "@getpaseo/plugin/server";
import { matchComputerUseApp } from "#shared/match";
import { listApprovals, setApprovalEnabled } from "#shared/rpc";
import { applyManualResolution, listApps, recordAutoApproved, recordSeen, setEnabled } from "#shared/state";
import type { ApprovalsStore } from "#server/store";

type Options = { now?: () => string; log?: (msg: string) => void };

export function registerApprovals(
  server: Pick<PluginServerContext, "on" | "handle">,
  store: ApprovalsStore,
  { now = () => new Date().toISOString(), log = console.log }: Options = {},
): void {
  // Cards left for the user, so the after-hook knows which app a resolution belongs to.
  const pending = new Map<string, string>();

  server.on("agent.permission_requested", async ({ agent, request }, { paseo }) => {
    const app = matchComputerUseApp(request);
    if (app === null) return;
    const status = recordSeen(store.state, app, now());
    if (status === "on") {
      try {
        await paseo.agents.ref(agent.id).respondToPermission({
          requestId: request.id,
          response: { behavior: "allow" },
        });
        recordAutoApproved(store.state, app, now());
        log(`auto-approved Computer Use: ${app} agent=${agent.id}`);
      } catch {
        // The user answered first, or the request was cleared. Nothing to do.
      }
    } else {
      pending.set(request.id, app);
    }
    await store.save();
  });

  server.on("agent.permission_resolved", async ({ requestId, resolution }) => {
    const app = pending.get(requestId);
    if (app === undefined) return;
    pending.delete(requestId);
    if (applyManualResolution(store.state, app, resolution.behavior === "allow")) await store.save();
  });

  server.handle(listApprovals, () => ({ apps: listApps(store.state) }));
  server.handle(setApprovalEnabled, async ({ name, enabled }) => {
    const record = setEnabled(store.state, name, enabled);
    await store.save();
    return { name, ...record };
  });
}
