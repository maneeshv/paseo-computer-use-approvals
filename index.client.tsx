import type { PluginClientContext } from "@getpaseo/plugin/client";
import { ApprovalsScreen, ApprovalsSidebarItem, SCREEN_ID } from "#client/approvals";

const TITLE = "Computer Use approvals";

export default function contribute(client: PluginClientContext) {
  client.addScreen({ id: SCREEN_ID, title: TITLE, Component: ApprovalsScreen });
  client.addSidebarHeaderItem({ id: SCREEN_ID, title: TITLE, Component: ApprovalsSidebarItem });
  return () => {};
}
