import { NextRequest, NextResponse } from "next/server";
import { fetchBackendAuth } from "@/lib/serverApi";

type Params = { params: { stageId: string } };

export async function PATCH(req: Request, { params }: Params) {
  try {
    const body = await req.json();
    const res = await fetchBackendAuth(`/api/deals/kanban/stages/${encodeURIComponent(params.stageId)}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      return NextResponse.json({ error: await res.text() }, { status: res.status });
    }
    return NextResponse.json(await res.json());
  } catch (err) {
    console.error("[PATCH /api/crm/deals/kanban/stages/[stageId]]", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest, { params }: Params) {
  try {
    const gid = req.nextUrl.searchParams.get("gid") ?? "1396224654";
    const res = await fetchBackendAuth(
      `/api/deals/kanban/stages/${encodeURIComponent(params.stageId)}?gid=${encodeURIComponent(gid)}`,
      { method: "DELETE" },
    );
    if (!res.ok) {
      return NextResponse.json({ error: await res.text() }, { status: res.status });
    }
    return NextResponse.json(await res.json());
  } catch (err) {
    console.error("[DELETE /api/crm/deals/kanban/stages/[stageId]]", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
