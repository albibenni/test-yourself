import { Stronghold, type Client } from "@tauri-apps/plugin-stronghold";
import { appDataDir } from "@tauri-apps/api/path";

let cachedStronghold: Stronghold | null = null;
let cachedClient: Client | null = null;

const FIXED_VAULT_KEY = "test-yourself-local-encryption-key";
const CLIENT_NAME = "test-yourself-client";

export async function getSecureStore() {
  if (cachedClient && cachedStronghold) {
    return { stronghold: cachedStronghold, store: cachedClient.getStore() };
  }

  const dir = await appDataDir();
  const vaultPath = `${dir}/secrets.hold`;

  cachedStronghold = await Stronghold.load(vaultPath, FIXED_VAULT_KEY);

  try {
    cachedClient = await cachedStronghold.loadClient(CLIENT_NAME);
  } catch {
    cachedClient = await cachedStronghold.createClient(CLIENT_NAME);
  }

  return { stronghold: cachedStronghold, store: cachedClient.getStore() };
}

export async function getSecureToken(key: string): Promise<string | null> {
  try {
    const { store } = await getSecureStore();
    const data = await store.get(key);
    if (!data) return null;
    return new TextDecoder().decode(new Uint8Array(data));
  } catch {
    return null;
  }
}

export async function setSecureToken(key: string, value: string) {
  const { stronghold, store } = await getSecureStore();
  const data = Array.from(new TextEncoder().encode(value));
  await store.insert(key, data);
  await stronghold.save();
}
