import { NextRequest, NextResponse } from "next/server";
import { fetchBackendAuth } from "@/lib/serverApi";

export async function POST(_: NextRequest, { params }: { params: { id: string } }) {
  const res = await fetchBackendAuth(`/api/crm/notifications/${params.id}/read`, { method: "POST" });
  const data = await res.json();
  return NextResponse.json(data, { status: res.status });
}
