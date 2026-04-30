import { NextRequest, NextResponse } from "next/server";
import { fetchBackendAuth as fetchBackend } from "@/lib/serverApi";

type Ctx = { params: { id: string } };

export async function PATCH(req: NextRequest, { params }: Ctx) {
  try {
    const body = await req.json();
    const res = await fetchBackend(`/api/matches/${params.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (!res.ok) return NextResponse.json({ error: await res.text() }, { status: res.status });
    return NextResponse.json(await res.json());
  } catch (err) {
    console.error("[PATCH /api/crm/matches/:id]", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
