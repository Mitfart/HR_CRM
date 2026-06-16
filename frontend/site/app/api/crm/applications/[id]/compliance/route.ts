import { NextRequest, NextResponse } from "next/server";
import { fetchBackendAuth } from "@/lib/serverApi";

type Ctx = { params: { id: string } };

export async function GET(_: NextRequest, { params }: Ctx) {
  try {
    const res = await fetchBackendAuth(`/api/applications/${params.id}/compliance`, { cache: "no-store" });
    if (!res.ok) return NextResponse.json({ error: await res.text() }, { status: res.status });
    return NextResponse.json(await res.json());
  } catch (err) {
    console.error("[GET /api/crm/applications/:id/compliance]", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest, { params }: Ctx) {
  try {
    const body = await req.json();
    const res = await fetchBackendAuth(`/api/applications/${params.id}/compliance`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (!res.ok) return NextResponse.json({ error: await res.text() }, { status: res.status });
    return NextResponse.json(await res.json());
  } catch (err) {
    console.error("[PATCH /api/crm/applications/:id/compliance]", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
