import { NextResponse } from "next/server";

import { fetchBackendAuth } from "@/lib/serverApi";

interface BackendProxyOptions {
  body?: BodyInit;
  cache?: RequestCache;
  headers?: HeadersInit;
  method?: string;
  successStatus?: number;
  responseHeaders?: HeadersInit;
}

function jsonHeaders(headers?: HeadersInit): HeadersInit {
  return { "Content-Type": "application/json", ...headers };
}

async function responseError(res: Response): Promise<NextResponse> {
  return NextResponse.json({ error: await res.text() }, { status: res.status });
}

export async function backendJson(path: string, options: BackendProxyOptions = {}): Promise<NextResponse> {
  try {
    const res = await fetchBackendAuth(path, {
      cache: options.cache,
      method: options.method,
      headers: options.headers,
      body: options.body,
    });
    if (!res.ok) return responseError(res);
    return NextResponse.json(await res.json(), { status: options.successStatus ?? res.status });
  } catch (err) {
    console.error(`[${options.method ?? "GET"} ${path}]`, err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function backendJsonFromRequest(
  request: Request,
  path: string,
  options: Omit<BackendProxyOptions, "body" | "headers"> = {},
): Promise<NextResponse> {
  try {
    const body = await request.json();
    return backendJson(path, {
      ...options,
      headers: jsonHeaders(),
      body: JSON.stringify(body),
    });
  } catch (err) {
    console.error(`[${options.method ?? "POST"} ${path}]`, err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function backendBinary(path: string, options: BackendProxyOptions = {}): Promise<NextResponse> {
  try {
    const res = await fetchBackendAuth(path, {
      cache: options.cache,
      method: options.method,
      headers: options.headers,
      body: options.body,
    });
    if (!res.ok) return responseError(res);

    const responseHeaders = new Headers(options.responseHeaders);
    const contentType = res.headers.get("content-type");
    const disposition = res.headers.get("content-disposition");
    if (contentType && !responseHeaders.has("content-type")) responseHeaders.set("content-type", contentType);
    if (disposition && !responseHeaders.has("content-disposition")) {
      responseHeaders.set("content-disposition", disposition);
    }

    return new NextResponse(await res.arrayBuffer(), {
      status: options.successStatus ?? res.status,
      headers: responseHeaders,
    });
  } catch (err) {
    console.error(`[${options.method ?? "GET"} ${path}]`, err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
