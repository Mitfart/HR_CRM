import { NextRequest } from "next/server";

import { backendJson, backendJsonFromRequest } from "@/lib/backendProxy";

export async function GET() {
  return backendJson("/api/contracts", { cache: "no-store" });
}

export async function POST(req: NextRequest) {
  return backendJsonFromRequest(req, "/api/contracts", { method: "POST", successStatus: 201 });
}
