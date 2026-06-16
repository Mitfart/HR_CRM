import { NextRequest, NextResponse } from "next/server";
import { fetchBackendAuth } from "@/lib/serverApi";

export async function GET(req: NextRequest) {
  try {
    const scope = req.nextUrl.searchParams.get("scope") ?? "mine";
    const category = req.nextUrl.searchParams.get("category") ?? "all";
    const limit = req.nextUrl.searchParams.get("limit") ?? "300";
    const res = await fetchBackendAuth(
      `/api/history?scope=${encodeURIComponent(scope)}&category=${encodeURIComponent(category)}&limit=${encodeURIComponent(limit)}`,
      { cache: "no-store" },
    );
    if (!res.ok) {
      return NextResponse.json({ error: await res.text() }, { status: res.status });
    }
    return NextResponse.json(await res.json());
  } catch (err) {
    console.error("[GET /api/crm/history]", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
