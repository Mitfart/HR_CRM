import { NextRequest, NextResponse } from "next/server";
import { fetchBackend } from "@/lib/serverApi";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const res = await fetchBackend("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

    const data = await res.json();
    if (!res.ok) {
      return NextResponse.json(data, { status: res.status });
    }

    const response = NextResponse.json(data);
    response.cookies.set("auth_token", data.access_token, {
      httpOnly: true,
      sameSite: "lax",
      path: "/",
      maxAge: 60 * 60 * 8, // 8 hours
      secure: process.env.SECURE_COOKIE === "true",
    });
    return response;
  } catch (err) {
    console.error("[POST /api/auth/login]", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
