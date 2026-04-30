import { cookies } from "next/headers";
import { NextResponse } from "next/server";

/** Returns the raw JWT so client components can open a WebSocket with ?token=... */
export async function GET() {
  const token = cookies().get("auth_token")?.value ?? null;
  if (!token) {
    return NextResponse.json({ token: null }, { status: 401 });
  }
  return NextResponse.json({ token });
}
