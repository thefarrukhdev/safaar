import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

/**
 * Bu yerda JWT IMZOSI tekshirilmaydi (bu hamon backendning ishi — har bir
 * /admin/* chaqiruv serverda mustaqil tasdiqlanadi). Faqat token
 * STRUKTURASI (3 segment) va o'zining `exp` claim'i (muddati o'tganmi)
 * tekshiriladi — bu yerdagi yagona maqsad: "present-but-actually-expired"
 * cookie'ni "amaldagi" deb hisoblab, foydalanuvchini /login'dan zo'rlab
 * /dashboard'ga qaytarib yubormaslik. Aynan shu — cookie muddati o'tgan
 * bo'lsa ham present bo'lgani uchun proxy uni "bor" deb hisoblab,
 * /login -> /dashboard'ga otib yuborishi, keyin /dashboard darhol 401
 * bo'lib, client qaytadan /login'ga qaytishi — production'da kuzatilgan
 * uzluksiz /login <-> /dashboard 307/304 loopning tuzilmaviy sababi edi.
 */
function isTokenStructurallyValid(token: string): boolean {
  try {
    const parts = token.split(".");
    if (parts.length !== 3) return false;
    const base64 = parts[1].replace(/-/g, "+").replace(/_/g, "/");
    const padded = base64 + "=".repeat((4 - (base64.length % 4)) % 4);
    const payload = JSON.parse(atob(padded)) as { exp?: number };
    if (typeof payload.exp !== "number") return false;
    return payload.exp * 1000 > Date.now();
  } catch {
    return false;
  }
}

export function proxy(request: NextRequest) {
  const rawToken = request.cookies.get("admin_token")?.value;
  const token = rawToken && isTokenStructurallyValid(rawToken) ? rawToken : undefined;
  const isAuthPage = request.nextUrl.pathname.startsWith("/login");

  if (
    request.nextUrl.pathname.startsWith("/_next") ||
    request.nextUrl.pathname.startsWith("/api") ||
    request.nextUrl.pathname.includes(".")
  ) {
    return NextResponse.next();
  }

  if (!token && !isAuthPage) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  if (token && isAuthPage) {
    return NextResponse.redirect(new URL("/dashboard", request.url));
  }

  if (request.nextUrl.pathname === "/") {
    return NextResponse.redirect(new URL("/dashboard", request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico).*)"],
};
