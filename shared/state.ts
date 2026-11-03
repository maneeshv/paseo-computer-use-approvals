import { z } from "zod";

const appStatusSchema = z.enum(["new", "on", "revoked"]);

const appRecordSchema = z.object({
  status: appStatusSchema,
  firstSeenAt: z.string(),
  lastSeenAt: z.string(),
  lastAutoApprovedAt: z.string().nullable(),
});

export const approvalsStateSchema = z.object({
  apps: z.record(z.string(), appRecordSchema).default({}),
});

export type AppStatus = z.infer<typeof appStatusSchema>;
export type AppRecord = z.infer<typeof appRecordSchema>;
export type ApprovalsState = z.infer<typeof approvalsStateSchema>;

/** Records a sighting; unknown apps start as `new`. Returns the app's status. */
export function recordSeen(state: ApprovalsState, app: string, now: string): AppStatus {
  const record = state.apps[app];
  if (!record) {
    state.apps[app] = { status: "new", firstSeenAt: now, lastSeenAt: now, lastAutoApprovedAt: null };
    return "new";
  }
  record.lastSeenAt = now;
  return record.status;
}

export function recordAutoApproved(state: ApprovalsState, app: string, now: string): void {
  const record = state.apps[app];
  if (record) record.lastAutoApprovedAt = now;
}

/** A manual Allow turns on only an app that is still `new`; revoked apps stay revoked. */
export function applyManualResolution(state: ApprovalsState, app: string, allowed: boolean): boolean {
  const record = state.apps[app];
  if (!allowed || record?.status !== "new") return false;
  record.status = "on";
  return true;
}

export function setEnabled(state: ApprovalsState, app: string, enabled: boolean): AppRecord {
  const record = state.apps[app];
  if (!record) throw new Error(`Unknown app: ${app}`);
  record.status = enabled ? "on" : "revoked";
  return record;
}

export function listApps(state: ApprovalsState): Array<AppRecord & { name: string }> {
  return Object.entries(state.apps)
    .map(([name, record]) => ({ name, ...record }))
    .sort((a, b) => a.name.localeCompare(b.name));
}
