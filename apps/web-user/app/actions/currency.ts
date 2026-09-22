"use server";

import { cookies } from "next/headers";
import { type CurrencyCode } from "@/lib/utils/money";

export async function setCurrencyCookie(currency: CurrencyCode) {
  const cookieStore = await cookies();
  cookieStore.set("safaar_currency", currency, {
    path: "/",
    maxAge: 31536000, // 1 year
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
  });
}
