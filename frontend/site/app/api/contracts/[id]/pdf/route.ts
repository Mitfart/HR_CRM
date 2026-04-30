import { NextRequest, NextResponse } from "next/server";
import { fetchBackendAuth } from "@/lib/serverApi";

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const res = await fetchBackendAuth(`/api/contracts/${params.id}/pdf`, { cache: "no-store" });
    if (!res.ok) return NextResponse.json({ error: await res.text() }, { status: res.status });
    const contentType = res.headers.get("content-type") ?? "application/pdf";
    const blob = await res.arrayBuffer();
    return new NextResponse(blob, {
      headers: {
        "Content-Type": contentType,
        "Content-Disposition": `attachment; filename=contract_${params.id}.pdf`,
      },
    });
  } catch {
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
