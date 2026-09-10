const DEFAULT_API_BASE_URL = "http://localhost:8001/api";

export const API_BASE_URL: string =
  (import.meta.env.VITE_API_BASE_URL as string | undefined) || DEFAULT_API_BASE_URL;

export const TOKEN_EXPIRY_KEY = "token_expires_at";
export const TOKEN_MAX_AGE_SEC = 60 * 60; // should match backend access token age
export const AUTH_SESSION_EXPIRED_EVENT = "auth:session-expired";

export class ApiError extends Error {
  status: number;
  code: string | null;

  constructor(message: string, status: number, code: string | null = null) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.code = code;
  }
}

let refreshPromise: Promise<boolean> | null = null;

export function resetTokenExpiry() {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(TOKEN_EXPIRY_KEY, String(Date.now() + TOKEN_MAX_AGE_SEC * 1000));
}

function isTokenExpired(): boolean {
  if (typeof window === "undefined") return false;
  const expiresAt = Number(window.localStorage.getItem(TOKEN_EXPIRY_KEY) || "0");
  return !expiresAt || Date.now() >= expiresAt;
}

async function attemptRefresh(): Promise<boolean> {
  if (!refreshPromise) {
    refreshPromise = (async () => {
      try {
        const res = await fetch(`${API_BASE_URL}/auth/refresh-token`, {
          method: "POST",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
        });
        if (!res.ok) return false;
        resetTokenExpiry();
        return true;
      } catch {
        return false;
      }
    })().finally(() => {
      refreshPromise = null;
    });
  }

  return refreshPromise;
}

export async function fetchJson<T>(input: string, init?: RequestInit): Promise<T> {
  const isAuthRequest = String(input).includes("/auth/");

  // Refresh proactively when possible, then also recover from a server-side
  // 401 in case the browser's local expiry timestamp is stale.
  if (typeof window !== "undefined" && isTokenExpired() && !isAuthRequest) {
    await attemptRefresh();
  }

  let res = await fetch(input, { ...init, credentials: "include" });
  if (res.status === 401 && !isAuthRequest) {
    const refreshed = await attemptRefresh();
    if (refreshed) {
      res = await fetch(input, { ...init, credentials: "include" });
    }
    if (!refreshed || res.status === 401) {
      notifySessionExpired();
      throw new ApiError("Your session expired. Please sign in again.", 401, "SESSION_EXPIRED");
    }
  }

  if (!res.ok) {
    throw await toApiError(res);
  }
  return (await res.json()) as T;
}

async function toApiError(res: Response): Promise<ApiError> {
  const text = await res.text().catch(() => "");
  let message = res.statusText || "Request failed";
  let code: string | null = null;

  if (text) {
    try {
      const body = JSON.parse(text) as { message?: unknown; code?: unknown };
      if (typeof body.message === "string" && body.message) message = body.message;
      if (typeof body.code === "string" && body.code) code = body.code;
    } catch {
      // Do not expose raw HTML or provider responses to the customer.
    }
  }

  return new ApiError(message, res.status, code);
}

function notifySessionExpired() {
  if (typeof window === "undefined") return;
  window.localStorage.removeItem(TOKEN_EXPIRY_KEY);
  window.dispatchEvent(new Event(AUTH_SESSION_EXPIRED_EVENT));
}

