import { NextRequest, NextResponse } from "next/server";
import { fetchBackendAuth } from "@/lib/serverApi";

type Ctx = { params: { path: string[] } };

function buildBackendUrl(path: string[], req: NextRequest): string {
  const joined = path.join("/");
  const qs = req.nextUrl.searchParams.toString();
  return `/api/chat/${joined}${qs ? `?${qs}` : ""}`;
}

export async function GET(req: NextRequest, { params }: Ctx) {
  try {
    const res = await fetchBackendAuth(buildBackendUrl(params.path, req), { cache: "no-store" });
    if (!res.ok) return NextResponse.json({ error: await res.text() }, { status: res.status });
    return NextResponse.json(await res.json());
  } catch (err) {
    console.error("[GET /api/chat]", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function POST(req: NextRequest, { params }: Ctx) {
  try {
    const body = await req.text();
    const res = await fetchBackendAuth(buildBackendUrl(params.path, req), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body,
    });
    if (!res.ok) return NextResponse.json({ error: await res.text() }, { status: res.status });
    return NextResponse.json(await res.json());
  } catch (err) {
    console.error("[POST /api/chat]", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function PUT(req: NextRequest, { params }: Ctx) {
  try {
    const body = await req.text();
    const res = await fetchBackendAuth(buildBackendUrl(params.path, req), {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body,
    });
    if (!res.ok) return NextResponse.json({ error: await res.text() }, { status: res.status });
    return NextResponse.json(await res.json());
  } catch (err) {
    console.error("[PUT /api/chat]", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
