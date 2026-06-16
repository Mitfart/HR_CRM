import { NextRequest, NextResponse } from "next/server";
import { fetchBackendAuth } from "@/lib/serverApi";

export async function GET(_: NextRequest) {
  try {
    const res = await fetchBackendAuth("/api/client/applications", { cache: "no-store" });
    if (!res.ok) return NextResponse.json({ error: await res.text() }, { status: res.status });
    return NextResponse.json(await res.json());
  } catch (err) {
    console.error("[GET /api/client/applications]", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
