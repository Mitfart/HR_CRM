import { NextRequest, NextResponse } from "next/server";

type Role = "admin" | "manager" | "client" | "candidate";

const ROLE_HOME: Record<Role, string> = {
  admin: "/crm",
  manager: "/crm",
  client: "/client",
  candidate: "/candidate",
};

function decodeJwtRole(token: string): Role | null {
  try {
    const payload = token.split(".")[1];
    // atob works in Edge runtime; Buffer is not available there
    const decoded = JSON.parse(atob(payload.replace(/-/g, "+").replace(/_/g, "/")));
    return (decoded?.role as Role) ?? null;
  } catch {
    return null;
  }
}

export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  const token = req.cookies.get("auth_token")?.value ?? null;

  // ── Redirect authenticated users away from login/register ──────────
  if (pathname === "/login" || pathname === "/register") {
    if (token) {
      const role = decodeJwtRole(token);
      if (role) {
        return NextResponse.redirect(new URL(ROLE_HOME[role], req.url));
      }
    }
    return NextResponse.next();
  }

  // ── Protect /crm, /client, /candidate, /chat ───────────────────────
  if (!token) {
    const loginUrl = new URL("/login", req.url);
    loginUrl.searchParams.set("next", pathname);
    return NextResponse.redirect(loginUrl);
  }

  const role = decodeJwtRole(token);
  if (!role) {
    const loginUrl = new URL("/login", req.url);
    return NextResponse.redirect(loginUrl);
  }

  // CRM admin panel: only admin
  if (pathname.startsWith("/crm/admin") && role !== "admin") {
    return NextResponse.redirect(new URL("/crm", req.url));
  }

  // CRM: only admin / manager
  if (pathname.startsWith("/crm") && role !== "admin" && role !== "manager") {
    return NextResponse.redirect(new URL(ROLE_HOME[role], req.url));
  }

  // Client portal: only client / admin / manager
  if (
    pathname.startsWith("/client") &&
    role !== "client" &&
    role !== "admin" &&
    role !== "manager"
  ) {
    return NextResponse.redirect(new URL(ROLE_HOME[role], req.url));
  }

  // Candidate portal: only candidate / admin / manager
  if (
    pathname.startsWith("/candidate") &&
    role !== "candidate" &&
    role !== "admin" &&
    role !== "manager"
  ) {
    return NextResponse.redirect(new URL(ROLE_HOME[role], req.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/crm/:path*", "/client/:path*", "/candidate/:path*", "/chat/:path*", "/login", "/register"],
};
