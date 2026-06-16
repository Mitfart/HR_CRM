import { NextRequest, NextResponse } from "next/server";
import { fetchBackendAuth } from "@/lib/serverApi";

export async function GET(req: NextRequest) {
  try {
    const days = req.nextUrl.searchParams.get("days") ?? "30";
    const res = await fetchBackendAuth(`/api/admin/hr-stats?days=${encodeURIComponent(days)}`, {
      cache: "no-store",
    });
    if (!res.ok) {
      return NextResponse.json({ error: await res.text() }, { status: res.status });
    }
    return NextResponse.json(await res.json());
  } catch (err) {
    console.error("[GET /api/crm/admin/hr-stats]", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
