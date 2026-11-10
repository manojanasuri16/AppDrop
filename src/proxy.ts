import { NextResponse, type NextRequest } from "next/server";
import { jwtVerify } from "jose";

/**
 * First gate for /admin. Every admin page and server action ALSO calls requireAdmin(),
 * so this is defense in depth, not the only check.
 */
export async function proxy(req: NextRequest) {
  const { pathname } = req.nextUrl;
  if (pathname === "/admin/login") return NextResponse.next();
  const token = req.cookies.get("appdrop_session")?.value;
  let ok = false;
  if (token && process.env.SESSION_SECRET) {
    try {
      const { payload } = await jwtVerify(token, new TextEncoder().encode(process.env.SESSION_SECRET), {
        audience: "appdrop-admin",
        algorithms: ["HS256"],
      });
      ok = payload.role === "admin";
    } catch {}
  }
  if (!ok) return NextResponse.redirect(new URL("/admin/login", req.url));
  const res = NextResponse.next();
  res.headers.set("X-Robots-Tag", "noindex, nofollow");
  res.headers.set("Cache-Control", "no-store");
  return res;
}

export const config = { matcher: ["/admin", "/admin/:path*"] };
