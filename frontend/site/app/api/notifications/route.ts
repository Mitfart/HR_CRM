import { NextRequest, NextResponse } from "next/server";
import { fetchBackendAuth } from "@/lib/serverApi";

export async function GET(req: NextRequest) {
  const qs = req.nextUrl.searchParams.toString();
  const res = await fetchBackendAuth(`/api/notifications${qs ? `?${qs}` : ""}`, { cache: "no-store" });
  return NextResponse.json(await res.json(), { status: res.status });
}
