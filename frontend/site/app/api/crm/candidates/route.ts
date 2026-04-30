import { NextRequest, NextResponse } from "next/server";
import { fetchBackendAuth as fetchBackend } from "@/lib/serverApi";

export async function GET(req: NextRequest) {
  try {
    // Forward all query params (name, specialization, age_min, age_max,
    // salary_min, salary_max, experience_min, tags_search, availability, limit, skip)
    const qs = req.nextUrl.searchParams.toString();
    const res = await fetchBackend(`/api/candidates${qs ? `?${qs}` : ""}`, { cache: "no-store" });
    if (!res.ok) return NextResponse.json({ error: await res.text() }, { status: res.status });
    return NextResponse.json(await res.json());
  } catch (err) {
    console.error("[GET /api/crm/candidates]", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const res = await fetchBackend("/api/candidates", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (!res.ok) return NextResponse.json({ error: await res.text() }, { status: res.status });
    return NextResponse.json(await res.json(), { status: 201 });
  } catch (err) {
    console.error("[POST /api/crm/candidates]", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
