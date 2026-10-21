import { createHmac, timingSafeEqual } from "node:crypto";

export const PORTAL_SESSION_COOKIE = "bembex_portal_session";
export const PORTAL_SESSION_MAX_AGE_SECONDS = 60 * 60 * 12;

type PortalSession = {
  iss: "bembex-portal";
  sub: "portal-user";
  iat: number;
  exp: number;
};

function sign(value: string, secret: string) {
  return createHmac("sha256", secret).update(value).digest("base64url");
}

export function isPortalPasswordValid(input: unknown) {
  const expected = process.env.PORTAL_PASSWORD;
  if (typeof input !== "string" || !expected) return false;

  const receivedBytes = Buffer.from(input, "utf8");
  const expectedBytes = Buffer.from(expected, "utf8");
  return (
    receivedBytes.length === expectedBytes.length &&
    timingSafeEqual(receivedBytes, expectedBytes)
  );
}

export function createPortalSession(secret: string) {
  const now = Math.floor(Date.now() / 1000);
  const header = Buffer.from(
    JSON.stringify({ alg: "HS256", typ: "JWT" }),
  ).toString("base64url");
  const payload = Buffer.from(
    JSON.stringify({
      iss: "bembex-portal",
      sub: "portal-user",
      iat: now,
      exp: now + PORTAL_SESSION_MAX_AGE_SECONDS,
    } satisfies PortalSession),
  ).toString("base64url");
  const unsignedToken = `${header}.${payload}`;
  return `${unsignedToken}.${sign(unsignedToken, secret)}`;
}

export function verifyPortalSession(
  token: string | undefined,
  secret: string | undefined,
) {
  if (!token || !secret) return false;

  const [header, payload, signature, ...extra] = token.split(".");
  if (!header || !payload || !signature || extra.length) return false;

  const unsignedToken = `${header}.${payload}`;
  const expectedSignature = Buffer.from(sign(unsignedToken, secret));
  const actualSignature = Buffer.from(signature);
  if (
    expectedSignature.length !== actualSignature.length ||
    !timingSafeEqual(expectedSignature, actualSignature)
  ) {
    return false;
  }

  try {
    const parsedHeader = JSON.parse(
      Buffer.from(header, "base64url").toString("utf8"),
    ) as { alg?: string; typ?: string };
    const session = JSON.parse(
      Buffer.from(payload, "base64url").toString("utf8"),
    ) as Partial<PortalSession>;
    const now = Math.floor(Date.now() / 1000);

    return (
      parsedHeader.alg === "HS256" &&
      parsedHeader.typ === "JWT" &&
      session.iss === "bembex-portal" &&
      session.sub === "portal-user" &&
      typeof session.iat === "number" &&
      session.iat <= now &&
      typeof session.exp === "number" &&
      session.exp > now
    );
  } catch {
    return false;
  }
}
