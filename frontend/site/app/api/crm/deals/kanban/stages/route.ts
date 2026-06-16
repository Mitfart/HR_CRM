import { NextResponse } from "next/server";
import { fetchBackendAuth } from "@/lib/serverApi";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const res = await fetchBackendAuth("/api/deals/kanban/stages", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      return NextResponse.json({ error: await res.text() }, { status: res.status });
    }
    return NextResponse.json(await res.json());
  } catch (err) {
    console.error("[POST /api/crm/deals/kanban/stages]", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
