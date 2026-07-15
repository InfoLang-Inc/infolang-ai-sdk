import { NextResponse, type NextRequest } from "next/server";

/**
 * Assign each visitor a stable id so their memories persist across sessions.
 * The id becomes the InfoLang namespace (memory bank) for that user.
 *
 * (Next.js 16 renamed the `middleware` convention to `proxy`.)
 */
export function proxy(request: NextRequest): NextResponse {
  if (request.cookies.get("il_uid")) return NextResponse.next();

  const response = NextResponse.next();
  response.cookies.set("il_uid", crypto.randomUUID(), {
    httpOnly: true,
    sameSite: "lax",
    maxAge: 60 * 60 * 24 * 365,
    path: "/",
  });
  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
