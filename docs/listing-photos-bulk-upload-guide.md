# 📋 Frontend Guide: E'londa 3 ta Rasmni Birdan Yuklash va Kategoriyani Ixtiyoriy/Olib Tashlash

**Mas'ul:** Frontend dasturchi (`apps/web-partner dev`)  
**Muallif:** Backend jamoasi  
**Sana:** 2026-10-15  
**Muhimlik darajasi:** 🟢 Yangi imkoniyat (Feature)  
**Holat:** 🚀 Backend to'liq tayyor, integratsiya uchun ochiq  

---

## 1. Vazifa Maqsadi (Objective)

Hamkor e'lon yaratayotganida yoki tahrirlayotganida (`partner.safaar.uz/listing` sahifasida):
1. **Birdaniga 3 ta (yoki xohlagancha) rasm yuklash imkoniyati:** Hamkor har bir rasmni bittalab yuklashga majbur bo'lmasligi, fayl tanlash oynasidan birdaniga 3 ta rasmni tanlab bir martada yuklashi (bulk/multiple upload) yoki xohlasa bittalab yuklashi mumkin bo'lishi kerak.
2. **Kategoriya majburiy emas:** Rasm yuklash dialogidagi "Kategoriya" (Fasad, Lobbi, Xona, Restoran va h.k.) majburiy bo'lmasligi, foydalanuvchi interfeysidan butunlay olib tashlanishi yoki ixtiyoriy bo'lishi kerak.

---

## 2. Backendda Amalga Oshirilgan Yangilanishlar

Backend tomonida barcha kerakli endpointlar va tekshiruvlar to'liq yangilandi va 100% testlar bilan qoplandi:

### A. Rasm yuklash endpointlari (`/uploads`)
1. **`POST /uploads/images/batch`** (Yangi endpoint):
   - Multipart form-data orqali `files` (1 dan 10 tagacha rasm) qabul qiladi.
   - Javob:
     ```json
     {
       "items": [
         { "id": "uuid-1", "url": "https://cdn.safaar.uz/1.jpg" },
         { "id": "uuid-2", "url": "https://cdn.safaar.uz/2.jpg" },
         { "id": "uuid-3", "url": "https://cdn.safaar.uz/3.jpg" }
       ],
       "count": 3
     }
     ```
2. **`POST /uploads/images`** (Kengaytirilgan endpoint, 100% backward-compatible):
   - Bitta fayl yuborilsa: avvalgidek `{ id, url, ... }` qaytaradi.
   - Bir nechta fayl yuborilsa: bir vaqtning o'zida ham `{ id, url, ... }` (birinchi fayl) ham `{ items: [...], count }` massivini qaytaradi.

### B. Mehmonxonaga rasmlarni biriktirish endpointi
**`POST /partners/hotels/:id/images`** (va `POST /partners/hotels/:id/rooms/:roomId/images`):
1. **Ko'p rasm qo'llab-quvvatlashi:**
   - JSON body orqali `file_ids: ["uuid-1", "uuid-2", "uuid-3"]` massivini qabul qiladi.
   - Yoki to'g'ridan-to'g'ri `multipart/form-data` orqali `files` (fayllar) yuborilsa, o'zi yuklab, mehmonxonaga biriktirib beradi.
2. **Kategoriya ixtiyoriy (Kategoriya kerak emas):**
   - `category` maydoni yuborilmasa yoki bo'sh bo'lsa, xato bermaydi, bazada `NULL` qilib saqlanadi.
3. **Avtomatik tartiblash (Ordering & Cover):**
   - Agar mehmonxonada hali rasm bo'lmasa, yuklangan birinchi rasm avtomatik `is_cover: true` bo'ladi, qolganlari `false`.
   - `sort_order` tartib raqamlari ketma-ket (0, 1, 2...) saqlanadi.
4. **Javob formati:**
   ```json
   {
     "hotel_id": "hotel-uuid",
     "image_id": "uuid-1",
     "image_url": "https://cdn.safaar.uz/1.jpg",
     "count": 3,
     "images": [
       { "image_id": "uuid-1", "image_url": "https://cdn.safaar.uz/1.jpg" },
       { "image_id": "uuid-2", "image_url": "https://cdn.safaar.uz/2.jpg" },
       { "image_id": "uuid-3", "image_url": "https://cdn.safaar.uz/3.jpg" }
     ]
   }
   ```

---

## 3. Frontendda Qilinishi Kerak Bo'lgan Qadamlar (`apps/web-partner`)

### 1-qadam: API mijoziga batch upload funksiyasini qo'shish
📍 **Fayl:** `apps/web-partner/app/_lib/api/endpoints/partners.ts`

```ts
export async function uploadImagesBatch(files: File[], token?: string | null) {
  const formData = new FormData();
  for (const file of files) {
    formData.append('files', file);
  }
  return requestFormData<{
    items: Array<{ id: string; url: string }>;
    count: number;
  }>('/uploads/images/batch', formData, { token });
}

export function addHotelImages(
  hotelId: string,
  payload: { fileIds?: string[]; fileId?: string; caption?: string; category?: string },
  token?: string | null,
) {
  return request<{ hotel_id: string; images: Array<{ image_id: string; image_url: string }> }>(
    `/partners/hotels/${encodeURIComponent(hotelId)}/images`,
    {
      method: 'POST',
      body: payload,
      token,
    },
  );
}
```

---

### 2-qadam: Hookni bir nechta fayllarni qabul qiladigan qilish
📍 **Fayl:** `apps/web-partner/app/_hooks/use-listing.ts`

`useAddListingPhoto` ni kengaytirish yoki `useAddListingPhotos` qilish:

