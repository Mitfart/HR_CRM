import { cookies } from "next/headers";

const configuredBase = process.env.API_URL ?? process.env.NEXT_PUBLIC_API_URL ?? "";

const BASE_CANDIDATES = [
  configuredBase,
  "http://localhost:8000",
  "http://backend:8000",
].filter(Boolean);

export async function fetchBackend(path: string, init?: RequestInit): Promise<Response> {
  let lastError: unknown;

  for (const base of BASE_CANDIDATES) {
    try {
      const res = await fetch(`${base}${path}`, init);
      return res;
    } catch (err) {
      lastError = err;
    }
  }

  throw lastError ?? new Error("Backend is not reachable");
}

/**
 * Like fetchBackend but automatically reads the auth_token cookie
 * from the current Next.js request and forwards it as Bearer token.
 */
export async function fetchBackendAuth(
  path: string,
  init?: RequestInit,
): Promise<Response> {
  const cookieStore = cookies();
  const token = cookieStore.get("auth_token")?.value;

  const headers: Record<string, string> = {
    ...(init?.headers as Record<string, string> | undefined),
  };
  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }

  return fetchBackend(path, { ...init, headers });
}
