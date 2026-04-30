export type UserRole = "admin" | "manager" | "client" | "candidate";

export interface AuthUser {
  id: string;
  email: string;
  full_name: string;
  role: UserRole;
}

/** Home page for each role after login */
export const ROLE_HOME: Record<UserRole, string> = {
  admin: "/crm",
  manager: "/crm",
  client: "/client",
  candidate: "/candidate",
};

export async function getMe(): Promise<AuthUser | null> {
  try {
    const res = await fetch("/api/auth/me", { cache: "no-store" });
    if (!res.ok) return null;
    return (await res.json()) as AuthUser;
  } catch {
    return null;
  }
}

export async function logout(): Promise<void> {
  await fetch("/api/auth/logout", { method: "POST" });
}
