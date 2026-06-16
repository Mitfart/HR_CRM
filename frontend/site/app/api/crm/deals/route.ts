import { NextRequest, NextResponse } from "next/server";
import { fetchBackendAuth } from "@/lib/serverApi";

export async function GET(req: NextRequest) {
  try {
    const params = req.nextUrl.searchParams;
    const query = new URLSearchParams();
    const mode = params.get("mode");
    const skip = params.get("skip");
    const limit = params.get("limit");
    const search = params.get("search");
    const gid = params.get("gid");
    if (mode) query.set("mode", mode);
    if (skip) query.set("skip", skip);
    if (limit) query.set("limit", limit);
    if (search) query.set("search", search);
    if (gid) query.set("gid", gid);

    const url =
      mode === "sheet"
        ? `/api/deals/sheet-snapshot${query.toString() ? `?${query.toString()}` : ""}`
        : `/api/deals${query.toString() ? `?${query.toString()}` : ""}`;
    const res = await fetchBackendAuth(url, { cache: "no-store" });
    if (!res.ok) {
      return NextResponse.json({ error: await res.text() }, { status: res.status });
    }
    return NextResponse.json(await res.json());
  } catch (err) {
    console.error("[GET /api/crm/deals]", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function POST() {
  try {
    const res = await fetchBackendAuth("/api/deals/sync-now", { method: "POST" });
    if (!res.ok) {
      return NextResponse.json({ error: await res.text() }, { status: res.status });
    }
    return NextResponse.json(await res.json());
  } catch (err) {
    console.error("[POST /api/crm/deals]", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
