import { NextRequest } from "next/server";

import { backendBinary } from "@/lib/backendProxy";

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  return backendBinary(`/api/contracts/${params.id}/pdf`, {
    cache: "no-store",
    responseHeaders: {
      "Content-Disposition": `attachment; filename=contract_${params.id}.pdf`,
      "Content-Type": "application/pdf",
    },
  });
}
