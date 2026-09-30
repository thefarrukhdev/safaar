import { type NextRequest, NextResponse } from "next/server";

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? "https://api.safaar.uz/v1";

/**
 * GET /api/hotels/map?neLat=...&neLng=...&swLat=...&swLng=...&locale=uz&limit=50
 *
 * Server-side proxy for the map bounds hotel query.
 * The browser cannot call api.safaar.uz directly due to CORS restrictions —
 * this route handler runs on the Next.js server which has no such limitation.
 */
export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl;

  const params = new URLSearchParams();
  for (const [key, value] of searchParams.entries()) {
    if (key !== "locale" && key !== "neLat" && key !== "neLng" && key !== "swLat" && key !== "swLng") {
      params.set(key, value);
    }
  }

  const neLat = searchParams.get("neLat");
  const neLng = searchParams.get("neLng");
  const swLat = searchParams.get("swLat");
  const swLng = searchParams.get("swLng");

  if (neLat && neLng && swLat && swLng) {
    params.set("bounds", `${swLat},${swLng},${neLat},${neLng}`);
  }

  const locale = searchParams.get("locale") ?? "uz";

  try {
    const upstream = await fetch(
      `${API_BASE}/hotels?${params.toString()}`,
      {
        headers: {
          "Accept-Language": locale,
          "Content-Type": "application/json",
        },
        next: { revalidate: 0 },
      }
    );

    if (!upstream.ok) {
      return NextResponse.json(
        { items: [], total: 0 },
        { status: upstream.status }
      );
    }

    const data = await upstream.json();
    return NextResponse.json(data);
  } catch {
    return NextResponse.json({ items: [], total: 0 }, { status: 502 });
  }
}
