import type { PluginServerContext, PluginLifecycleEvents, PluginHookContext } from "@getpaseo/plugin/server";
import { matchComputerUseApp } from "#shared/match";
import { listApprovals, setApprovalEnabled } from "#shared/rpc";
import { applyManualResolution, listApps, recordAutoApproved, recordSeen, setEnabled } from "#shared/state";
import type { ApprovalsStore } from "#server/store";

type PermissionEvents = {
  "agent.permission.before": PluginLifecycleEvents["agent.permission_requested"];
  "agent.permission.after": PluginLifecycleEvents["agent.permission_resolved"];
};
type PermissionHandler<Name extends keyof PermissionEvents> =
  (event: PermissionEvents[Name], context: PluginHookContext) => Promise<void>;
type ApprovalsServer = Pick<PluginServerContext, "on" | "handle"> & {
  addHook?: {
    (name: "agent.permission.before", handler: PermissionHandler<"agent.permission.before">): () => void;
    (name: "agent.permission.after", handler: PermissionHandler<"agent.permission.after">): () => void;
  };
};

type Options = { now?: () => string; log?: (msg: string) => void };

export function registerApprovals(
  server: ApprovalsServer,
  store: ApprovalsStore,
  { now = () => new Date().toISOString(), log = console.log }: Options = {},
): () => void {
  // Cards left for the user, so the after-hook knows which app a resolution belongs to.
  const pending = new Map<string, string>();

  const before: PermissionHandler<"agent.permission.before"> = async ({ agent, request }, { paseo }) => {
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
      } catch (error) {
        // Usually the user answered first or the request was cleared; log so other failures are visible.
        log(`auto-approve skipped: ${app} agent=${agent.id}: ${(error as Error).message}`);
      }
    } else {
      pending.set(JSON.stringify([agent.id, request.id]), app);
    }
    await store.save();
  };

  const after: PermissionHandler<"agent.permission.after"> = async ({ agent, requestId, resolution }) => {
    const key = JSON.stringify([agent.id, requestId]);
    const app = pending.get(key);
    if (app === undefined) return;
    pending.delete(key);
    if (applyManualResolution(store.state, app, resolution.behavior === "allow")) await store.save();
  };

  // The published 0.14.0 SDK only has on(); later hosts use the renamed hooks.
  const remove = typeof server.addHook === "function"
    ? [server.addHook("agent.permission.before", before), server.addHook("agent.permission.after", after)]
    : [server.on("agent.permission_requested", before), server.on("agent.permission_resolved", after)];

  server.handle(listApprovals, () => ({ apps: listApps(store.state) }));
  server.handle(setApprovalEnabled, async ({ name, enabled }) => {
    const record = setEnabled(store.state, name, enabled);
    await store.save();
    return { name, ...record };
  });
  return () => {
    for (const unregister of remove) unregister();
    pending.clear();
  };
}
