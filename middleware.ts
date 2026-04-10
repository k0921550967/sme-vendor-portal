import { auth } from "@/auth";
import { NextResponse } from "next/server";

export default auth((req) => {
  const { nextUrl } = req;
  const isLoggedIn = !!req.auth?.user;

  // 已登入訪問首頁 → 跳轉 dashboard
  if (nextUrl.pathname === "/" && isLoggedIn) {
    return NextResponse.redirect(new URL("/dashboard", nextUrl));
  }

  // 未登入訪問 dashboard → 跳轉首頁
  if (nextUrl.pathname.startsWith("/dashboard") && !isLoggedIn) {
    return NextResponse.redirect(new URL("/", nextUrl));
  }

  return NextResponse.next();
});

export const config = {
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico).*)"],
};
