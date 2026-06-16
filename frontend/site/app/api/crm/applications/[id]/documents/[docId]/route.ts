import { NextRequest, NextResponse } from "next/server";
import { fetchBackendAuth } from "@/lib/serverApi";

type Ctx = { params: { id: string; docId: string } };

export async function PATCH(req: NextRequest, { params }: Ctx) {
  try {
    const body = await req.json();
    const res = await fetchBackendAuth(`/api/applications/${params.id}/documents/${params.docId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (!res.ok) return NextResponse.json({ error: await res.text() }, { status: res.status });
    return NextResponse.json(await res.json());
  } catch (err) {
    console.error("[PATCH /api/crm/applications/:id/documents/:docId]", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function DELETE(_: NextRequest, { params }: Ctx) {
  try {
    const res = await fetchBackendAuth(`/api/applications/${params.id}/documents/${params.docId}`, {
      method: "DELETE",
    });
    if (!res.ok) return NextResponse.json({ error: await res.text() }, { status: res.status });
    return NextResponse.json(await res.json());
  } catch (err) {
    console.error("[DELETE /api/crm/applications/:id/documents/:docId]", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
