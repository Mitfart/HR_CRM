import { NextRequest, NextResponse } from "next/server";
import { fetchBackendAuth } from "@/lib/serverApi";

export async function GET() {
  try {
    const res = await fetchBackendAuth("/api/bot/scripts", { cache: "no-store" });
    if (!res.ok) {
      const error = await res.text();
      return NextResponse.json({ error }, { status: res.status });
    }
    return NextResponse.json(await res.json());
  } catch (err) {
    console.error("[GET /api/crm/bot-scripts]", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function PUT(req: NextRequest) {
  try {
    const body = await req.json();
    const res = await fetchBackendAuth("/api/bot/scripts", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      const error = await res.text();
      return NextResponse.json({ error }, { status: res.status });
    }
    return NextResponse.json(await res.json());
  } catch (err) {
    console.error("[PUT /api/crm/bot-scripts]", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
