import { NextRequest, NextResponse } from "next/server";
import { fetchBackendAuth as fetchBackend } from "@/lib/serverApi";

type Ctx = { params: { id: string } };

export async function GET(_: NextRequest, { params }: Ctx) {
  try {
    const res = await fetchBackend(`/api/candidates/${params.id}`, { cache: "no-store" });
    if (!res.ok) return NextResponse.json({ error: await res.text() }, { status: res.status });
    return NextResponse.json(await res.json());
  } catch (err) {
    console.error("[GET /api/crm/candidates/:id]", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest, { params }: Ctx) {
  try {
    const body = await req.json();
    const res = await fetchBackend(`/api/candidates/${params.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (!res.ok) return NextResponse.json({ error: await res.text() }, { status: res.status });
    return NextResponse.json(await res.json());
  } catch (err) {
    console.error("[PATCH /api/crm/candidates/:id]", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function DELETE(_: NextRequest, { params }: Ctx) {
  try {
    const res = await fetchBackend(`/api/candidates/${params.id}`, { method: "DELETE" });
    if (!res.ok) return NextResponse.json({ error: await res.text() }, { status: res.status });
    return new NextResponse(null, { status: 204 });
  } catch (err) {
    console.error("[DELETE /api/crm/candidates/:id]", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
