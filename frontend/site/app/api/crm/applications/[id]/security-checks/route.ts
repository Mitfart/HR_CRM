import { NextRequest, NextResponse } from "next/server";
import { fetchBackendAuth } from "@/lib/serverApi";

type Ctx = { params: { id: string } };

export async function GET(_: NextRequest, { params }: Ctx) {
  try {
    const res = await fetchBackendAuth(`/api/applications/${params.id}/security-checks`, { cache: "no-store" });
    if (!res.ok) return NextResponse.json({ error: await res.text() }, { status: res.status });
    return NextResponse.json(await res.json());
  } catch (err) {
    console.error("[GET /api/crm/applications/:id/security-checks]", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function POST(req: NextRequest, { params }: Ctx) {
  try {
    const form = await req.formData();
    const res = await fetchBackendAuth(`/api/applications/${params.id}/security-checks`, { method: "POST", body: form });
    if (!res.ok) return NextResponse.json({ error: await res.text() }, { status: res.status });
    return NextResponse.json(await res.json(), { status: 201 });
  } catch (err) {
    console.error("[POST /api/crm/applications/:id/security-checks]", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
