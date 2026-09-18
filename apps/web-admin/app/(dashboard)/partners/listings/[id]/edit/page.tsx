"use client";

import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { AdminApi } from "@/lib/api/admin-api";
import type { AdminListing } from "@/types/admin";
import Button from "@/components/ui/Button";
import Link from "next/link";
import { ArrowLeft, Save } from "lucide-react";

export default function EditListingPage() {
  const { id } = useParams();
  const listingId = Array.isArray(id) ? id[0] : id;

  const [listing, setListing] = useState<AdminListing | null>(null);
  const [loading, setLoading] = useState(true);

  // Form states
  const [hotelName, setHotelName] = useState("");
  const [city, setCity] = useState("");
  const [address, setAddress] = useState("");
  const [stars, setStars] = useState(0);

  useEffect(() => {
    if (!listingId) return;
    AdminApi.getListing(listingId)
      .then((item) => {
        setListing(item);
        setHotelName(item.hotelName);
        setCity(item.city);
        setAddress(item.address ?? "");
        setStars(item.stars ?? 0);
      })
      .finally(() => setLoading(false));
  }, [listingId]);

  // Backend'da e'lon tafsilotlarini (nomi/shahar/manzil/yulduz) yangilaydigan
  // umumiy route hali yo'q (faqat publish/reject/visibility mavjud — audit
  // bilan tasdiqlangan). Shu sabab bu yerda soxta "saqlandi" ko'rsatib,
  // hamkor e'loniga hech narsa yozilmagani haqida foydalanuvchini
  // chalg'itmaymiz — aniq va rostgo'y cheklov xabari ko'rsatamiz.
  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    toast.error(
      "Bu bo'lim hali backend'ga ulanmagan — o'zgarishlar saqlanmaydi. Ishlab chiquvchilar jamoasiga xabar bering.",
    );
  };

  if (loading) {
    return (
      <div className="flex justify-center p-12">
        <span className="w-8 h-8 border-4 border-[var(--primary)] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!listing) {
    return (
      <div className="flex flex-col items-center justify-center p-12 text-center">
        <h2 className="text-xl font-bold text-[var(--foreground)]">E'lon topilmadi</h2>
        <Link href="/partners/listings" className="mt-4 text-[var(--primary)] hover:underline">
          Orqaga qaytish
        </Link>
      </div>
    );
  }

  return (
    <div className="max-w-[800px] mx-auto flex flex-col gap-6 animate-fade-in pb-12">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Link
          href={`/partners/listings/${listing.id}`}
          className="w-10 h-10 rounded-lg bg-[var(--bg-tertiary)] flex items-center justify-center text-[var(--muted-foreground)] hover:bg-[var(--border)] transition-colors"
        >
          <ArrowLeft size={18} />
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-[var(--foreground)]">E'lonni tahrirlash</h1>
          <p className="text-sm text-[var(--muted-foreground)]">{listing.companyName} hamkorining obyekti</p>
        </div>
      </div>

      <div className="bg-[var(--card)] rounded-xl border border-[var(--border)] shadow-sm p-6">
        <div className="bg-orange-50 border border-orange-200 text-orange-800 rounded-lg p-4 mb-6 text-sm">
          <strong>Diqqat:</strong> Bu bo'lim hali backend'ga ulanmagan. Quyidagi maydonlarni o'zgartirib "Saqlash"ni bossangiz ham, hech narsa hamkorning haqiqiy e'loniga yozilmaydi.
        </div>

        <form onSubmit={handleSave} className="space-y-5">
          <div className="space-y-1">
            <label className="text-sm font-medium text-[var(--foreground)]">Obyekt nomi</label>
            <input
              type="text"
              value={hotelName}
              onChange={(e) => setHotelName(e.target.value)}
              className="w-full px-3 py-2 bg-[var(--background)] border border-[var(--border)] rounded-md outline-none focus:border-[var(--primary)] text-[var(--foreground)]"
              required
            />
          </div>
          
          <div className="space-y-1">
            <label className="text-sm font-medium text-[var(--foreground)]">Yulduzlar soni</label>
            <input
              type="number"
              min="0"
              max="5"
              value={stars}
              onChange={(e) => setStars(Number(e.target.value))}
              className="w-full px-3 py-2 bg-[var(--background)] border border-[var(--border)] rounded-md outline-none focus:border-[var(--primary)] text-[var(--foreground)]"
              required
            />
          </div>

          <div className="space-y-1">
            <label className="text-sm font-medium text-[var(--foreground)]">Shahar</label>
            <input
              type="text"
              value={city}
              onChange={(e) => setCity(e.target.value)}
              className="w-full px-3 py-2 bg-[var(--background)] border border-[var(--border)] rounded-md outline-none focus:border-[var(--primary)] text-[var(--foreground)]"
              required
            />
          </div>

          <div className="space-y-1">
            <label className="text-sm font-medium text-[var(--foreground)]">To'liq manzil</label>
            <textarea
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              rows={3}
              className="w-full px-3 py-2 bg-[var(--background)] border border-[var(--border)] rounded-md outline-none focus:border-[var(--primary)] text-[var(--foreground)] resize-none"
              required
            />
          </div>

          <div className="pt-4 flex justify-end gap-3 border-t border-[var(--border)] mt-6">
            <Link href={`/partners/listings/${listing.id}`}>
              <Button type="button" variant="secondary">Bekor qilish</Button>
            </Link>
            <Button type="submit" icon={<Save size={16} />}>
              Saqlash
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
