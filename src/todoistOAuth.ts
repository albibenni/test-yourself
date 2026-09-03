import { openUrl } from "@tauri-apps/plugin-opener";
import { z } from "zod";
import { getSecureToken, setSecureToken } from "./utils/secureStore";

export const TODOIST_OAUTH_CLIENT_ID =
  "https://albibenni.github.io/test-yourself/oauth-client.json";
export const TODOIST_OAUTH_REDIRECT_URI =
  "https://albibenni.github.io/test-yourself/todoist-callback.html";
export const TODOIST_OAUTH_CALLBACK_SCHEME = "test-yourself://todoist-auth";

const AUTHORIZATION_URL = "https://app.todoist.com/oauth/authorize";
const TOKEN_URL = "https://api.todoist.com/oauth/access_token";
const REFRESH_SKEW_MS = 60_000;

const OAuthTokensSchema = z.object({
  access_token: z.string().min(1),
  refresh_token: z.string().min(1),
  expires_in: z.number().positive(),
  token_type: z.literal("Bearer"),
});

const StoredOAuthTokensSchema = OAuthTokensSchema.extend({
  expires_at: z.number().positive(),
});

const PendingOAuthSchema = z.object({
  state: z.string().min(1),
  verifier: z.string().min(1),
});

export type StoredOAuthTokens = z.infer<typeof StoredOAuthTokensSchema>;

// Todoist refresh-token rotation means concurrent refreshes using the same
// token are not safe. Keep one shared refresh in flight for all callers.
let refreshInFlight: Promise<StoredOAuthTokens> | null = null;
let authorizationCompletionInFlight: Promise<boolean> | null = null;

const toBase64Url = (bytes: Uint8Array) =>
  btoa(String.fromCharCode(...bytes))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=/g, "");

const randomValue = () => {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return toBase64Url(bytes);
};

const challengeFor = async (verifier: string) => {
  const digest = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(verifier),
  );
  return toBase64Url(new Uint8Array(digest));
};

export async function createTodoistAuthorizationUrl() {
  const state = randomValue();
  const verifier = randomValue();
  const codeChallenge = await challengeFor(verifier);
  const params = new URLSearchParams({
    client_id: TODOIST_OAUTH_CLIENT_ID,
    redirect_uri: TODOIST_OAUTH_REDIRECT_URI,
    response_type: "code",
    scope: "data:read_write",
    state,
    code_challenge: codeChallenge,
    code_challenge_method: "S256",
  });
  return { state, verifier, url: `${AUTHORIZATION_URL}?${params}` };
}

async function requestTokens(params: URLSearchParams) {
  const response = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: params,
  });
  if (!response.ok) throw new Error(`Todoist OAuth error: ${response.status}`);
  return OAuthTokensSchema.parse(await response.json());
}

const storeTokens = async (tokens: z.infer<typeof OAuthTokensSchema>) => {
  const stored: StoredOAuthTokens = {
    ...tokens,
    expires_at: Date.now() + tokens.expires_in * 1000,
  };
  await setSecureToken("todoist_token", JSON.stringify(stored));
  return stored;
};

const refreshTokens = (refreshToken: string) => {
  if (!refreshInFlight) {
    refreshInFlight = requestTokens(
      new URLSearchParams({
        grant_type: "refresh_token",
        client_id: TODOIST_OAUTH_CLIENT_ID,
        refresh_token: refreshToken,
      }),
    )
      .then(storeTokens)
      .finally(() => {
        refreshInFlight = null;
      });
  }
  return refreshInFlight;
};

const readStoredTokens = async () => {
  const secret = await getSecureToken("todoist_token");
  if (!secret) return null;
  const parsed = StoredOAuthTokensSchema.safeParse(
    (() => {
      try {
        return JSON.parse(secret);
      } catch {
        return null;
      }
    })(),
  );
  return parsed.success ? parsed.data : null;
};

export async function beginTodoistAuthorization() {
  const request = await createTodoistAuthorizationUrl();
  await setSecureToken(
    "todoist_oauth_pending",
    JSON.stringify({ state: request.state, verifier: request.verifier }),
  );
  window.sessionStorage.setItem("todoist_oauth_state", request.state);
  window.sessionStorage.setItem("todoist_oauth_verifier", request.verifier);
  await openUrl(request.url);
}

async function completeTodoistAuthorizationRequest(url: string) {
  const callback = new URL(url);
  if (
    `${callback.protocol}//${callback.host}${callback.pathname}` !==
    TODOIST_OAUTH_CALLBACK_SCHEME
  ) {
    return false;
  }
  const error = callback.searchParams.get("error");
  if (error) throw new Error(`Todoist authorization failed: ${error}`);
  const state = callback.searchParams.get("state");
  const code = callback.searchParams.get("code");
  const pendingSecret = await getSecureToken("todoist_oauth_pending");
  const pending = PendingOAuthSchema.safeParse(
    (() => {
      try {
        return pendingSecret ? JSON.parse(pendingSecret) : null;
      } catch {
        return null;
      }
    })(),
  );
  const expectedState = pending.success
    ? pending.data.state
    : window.sessionStorage.getItem("todoist_oauth_state");
  const verifier = pending.success
    ? pending.data.verifier
    : window.sessionStorage.getItem("todoist_oauth_verifier");
  if (!code || !state || !verifier || state !== expectedState) {
    throw new Error("Todoist authorization response could not be verified.");
  }
  const tokens = await requestTokens(
    new URLSearchParams({
      grant_type: "authorization_code",
      client_id: TODOIST_OAUTH_CLIENT_ID,
      code,
      code_verifier: verifier,
      redirect_uri: TODOIST_OAUTH_REDIRECT_URI,
    }),
  );
  await storeTokens(tokens);
  await setSecureToken("todoist_oauth_pending", "");
  window.sessionStorage.removeItem("todoist_oauth_state");
  window.sessionStorage.removeItem("todoist_oauth_verifier");
  return true;
}

/**
 * Exchanges an OAuth callback exactly once. The deep-link plugin can surface
 * the same callback through more than one delivery mechanism.
 */
export function completeTodoistAuthorization(url: string) {
  let callback: URL;
  try {
    callback = new URL(url);
  } catch {
    return Promise.resolve(false);
  }
  if (
    `${callback.protocol}//${callback.host}${callback.pathname}` !==
    TODOIST_OAUTH_CALLBACK_SCHEME
  ) {
    return Promise.resolve(false);
  }
  if (!authorizationCompletionInFlight) {
    authorizationCompletionInFlight = completeTodoistAuthorizationRequest(
      url,
    ).finally(() => {
      authorizationCompletionInFlight = null;
    });
  }
  return authorizationCompletionInFlight;
}

export async function getAuthorizedTodoistToken() {
  const stored = await readStoredTokens();
  if (!stored) return null;
  if (stored.expires_at - REFRESH_SKEW_MS > Date.now()) {
    return stored.access_token;
  }
  return (await refreshTokens(stored.refresh_token)).access_token;
}

/** Refreshes an existing Todoist connection on demand from Settings. */
export async function refreshTodoistAccessToken() {
  const stored = await readStoredTokens();
  if (!stored) return null;
  return (await refreshTokens(stored.refresh_token)).access_token;
}

export function isTodoistOAuthSecret(secret: string | null) {
  if (!secret) return false;
  try {
    return StoredOAuthTokensSchema.safeParse(JSON.parse(secret)).success;
  } catch {
    return false;
  }
}
