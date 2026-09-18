"use client";

import { useState, useEffect } from "react";
import { toast } from "sonner";
import { AdminApi } from "@/lib/api/admin-api";
import type { AdminListing } from "@/types/admin";
import Button from "@/components/ui/Button";
import { ArrowUp, ArrowDown, CheckCircle2 } from "lucide-react";
import { extractApiErrorMessage } from "@/lib/utils";

export default function FeaturedHotelsPage() {
  const [items, setItems] = useState<AdminListing[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        setLoading(true);
        // Barcha mehmonxonalarni olamiz va faqat mashhurlarini ajratamiz
        const all = await AdminApi.getListings();
        if (!cancelled) {
          const featured = all.filter((l) => l.featured);
          setItems(featured);
        }
      } catch (error) {
        if (!cancelled) {
          toast.error("Mashhur takliflarni yuklab bo'lmadi.");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    load();
    return () => { cancelled = true; };
  }, []);

  const moveUp = (index: number) => {
    if (index === 0) return;
    const newItems = [...items];
    const temp = newItems[index];
    newItems[index] = newItems[index - 1];
    newItems[index - 1] = temp;
    setItems(newItems);
    setHasChanges(true);
  };

  const moveDown = (index: number) => {
    if (index === items.length - 1) return;
    const newItems = [...items];
    const temp = newItems[index];
    newItems[index] = newItems[index + 1];
    newItems[index + 1] = temp;
    setItems(newItems);
    setHasChanges(true);
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const orderedIds = items.map(item => item.id);
      await AdminApi.reorderFeaturedListings(orderedIds);
      toast.success("Tartib muvaffaqiyatli saqlandi!");
      setHasChanges(false);
    } catch (error) {
      toast.error(extractApiErrorMessage(error, "Saqlashda xatolik yuz berdi"));
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="max-w-[800px] mx-auto p-8 flex justify-center">
        <span className="w-6 h-6 border-2 border-[var(--primary)] border-t-transparent rounded-full animate-spin"></span>
      </div>
    );
  }

  return (
    <div className="max-w-[800px] mx-auto flex flex-col gap-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <div className="flex flex-col gap-1">
          <h1 className="text-2xl font-bold text-[var(--text-primary)]">Mashhur takliflar</h1>
          <p className="text-sm text-[var(--text-muted)]">Saytning bosh sahifasida ko'rinadigan tavsiya etilgan mehmonxonalar tartibini belgilang.</p>
        </div>
        <Button 
          icon={<CheckCircle2 size={16} />} 
          onClick={handleSave} 
          disabled={!hasChanges || saving}
        >
          {saving ? "Saqlanmoqda..." : "Tartibni saqlash"}
        </Button>
      </div>

      <div className="bg-[var(--background)] border border-[var(--border)] rounded-xl overflow-hidden">
        {items.length === 0 ? (
          <div className="p-8 text-center text-[var(--text-muted)]">
            Hali birorta ham mehmonxona mashhur deb belgilanmagan. <br />
            "E'lonlar" bo'limidan mehmonxonalarni mashhur deb belgilang.
          </div>
        ) : (
          <div className="flex flex-col">
            {items.map((item, index) => (
              <div 
                key={item.id}
                className="flex items-center justify-between p-4 border-b border-[var(--border)] last:border-b-0 hover:bg-[var(--bg-tertiary)] transition-colors group"
              >
                <div className="flex items-center gap-4">
                  <div className="flex flex-col items-center gap-1 opacity-50 group-hover:opacity-100 transition-opacity">
                    <button 
                      onClick={() => moveUp(index)} 
                      disabled={index === 0}
                      className="p-1 rounded hover:bg-[var(--border)] disabled:opacity-30 transition-colors text-[var(--text-secondary)]"
                    >
                      <ArrowUp size={16} />
                    </button>
                    <button 
                      onClick={() => moveDown(index)}
                      disabled={index === items.length - 1}
                      className="p-1 rounded hover:bg-[var(--border)] disabled:opacity-30 transition-colors text-[var(--text-secondary)]"
                    >
                      <ArrowDown size={16} />
                    </button>
                  </div>
                  <div className="flex items-center gap-4">
                    {item.photos && item.photos[0] ? (
                      <img src={item.photos[0]} alt="" className="w-16 h-12 rounded object-cover border border-[var(--border)]" />
                    ) : (
                      <div className="w-16 h-12 rounded bg-[var(--border)] flex items-center justify-center text-xs text-[var(--text-muted)]">Rasm yo'q</div>
                    )}
                    <div className="flex flex-col">
                      <span className="font-semibold text-[var(--text-primary)]">{item.hotelName}</span>
                      <span className="text-xs text-[var(--text-muted)]">{item.city} &bull; {item.stars} yulduz</span>
                    </div>
                  </div>
                </div>
                
                <div className="text-xl font-bold text-[var(--border)] select-none">
                  #{index + 1}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
