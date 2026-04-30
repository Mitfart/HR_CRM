import { NextRequest, NextResponse } from "next/server";
import { fetchBackendAuth } from "@/lib/serverApi";

export async function GET(req: NextRequest) {
  try {
    const params = req.nextUrl.searchParams;
    const query = new URLSearchParams();

    const skip = params.get("skip");
    const limit = params.get("limit");
    const status = params.get("status");

    if (skip) query.set("skip", skip);
    if (limit) query.set("limit", limit);
    if (status) query.set("status", status);

    const url = `/api/applications${query.toString() ? `?${query.toString()}` : ""}`;
    const res = await fetchBackendAuth(url, { cache: "no-store" });

    if (!res.ok) {
      const error = await res.text();
      return NextResponse.json({ error }, { status: res.status });
    }

    const data = await res.json();
    return NextResponse.json(data);
  } catch (err) {
    console.error("[GET /api/crm/applications]", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