```ts
export function useAddListingPhotos() {
  const accessToken = useAuthStore((s) => s.tokens?.accessToken);
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ files, caption }: { files: File[]; caption?: string }) => {
      const hotel = await getPrimaryHotel(accessToken);
      
      // 1. Rasmlarni batch yuklash
      const uploadRes = await partners.uploadImagesBatch(files, accessToken);
      const fileIds = uploadRes.items.map((it) => it.id);

      // 2. Mehmonxonaga biriktirish (kategoriyasiz)
      await partners.addHotelImages(
        hotel.id,
        {
          fileIds,
          caption: caption?.trim() || undefined,
        },
        accessToken,
      );

      return toListing(await partners.getHotel(hotel.id, accessToken));
    },
    onSuccess: (listing) => {
      queryClient.setQueryData(listingQueryKey, listing);
      void queryClient.invalidateQueries({ queryKey: listingQueryKey });
    },
  });
}
```

---

### 3-qadam: Rasm yuklash dialogini yangilash (Multiple + Kategoriyasiz)
📍 **Fayl:** `apps/web-partner/app/(dashboard)/listing/_editors/photos-editor.tsx`

`AddPhotoDialog` komponentida:
1. `file: File | null` o'rniga `files: File[]` massiv holatini saqlash.
2. `<input type="file" multiple accept="image/*" />` qo'yish (foydalanuvchi bir vaqtda 1 tadan 3 tagacha yoki undan ko'p rasm tanlay oladi).
3. "Kategoriya" tanlash `select` blokini butunlay olib tashlash.
4. Oldindan ko'rish (preview) blokida tanlangan barcha rasmlarni mini-galereya qilib ko'rsatish.

**Namuna kod (`AddPhotoDialog`):**
```tsx
function AddPhotoDialog({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const addPhotos = useAddListingPhotos();
  const [files, setFiles] = useState<File[]>([]);
  const [previewUrls, setPreviewUrls] = useState<string[]>([]);
  const [caption, setCaption] = useState("");

  const reset = () => {
    previewUrls.forEach((url) => URL.revokeObjectURL(url));
    setFiles([]);
    setPreviewUrls([]);
    setCaption("");
  };

  const handleFilesSelected = (newFiles: FileList | null) => {
    if (!newFiles || newFiles.length === 0) return;
    const fileArray = Array.from(newFiles);
    
    // Eski URL larni tozalash
    previewUrls.forEach((url) => URL.revokeObjectURL(url));
    
    setFiles(fileArray);
    setPreviewUrls(fileArray.map((f) => URL.createObjectURL(f)));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (files.length === 0) {
      toast.error("Kamida bitta rasm tanlang");
      return;
    }

    try {
      await addPhotos.mutateAsync({
        files,
        caption: caption.trim() || undefined,
      });
      toast.success(`${files.length} ta rasm muvaffaqiyatli yuklandi`);
      reset();
      onClose();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Rasmlarni yuklab bo'lmadi");
    }
  };

  return (
    <Dialog
      open={open}
      onClose={() => {
        reset();
        onClose();
      }}
      title="Rasm yuklash"
      description="1 tadan 3 tagacha (yoki ko'proq) rasm tanlang. Kategoriya talab etilmaydi."
      size="lg"
    >
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <div className="flex flex-col gap-1.5">
          <Label>Qurilmadan rasmlarni tanlash (1 yoki bir nechta)</Label>
          <label className="flex h-32 w-full cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed border-[var(--border)] bg-[var(--surface-muted)] transition-colors hover:border-brand-500 hover:bg-[var(--surface)]">
            <ImageIcon className="mb-2 h-8 w-8 text-zinc-400" />
            <span className="text-sm font-medium text-zinc-600">
              {files.length > 0
                ? `${files.length} ta rasm tanlandi (O'zgartirish uchun bosing)`
                : "Bir yoki bir nechta rasm tanlash uchun bosing"}
            </span>
            <input
              type="file"
              accept="image/*"
              multiple
              className="hidden"
              onChange={(e) => handleFilesSelected(e.target.files)}
            />
          </label>
        </div>

        {/* Kategoriya bloki olib tashlandi — kategoriya endi kerak emas */}

        <div className="flex flex-col gap-1.5">
          <Label htmlFor="p-cap">Izoh (ixtiyoriy)</Label>
          <Input
            id="p-cap"
            value={caption}
            placeholder="Masalan: Mehmonxona ko'rinishi"
            onChange={(e) => setCaption(e.target.value)}
          />
        </div>

        {previewUrls.length > 0 && (
          <div className="grid grid-cols-3 gap-2 rounded-card border border-[var(--border)] p-2">
            {previewUrls.map((url, idx) => (
              <div key={idx} className="relative aspect-video overflow-hidden rounded-lg bg-zinc-100">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={url}
                  alt={`Preview ${idx + 1}`}
                  className="h-full w-full object-cover"
                />
              </div>
            ))}
          </div>
        )}

        <div className="flex justify-end gap-2 pt-2">
          <Button
            type="button"
            variant="outline"
            onClick={() => {
              reset();
              onClose();
            }}
          >
            Bekor qilish
          </Button>
          <Button type="submit" disabled={files.length === 0 || addPhotos.isPending}>
            {addPhotos.isPending ? "Yuklanmoqda..." : "Yuklash"}
          </Button>
        </div>
      </form>
    </Dialog>
  );
}
```

---

## 4. Xulosa

Backend tomonidan barcha imkoniyatlar yaratildi:
- Bir martada 3 ta (yoki ko'proq) rasm yuklash to'liq qo'llab-quvvatlanadi.
- Kategoriya maydoni majburiy emas, yuborilmasa bazaga to'g'ri saqlanadi.
- Frontendchi yuqoridagi 3 qadamni qo'llab, `web-partner` dagi formani yangilasa kifoya.
