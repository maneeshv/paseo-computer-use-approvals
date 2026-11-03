import { defineRpc } from "@getpaseo/plugin";
import { z } from "zod";

export const appEntrySchema = z.object({
  name: z.string(),
  status: z.enum(["new", "on", "revoked"]),
  firstSeenAt: z.string(),
  lastSeenAt: z.string(),
  lastAutoApprovedAt: z.string().nullable(),
});

export type AppEntry = z.infer<typeof appEntrySchema>;

export const listApprovals = defineRpc({
  name: "approvals.list",
  input: z.object({}),
  output: z.object({ apps: z.array(appEntrySchema) }),
});

export const setApprovalEnabled = defineRpc({
  name: "approvals.set-enabled",
  input: z.object({ name: z.string().min(1), enabled: z.boolean() }),
  output: appEntrySchema,
});
