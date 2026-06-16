import { NextRequest } from "next/server";

import { backendJson } from "@/lib/backendProxy";

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  return backendJson(`/api/contracts/${params.id}`, { cache: "no-store" });
}
