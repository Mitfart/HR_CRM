import { NextRequest, NextResponse } from "next/server";
import { fetchBackendAuth } from "@/lib/serverApi";

export async function GET(req: NextRequest) {
  try {
    const scope = req.nextUrl.searchParams.get("scope") ?? "mine";
    const limit = req.nextUrl.searchParams.get("limit") ?? "200";
    const res = await fetchBackendAuth(
      `/api/deletions?scope=${encodeURIComponent(scope)}&limit=${encodeURIComponent(limit)}`,
      { cache: "no-store" },
    );
    if (!res.ok) {
      return NextResponse.json({ error: await res.text() }, { status: res.status });
    }
    return NextResponse.json(await res.json());
  } catch (err) {
    console.error("[GET /api/crm/deletions]", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
