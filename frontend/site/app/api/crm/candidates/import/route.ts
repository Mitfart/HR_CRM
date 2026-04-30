import { NextRequest, NextResponse } from "next/server";
import { fetchBackendAuth as fetchBackend } from "@/lib/serverApi";

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const res = await fetchBackend("/api/candidates/import", {
      method: "POST",
      body: formData,
    });
    if (!res.ok) return NextResponse.json({ error: await res.text() }, { status: res.status });
    return NextResponse.json(await res.json());
  } catch (err) {
    console.error("[POST /api/crm/candidates/import]", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
