import { invoke } from "@tauri-apps/api/core";

export async function getSecureToken(key: string): Promise<string | null> {
  try {
    if (key !== "todoist_token") return null;
    return await invoke<string | null>("get_secret");
  } catch {
    return null;
  }
}

export async function setSecureToken(key: string, value: string) {
  if (key !== "todoist_token") {
    throw new Error("Unsupported secure-storage key");
  }
  await invoke("set_secret", { secret: value });
}
