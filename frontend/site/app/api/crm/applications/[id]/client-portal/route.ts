import { NextRequest, NextResponse } from "next/server";
import { fetchBackendAuth } from "@/lib/serverApi";

type Ctx = { params: { id: string } };

export async function GET(_: NextRequest, { params }: Ctx) {
  try {
    const res = await fetchBackendAuth(`/api/applications/${params.id}/client-portal`, { cache: "no-store" });
    if (!res.ok) return NextResponse.json({ error: await res.text() }, { status: res.status });
    return NextResponse.json(await res.json());
  } catch (err) {
    console.error("[GET /api/crm/applications/:id/client-portal]", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
