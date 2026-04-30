import { NextRequest, NextResponse } from "next/server";
import { fetchBackendAuth as fetchBackend } from "@/lib/serverApi";

type Ctx = { params: { id: string } };

export async function POST(_: NextRequest, { params }: Ctx) {
  try {
    const res = await fetchBackend(`/api/matches/${params.id}/send-to-client`, {
      method: "POST",
    });
    if (!res.ok) return NextResponse.json({ error: await res.text() }, { status: res.status });
    return NextResponse.json(await res.json());
  } catch (err) {
    console.error("[POST /api/crm/matches/:id/send-to-client]", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
