import { NextRequest } from "next/server";

import { backendBinary } from "@/lib/backendProxy";

type Ctx = { params: { id: string; docId: string } };

export async function GET(_: NextRequest, { params }: Ctx) {
  return backendBinary(`/api/applications/${params.id}/documents/${params.docId}/download`, {
    cache: "no-store",
    responseHeaders: { "Content-Type": "application/octet-stream" },
  });
}
