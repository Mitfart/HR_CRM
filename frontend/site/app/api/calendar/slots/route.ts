import { NextRequest, NextResponse } from "next/server";
import { fetchBackendAuth } from "@/lib/serverApi";

export async function GET(req: NextRequest) {
  try {
    const params = req.nextUrl.searchParams;
    const query = new URLSearchParams();
    const managerId = params.get("manager_id");
    if (managerId) query.set("manager_id", managerId);
    const url = `/api/calendar/slots${query.toString() ? `?${query}` : ""}`;
    const res = await fetchBackendAuth(url, { cache: "no-store" });
    return NextResponse.json(res.ok ? await res.json() : { error: await res.text() }, { status: res.ok ? 200 : res.status });
  } catch {
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const res = await fetchBackendAuth("/api/calendar/slots", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    return NextResponse.json(res.ok ? await res.json() : { error: await res.text() }, { status: res.ok ? 201 : res.status });
  } catch {
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
