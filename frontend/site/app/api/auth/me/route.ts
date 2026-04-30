import { NextResponse } from "next/server";
import { fetchBackendAuth } from "@/lib/serverApi";

export async function GET() {
  try {
    const res = await fetchBackendAuth("/api/auth/me", { cache: "no-store" });
    if (!res.ok) {
      return NextResponse.json({ error: "Unauthorized" }, { status: res.status });
    }
    const data = await res.json();
    return NextResponse.json(data);
  } catch (err) {
    console.error("[GET /api/auth/me]", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
