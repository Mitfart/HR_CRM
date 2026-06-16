import { NextResponse } from "next/server";
import { fetchBackendAuth } from "@/lib/serverApi";

type Params = { params: { itemId: string } };

export async function PATCH(req: Request, { params }: Params) {
  try {
    const body = await req.json();
    const res = await fetchBackendAuth(`/api/deals/kanban/items/${encodeURIComponent(params.itemId)}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      return NextResponse.json({ error: await res.text() }, { status: res.status });
    }
    return NextResponse.json(await res.json());
  } catch (err) {
    console.error("[PATCH /api/crm/deals/kanban/items/[itemId]]", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
