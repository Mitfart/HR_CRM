import { backendJsonFromRequest } from "@/lib/backendProxy";

export async function POST(req: Request) {
  return backendJsonFromRequest(req, "/api/deals/sheet-archive/restore", { method: "POST" });
}
