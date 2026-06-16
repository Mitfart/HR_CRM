import { NextRequest, NextResponse } from "next/server";
import { fetchBackendAuth } from "@/lib/serverApi";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    const gid = req.nextUrl.searchParams.get("gid") ?? "1396224654";
    const res = await fetchBackendAuth(`/api/deals/kanban?gid=${encodeURIComponent(gid)}`, { cache: "no-store" });
    if (!res.ok) {
      return NextResponse.json({ error: await res.text() }, { status: res.status });
    }
    return NextResponse.json(await res.json());
  } catch (err) {
    console.error("[GET /api/crm/deals/kanban]", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
