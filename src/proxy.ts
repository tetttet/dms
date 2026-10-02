import { NextResponse, type NextRequest } from "next/server";
import { isValidSession, SESSION_COOKIE } from "@/lib/auth";

export function proxy(request: NextRequest) {
  const valid = isValidSession(request.cookies.get(SESSION_COOKIE)?.value);
  const pathname = request.nextUrl.pathname;

  if (pathname === "/access") {
    return valid ? NextResponse.redirect(new URL("/", request.url)) : NextResponse.next();
  }
  if (valid) return NextResponse.next();
  if (pathname.startsWith("/api/")) {
    return Response.json({ error: "Login required." }, { status: 401 });
  }
  const url = request.nextUrl.clone();
  url.pathname = "/access";
  url.search = "";
  url.searchParams.set("next", pathname + request.nextUrl.search);
  return NextResponse.redirect(url);
}

export const config = {
  matcher: ["/((?!api/access|_next/static|_next/image|favicon.ico).*)"],
};
