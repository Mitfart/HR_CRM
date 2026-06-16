import { NextRequest } from "next/server";

import { backendJsonFromRequest } from "@/lib/backendProxy";

export async function POST(req: NextRequest) {
  return backendJsonFromRequest(req, "/api/calendar/book", { method: "POST" });
}
