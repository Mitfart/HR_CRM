import { NextRequest, NextResponse } from "next/server";
import { fetchBackend } from "@/lib/serverApi";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();

    const res = await fetchBackend("/api/applications", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      const error = await res.text();
      return NextResponse.json({ error }, { status: res.status });
    }

    const data = await res.json();
    return NextResponse.json(data, { status: 201 });
  } catch (err) {
    console.error("[POST /api/applications]", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
