import { NextRequest } from "next/server";

import { backendJson } from "@/lib/backendProxy";

export async function POST(_req: NextRequest, { params }: { params: { id: string } }) {
  return backendJson(`/api/contracts/${params.id}/send`, { method: "POST" });
}
