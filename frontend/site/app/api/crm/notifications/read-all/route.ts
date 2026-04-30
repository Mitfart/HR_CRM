import { NextRequest, NextResponse } from "next/server";
import { fetchBackendAuth } from "@/lib/serverApi";

export async function POST(_: NextRequest) {
  const res = await fetchBackendAuth("/api/crm/notifications/read-all", { method: "POST" });
  if (res.status === 204) return new NextResponse(null, { status: 204 });
  const data = await res.json();
  return NextResponse.json(data, { status: res.status });
}
