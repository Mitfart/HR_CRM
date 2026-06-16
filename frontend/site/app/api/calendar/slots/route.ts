import { NextRequest } from "next/server";

import { backendJson, backendJsonFromRequest } from "@/lib/backendProxy";

export async function GET(req: NextRequest) {
  const params = req.nextUrl.searchParams;
  const query = new URLSearchParams();
  const managerId = params.get("manager_id");
  if (managerId) query.set("manager_id", managerId);
  const url = `/api/calendar/slots${query.toString() ? `?${query}` : ""}`;
  return backendJson(url, { cache: "no-store" });
}

export async function POST(req: NextRequest) {
  return backendJsonFromRequest(req, "/api/calendar/slots", { method: "POST", successStatus: 201 });
}
