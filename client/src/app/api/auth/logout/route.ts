import { NextRequest, NextResponse } from "next/server";

import { PORTAL_SESSION_COOKIE } from "@/lib/portal-auth";

const ACCESS_TOKEN_COOKIE = "bembex_access_token";

export async function POST(request: NextRequest) {
  const response = new NextResponse(null, { status: 204 });

  const cookieNames = new Set([
    ...request.cookies.getAll().map(({ name }) => name),
    PORTAL_SESSION_COOKIE,
    ACCESS_TOKEN_COOKIE,
  ]);

  for (const name of cookieNames) {
    response.cookies.set({
      name,
      value: "",
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: 0,
      expires: new Date(0),
    });
  }

  response.headers.set("Cache-Control", "private, no-store, max-age=0");
  return response;
}
