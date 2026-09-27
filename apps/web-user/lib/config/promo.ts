import { config } from "./config";

export interface LocalizedString {
  uz?: string;
  ru?: string;
  en?: string;
  [key: string]: string | undefined;
}

export interface PromoBarConfig {
  id?: string;
  isActive: boolean;
  text?: LocalizedString | string;
  badge?: LocalizedString | string;
  link?: string;
  linkText?: LocalizedString | string;
  endsAt?: string | null;
  isDismissible?: boolean;
}

interface ActivePromo {
  code: string;
  discountType: string;
  discountValue: number;
  validUntil: string;
}

/**
 * Utility to resolve localized string value based on current locale.
 */
export function getLocalizedText(
  value: LocalizedString | string | undefined | null,
  locale: string
): string {
  if (!value) return "";
  if (typeof value === "string") return value;
  return value[locale] ?? value.uz ?? value.ru ?? value.en ?? Object.values(value)[0] ?? "";
}

/** Admin panelda yaratilgan, hozir amal qiladigan promo-kodlar (`GET /promos`). */
async function getActivePromos(): Promise<ActivePromo[]> {
  try {
    // Admin panelda promo-kod qo'shilishi/tahrirlanishi/o'chirilishi
    // darhol (keshsiz) ko'rinishi kerak — shuning uchun bu yerda
    // revalidate keshi ishlatilmaydi.
    const res = await fetch(`${config.apiUrl}/promos`, {
      next: { revalidate: 60 },
    });
    if (!res.ok) return [];
    const json = await res.json();
    const items = Array.isArray(json?.data) ? json.data : [];
    return items.map((row: Record<string, unknown>) => ({
      code: String(row.code ?? ""),
      discountType: String(row.discount_type ?? row.discountType ?? "percent"),
      discountValue: Number(row.discount_value ?? row.discountValue ?? 0),
      validUntil: String(row.valid_until ?? row.validUntil ?? ""),
    }));
  } catch {
    return [];
  }
}

function promoDiscountText(promo: ActivePromo): string {
  if (promo.discountType.startsWith("percent")) {
    return `${promo.discountValue}%`;
  }
  return `${new Intl.NumberFormat("uz-UZ").format(promo.discountValue)} so'm`;
}

/**
 * Sayt tepasidagi banner: avval hozir amal qiladigan promo-kodlar bo'lsa
 * ularning barchasini ko'rsatadi (amal qilish muddati tugasa keyingi sahifa
 * yuklanishida avtomatik yo'qoladi — chunki backend uni ro'yxatdan olib
 * tashlaydi). Aktiv promo-kod bo'lmasa, admin CMS'da qo'lda sozlagan
 * umumiy bannerga qaytadi. Hech narsa bo'lmasa bo'sh massiv qaytadi.
 */
export async function getPromoBarConfig(locale: string): Promise<PromoBarConfig[]> {
  const activePromos = await getActivePromos();

  if (activePromos.length > 0) {
    return activePromos.map((promo) => ({
      id: `promo-${promo.code}`,
      isActive: true,
      badge: "Aksiya",
      text: `Bron qilishda ${promoDiscountText(promo)} chegirma — ${promo.code} promokodi bilan!`,
      endsAt: promo.validUntil || null,
      isDismissible: true,
    }));
  }

  try {
    const res = await fetch(`${config.apiUrl}/cms/promo-bar`, {
      headers: {
        "Accept-Language": locale,
      },
      next: { revalidate: 60 },
    });

    if (!res.ok) return [];

    const data = await res.json();
    if (!data) return [];

    const cmsConfig: PromoBarConfig = {
      id: data.id,
      isActive: data.isActive ?? data.is_active ?? false,
      text: data.text,
      badge: data.badge,
      link: data.link,
      linkText: data.linkText ?? data.link_text,
      endsAt: data.endsAt ?? data.ends_at ?? null,
      isDismissible: data.isDismissible ?? data.is_dismissible ?? true,
    };

    return [cmsConfig];
  } catch {
    return [];
  }
}
