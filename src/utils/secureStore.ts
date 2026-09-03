import { invoke } from "@tauri-apps/api/core";

export type SecureKey = "todoist_token" | "todoist_oauth_pending";

const isSecureKey = (key: string): key is SecureKey =>
  key === "todoist_token" || key === "todoist_oauth_pending";

export async function getSecureToken(key: string): Promise<string | null> {
  try {
    if (!isSecureKey(key)) return null;
    return await invoke<string | null>("get_secret", { account: key });
  } catch {
    return null;
  }
}

export async function setSecureToken(key: string, value: string) {
  if (!isSecureKey(key)) {
    throw new Error("Unsupported secure-storage key");
  }
  await invoke("set_secret", { account: key, secret: value });
}
