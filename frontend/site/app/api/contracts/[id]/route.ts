import { NextRequest, NextResponse } from "next/server";
import { fetchBackendAuth } from "@/lib/serverApi";

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const res = await fetchBackendAuth(`/api/contracts/${params.id}`, { cache: "no-store" });
    return NextResponse.json(res.ok ? await res.json() : { error: await res.text() }, { status: res.ok ? 200 : res.status });
  } catch {
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
