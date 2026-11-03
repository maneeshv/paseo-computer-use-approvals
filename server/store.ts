import { readFileSync, renameSync } from "node:fs";
import { mkdir, rename, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import { approvalsStateSchema, type ApprovalsState } from "#shared/state";

export type ApprovalsStore = { state: ApprovalsState; save(): Promise<void> };

// ponytail: in-memory state is authoritative; this plugin subprocess is the only writer.
export function loadStore(filePath: string, log: (msg: string) => void = console.error): ApprovalsStore {
  const state = readState(filePath, log);
  let chain: Promise<void> = Promise.resolve();
  const write = async () => {
    await mkdir(dirname(filePath), { recursive: true });
    const tmp = `${filePath}.tmp`;
    await writeFile(tmp, JSON.stringify(state, null, 2));
    await rename(tmp, filePath);
  };
  return {
    state,
    save() {
      chain = chain.then(write, write);
      return chain;
    },
  };
}

function readState(filePath: string, log: (msg: string) => void): ApprovalsState {
  let raw: string;
  try {
    raw = readFileSync(filePath, "utf8");
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return { apps: {} };
    throw error;
  }
  try {
    return approvalsStateSchema.parse(JSON.parse(raw));
  } catch {
    const aside = `${filePath}.corrupt-${Date.now()}`;
    renameSync(filePath, aside);
    log(`state file unreadable, moved to ${aside}`);
    return { apps: {} };
  }
}
