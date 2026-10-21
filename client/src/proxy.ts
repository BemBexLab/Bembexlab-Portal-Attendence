import { NextRequest, NextResponse } from "next/server";

import {
  PORTAL_SESSION_COOKIE,
  verifyPortalSession,
} from "@/lib/portal-auth";

const publicAuthPaths = new Set(["/api/auth/login", "/api/auth/logout"]);

function noStore(response: NextResponse) {
  response.headers.set("Cache-Control", "private, no-store, max-age=0");
  return response;
}

export function proxy(request: NextRequest) {
  const pathname = request.nextUrl.pathname;

  if (publicAuthPaths.has(pathname)) return noStore(NextResponse.next());

  const authenticated = verifyPortalSession(
    request.cookies.get(PORTAL_SESSION_COOKIE)?.value,
    process.env.PORTAL_AUTH_SECRET,
  );

  if (pathname === "/login") {
    return authenticated
      ? noStore(NextResponse.redirect(new URL("/attendance", request.url)))
      : noStore(NextResponse.next());
  }
  if (authenticated) return noStore(NextResponse.next());

  if (pathname === "/api" || pathname.startsWith("/api/")) {
    return noStore(
      NextResponse.json({ error: "Unauthorized" }, { status: 401 }),
    );
  }

  const loginUrl = new URL("/login", request.url);
  if (pathname !== "/") loginUrl.searchParams.set("next", pathname);
  return noStore(NextResponse.redirect(loginUrl));
}

export const config = {
  matcher: ["/((?!_next/|favicon.ico).*)"],
};
