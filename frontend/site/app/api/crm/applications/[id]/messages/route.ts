import { NextResponse } from "next/server";
import { fetchBackendAuth as fetchBackend } from "@/lib/serverApi";

type Ctx = {
  params: {
    id: string;
  };
};

export async function GET(_: Request, { params }: Ctx) {
  try {
    const res = await fetchBackend(`/api/bot/messages/${params.id}`, { cache: "no-store" });

    if (!res.ok) {
      const error = await res.text();
      return NextResponse.json({ error }, { status: res.status });
    }

    const data = await res.json();
    return NextResponse.json(data);
  } catch (err) {
    console.error("[GET /api/crm/applications/:id/messages]", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function POST(req: Request, { params }: Ctx) {
  try {
    const body = await req.json();
    const res = await fetchBackend(`/api/bot/send/${params.id}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text: body.text }),
    });

    if (!res.ok) {
      const error = await res.text();
      return NextResponse.json({ error }, { status: res.status });
    }

    const data = await res.json();
    return NextResponse.json(data, { status: 201 });
  } catch (err) {
    console.error("[POST /api/crm/applications/:id/messages]", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
