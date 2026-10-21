import { NextRequest, NextResponse } from "next/server";

import {
  createPortalSession,
  isPortalPasswordValid,
  PORTAL_SESSION_COOKIE,
  PORTAL_SESSION_MAX_AGE_SECONDS,
} from "@/lib/portal-auth";

export async function POST(request: NextRequest) {
  const secret = process.env.PORTAL_AUTH_SECRET;
  if (!process.env.PORTAL_PASSWORD || !secret) {
    return NextResponse.json(
      { error: "Portal login is not configured." },
      { status: 503 },
    );
  }

  let password: unknown;
  try {
    ({ password } = await request.json());
  } catch {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }

  if (!isPortalPasswordValid(password)) {
    return NextResponse.json({ error: "Incorrect password." }, { status: 401 });
  }

  const response = NextResponse.json({ authenticated: true });
  response.cookies.set({
    name: PORTAL_SESSION_COOKIE,
    value: createPortalSession(secret),
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: PORTAL_SESSION_MAX_AGE_SECONDS,
  });
  return response;
}
