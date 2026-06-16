import { NextRequest, NextResponse } from "next/server";
import { fetchBackendAuth } from "@/lib/serverApi";

type Params = { params: { path?: string[] } };

function backendPath(req: NextRequest, params: Params["params"]) {
  const path = (params.path ?? []).join("/");
  const qs = req.nextUrl.searchParams.toString();
  return `/api/office-operations/${path}${qs ? `?${qs}` : ""}`;
}

async function proxy(req: NextRequest, params: Params["params"], method: "GET" | "POST" | "PATCH" | "DELETE") {
  try {
    const requestHeaders: Record<string, string> = {};
    req.headers.forEach((value, key) => {
      if (key !== "host") requestHeaders[key] = value;
    });
    const hasBody = method !== "GET" && method !== "DELETE";
    const body = hasBody ? await req.arrayBuffer() : undefined;
    const res = await fetchBackendAuth(backendPath(req, params), {
      method,
      headers: requestHeaders,
      body,
      cache: "no-store",
    });
    const contentType = res.headers.get("content-type") ?? "";
    const payload = await res.arrayBuffer();
    const responseHeaders = new Headers();
    responseHeaders.set("content-type", contentType || "application/json");
    const disposition = res.headers.get("content-disposition");
    if (disposition) responseHeaders.set("content-disposition", disposition);
    return new NextResponse(payload, {
      status: res.status,
      headers: responseHeaders,
    });
  } catch (err) {
    console.error(`[${method} /api/crm/office-operations]`, err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function GET(req: NextRequest, { params }: Params) {
  return proxy(req, params, "GET");
}

export async function POST(req: NextRequest, { params }: Params) {
  return proxy(req, params, "POST");
}

export async function PATCH(req: NextRequest, { params }: Params) {
  return proxy(req, params, "PATCH");
}

export async function DELETE(req: NextRequest, { params }: Params) {
  return proxy(req, params, "DELETE");
}
