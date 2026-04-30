import { NextRequest, NextResponse } from "next/server";
import { fetchBackendAuth } from "@/lib/serverApi";

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const res = await fetchBackendAuth(`/api/calendar/slots/${params.id}`, { method: "DELETE" });
    return res.ok ? new NextResponse(null, { status: 204 }) : NextResponse.json({ error: await res.text() }, { status: res.status });
  } catch {
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
