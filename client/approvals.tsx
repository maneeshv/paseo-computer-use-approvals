import type { PluginScreenProps, PluginSidebarItemProps } from "@getpaseo/plugin/client";
import { useRpc } from "@getpaseo/plugin/client";
import { SettingsCard, SettingsSection, SettingsSwitch, SidebarRow } from "@getpaseo/plugin/client/ui";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo } from "react";
import { ScrollView, Text } from "react-native";
import { listApprovals, setApprovalEnabled, type AppEntry } from "#shared/rpc";

export const SCREEN_ID = "main";
const QUERY_KEY = ["approvals"];

export function ApprovalsSidebarItem({ currentScreen, openScreen }: PluginSidebarItemProps) {
  return (
    <SidebarRow
      icon="MonitorCheck"
      active={currentScreen?.screenId === SCREEN_ID}
      onPress={() => openScreen({ screenId: SCREEN_ID })}
    />
  );
}

function hint(app: AppEntry): string {
  if (app.status === "new") return "Allow a card once, or switch on here";
  const seen = `Last seen ${new Date(app.lastSeenAt).toLocaleString()}`;
  return app.lastAutoApprovedAt
    ? `${seen} · last auto-approved ${new Date(app.lastAutoApprovedAt).toLocaleString()}`
    : seen;
}

export function ApprovalsScreen({ theme, layout }: PluginScreenProps) {
  const list = useRpc(listApprovals);
  const setEnabled = useRpc(setApprovalEnabled);
  const queryClient = useQueryClient();
  const apps = useQuery({ queryKey: QUERY_KEY, queryFn: () => list({}), refetchInterval: 5000 });
  const toggle = useMutation({
    mutationFn: setEnabled,
    onSettled: () => queryClient.invalidateQueries({ queryKey: QUERY_KEY }),
  });
  const styles = useMemo(
    () => ({
      screen: { flex: 1, backgroundColor: theme.colors.surface0 },
      content: { padding: layout.compact ? 16 : 24, gap: 16 },
      text: { color: theme.colors.foreground },
      muted: { color: theme.colors.foregroundMuted },
    }),
    [theme, layout.compact],
  );

  let body;
  if (apps.isPending) {
    body = <Text style={styles.muted}>Loading…</Text>;
  } else if (apps.isError) {
    body = <Text style={styles.text}>Could not load apps: {apps.error.message}</Text>;
  } else if (apps.data.apps.length === 0) {
    body = <Text style={styles.muted}>Apps appear here after Codex asks to use one.</Text>;
  } else {
    body = (
      <SettingsSection title="Apps">
        <SettingsCard>
          {apps.data.apps.map((app) => (
            <SettingsSwitch
              key={app.name}
              label={app.name}
              hint={hint(app)}
              value={app.status === "on"}
              disabled={toggle.isPending && toggle.variables?.name === app.name}
              onValueChange={(enabled) => toggle.mutate({ name: app.name, enabled })}
            />
          ))}
        </SettingsCard>
      </SettingsSection>
    );
  }

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <Text style={styles.muted}>
        Codex Computer Use cards for apps switched on are approved automatically on this host.
      </Text>
      {toggle.isError ? <Text style={styles.text}>Could not save: {toggle.error.message}</Text> : null}
      {body}
    </ScrollView>
  );
}
