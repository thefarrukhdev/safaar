"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Button } from "../ui/button";
import { Dialog } from "../ui/dialog";
import { CheckCircle2, ArrowRight, Building2, BedDouble, Wallet } from "lucide-react";
import { useRoomTypes } from "../../_hooks/use-room-types";
import { useRooms } from "../../_hooks/use-rooms";
import { useVehicles } from "../../_hooks/use-vehicles";
import { useAuthStore } from "../../_stores/auth-store";
import { getPartnerLabels, hasBuses } from "../../_lib/utils/partner-labels";

export function OnboardingWizard() {
  const router = useRouter();
  const roomTypes = useRoomTypes();
  const rooms = useRooms();
  const user = useAuthStore((s) => s.user);
  
  const partnerType = user?.partnerType ?? "hotel";
  const isBus = hasBuses(partnerType);
  const labels = getPartnerLabels(partnerType);
  
  const [open, setOpen] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  const vehicles = useVehicles();
  
  const hasRoomTypes = isBus ? true : (roomTypes.data && roomTypes.data.length > 0);
  const hasRooms = isBus ? (vehicles.data && vehicles.data.length > 0) : (rooms.data && rooms.data.length > 0);
  
  const isLoaded = isBus ? !vehicles.isLoading : (!roomTypes.isLoading && !rooms.isLoading);

  useEffect(() => {
    if (isLoaded && !hasRoomTypes && !hasRooms && !dismissed) {
      const stored = localStorage.getItem("safaar_onboarding_dismissed");
      if (!stored) {
        const timeoutId = setTimeout(() => setOpen(true), 0);
        return () => clearTimeout(timeoutId);
      }
    }
  }, [isLoaded, hasRoomTypes, hasRooms, dismissed]);

  const handleDismiss = () => {
    setOpen(false);
    setDismissed(true);
    localStorage.setItem("safaar_onboarding_dismissed", "true");
  };

  if (!isLoaded || (hasRoomTypes && hasRooms)) return null;

  const currentStep = !hasRoomTypes ? 1 : !hasRooms ? 2 : 3;

  return (
    <Dialog 
      open={open} 
      onClose={handleDismiss} 
      title="Xush kelibsiz! Tizimni sozlaymiz"
      description={`${labels.unitSingular}larni onlayn sotishni boshlash uchun dastlabki sozlamalarni bajarishingiz kerak. Bu atigi 3 daqiqa vaqt oladi.`}
      size="lg"
      footer={
        <div className="flex w-full justify-center">
          <Button variant="ghost" className="text-zinc-500" onClick={handleDismiss}>
            Keyinroq qilish (Yopish)
          </Button>
        </div>
      }
    >
        <div className="flex flex-col gap-4 py-2">
          {/* 1-Qadam */}
          <div className={`flex gap-4 p-4 rounded-xl border transition-all ${currentStep === 1 ? 'border-brand-500 bg-brand-50/50 dark:border-brand-500/50 dark:bg-brand-500/10' : 'border-zinc-200 dark:border-zinc-800'}`}>
            <div className="shrink-0 mt-0.5">
              {currentStep > 1 ? (
                <CheckCircle2 className="w-6 h-6 text-emerald-500" />
              ) : (
                <div className="w-6 h-6 rounded-full bg-brand-100 dark:bg-brand-900/50 flex items-center justify-center text-brand-600 font-bold text-xs">1</div>
              )}
            </div>
            <div className="flex-1 flex flex-col gap-1">
              <h3 className={`font-semibold ${currentStep === 1 ? 'text-brand-900 dark:text-brand-100' : 'text-zinc-900 dark:text-zinc-100'}`}>
                {labels.unitTypeLabel}larini yarating
              </h3>
              <p className="text-sm text-zinc-500">
                Masalan: "Lyuks", "Standart" kabi toifalarni va ularning umumiy narxlarini belgilang.
              </p>
              {currentStep === 1 && (
                <div className="mt-3">
                  <Button onClick={() => { setOpen(false); router.push('/listing'); }} size="sm" className="gap-2">
                    <Building2 className="w-4 h-4" />
                    Yaratishni boshlash
                    <ArrowRight className="w-4 h-4 ml-1" />
                  </Button>
                </div>
              )}
            </div>
          </div>

          {/* 2-Qadam */}
          <div className={`flex gap-4 p-4 rounded-xl border transition-all ${currentStep === 2 ? 'border-brand-500 bg-brand-50/50 dark:border-brand-500/50 dark:bg-brand-500/10' : 'border-zinc-200 dark:border-zinc-800 opacity-70'}`}>
            <div className="shrink-0 mt-0.5">
              {currentStep > 2 ? (
                <CheckCircle2 className="w-6 h-6 text-emerald-500" />
              ) : (
                <div className={`w-6 h-6 rounded-full flex items-center justify-center font-bold text-xs ${currentStep === 2 ? 'bg-brand-100 text-brand-600 dark:bg-brand-900/50' : 'bg-zinc-100 text-zinc-400 dark:bg-zinc-800'}`}>2</div>
              )}
            </div>
            <div className="flex-1 flex flex-col gap-1">
              <h3 className={`font-semibold ${currentStep === 2 ? 'text-brand-900 dark:text-brand-100' : 'text-zinc-900 dark:text-zinc-100'}`}>
                {labels.unitSingular}larni qo'shing
              </h3>
              <p className="text-sm text-zinc-500">
                Yaratilgan toifalarga aniq {labels.unitSingular.toLowerCase()} raqamlarini biriktirib chiqing (masalan: 101, 102).
              </p>
              {currentStep === 2 && (
                <div className="mt-3">
                  <Button onClick={() => { setOpen(false); router.push('/rooms'); }} size="sm" className="gap-2">
                    <BedDouble className="w-4 h-4" />
                    {labels.unitPlural.charAt(0).toUpperCase() + labels.unitPlural.slice(1)} qo'shish
                    <ArrowRight className="w-4 h-4 ml-1" />
                  </Button>
                </div>
              )}
            </div>
          </div>

          {/* 3-Qadam */}
          <div className={`flex gap-4 p-4 rounded-xl border transition-all ${currentStep === 3 ? 'border-brand-500 bg-brand-50/50 dark:border-brand-500/50 dark:bg-brand-500/10' : 'border-zinc-200 dark:border-zinc-800 opacity-70'}`}>
            <div className="shrink-0 mt-0.5">
              <div className={`w-6 h-6 rounded-full flex items-center justify-center font-bold text-xs ${currentStep === 3 ? 'bg-brand-100 text-brand-600 dark:bg-brand-900/50' : 'bg-zinc-100 text-zinc-400 dark:bg-zinc-800'}`}>3</div>
            </div>
            <div className="flex-1 flex flex-col gap-1">
              <h3 className="font-semibold text-zinc-900 dark:text-zinc-100">
                E'longa chiqaring
              </h3>
              <p className="text-sm text-zinc-500">
                Barcha ma'lumotlar tayyor bo'lgach, xonalarni sotuvga chiqaring.
              </p>
              {currentStep === 3 && (
                <div className="mt-3">
                  <Button onClick={() => { setOpen(false); router.push('/rooms'); }} size="sm" className="gap-2">
                    <Wallet className="w-4 h-4" />
                    Boshlash
                    <ArrowRight className="w-4 h-4 ml-1" />
                  </Button>
                </div>
              )}
            </div>
          </div>
        </div>
    </Dialog>
  );
}
