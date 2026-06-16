import { NextResponse } from "next/server";
import { fetchBackendAuth } from "@/lib/serverApi";

export async function GET() {
  try {
    const res = await fetchBackendAuth("/api/hr-time/status", { cache: "no-store" });
    if (!res.ok) {
      return NextResponse.json({ error: await res.text() }, { status: res.status });
    }
    return NextResponse.json(await res.json());
  } catch (err) {
    console.error("[GET /api/crm/hr-time/status]", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
