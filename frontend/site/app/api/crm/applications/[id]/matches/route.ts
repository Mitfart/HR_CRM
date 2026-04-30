import { NextRequest, NextResponse } from "next/server";
import { fetchBackendAuth as fetchBackend } from "@/lib/serverApi";

type Ctx = { params: { id: string } };

export async function GET(_: NextRequest, { params }: Ctx) {
  try {
    const res = await fetchBackend(`/api/applications/${params.id}/matches`, { cache: "no-store" });
    if (!res.ok) return NextResponse.json({ error: await res.text() }, { status: res.status });
    return NextResponse.json(await res.json());
  } catch (err) {
    console.error("[GET /api/crm/applications/:id/matches]", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function POST(req: NextRequest, { params }: Ctx) {
  try {
    const body = await req.json();
    const res = await fetchBackend("/api/matches", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ application_id: params.id, ...body }),
    });
    if (!res.ok) return NextResponse.json({ error: await res.text() }, { status: res.status });
    return NextResponse.json(await res.json(), { status: 201 });
  } catch (err) {
    console.error("[POST /api/crm/applications/:id/matches]", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
