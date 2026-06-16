import { NextRequest, NextResponse } from "next/server";
import { fetchBackendAuth } from "@/lib/serverApi";

type Ctx = { params: { id: string } };

export async function POST(req: NextRequest, { params }: Ctx) {
  try {
    const body = await req.json();
    const res = await fetchBackendAuth(`/api/applications/${params.id}/payments/robokassa/preview`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (!res.ok) return NextResponse.json({ error: await res.text() }, { status: res.status });
    return NextResponse.json(await res.json(), { status: 201 });
  } catch (err) {
    console.error("[POST /api/crm/applications/:id/payments/robokassa-preview]", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
