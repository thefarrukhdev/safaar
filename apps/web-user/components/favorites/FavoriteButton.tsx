"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { cn } from "@/lib/cn";
import type { FavoritesDict } from "@/i18n/dictionaries";
import { Button } from "@/components/ui/Button";
import {
  addFavoriteAction,
  removeFavoriteAction,
} from "@/lib/account/favorites-actions";

/**
 * Sevimli (♥) tugmasi — mehmonxona/mashina detal sahifasida.
 * Client komponent: holatni saqlaydi va server action'larni chaqiradi.
 */
export function FavoriteButton({
  targetType,
  targetId,
  initialFavoriteId,
  authed,
  loginHref,
  dict,
}: {
  targetType: "hotel" | "bus" | "restaurant" | "transport" | "attraction";
  targetId: string;
  initialFavoriteId: string | null;
  authed: boolean;
  loginHref: string;
  dict: FavoritesDict;
}) {
  const router = useRouter();
  const [favoriteId, setFavoriteId] = useState<string | null>(
    initialFavoriteId,
  );
  const [pending, startTransition] = useTransition();

  const isFavorite = !!favoriteId;
  const label = pending
    ? dict.pending
    : isFavorite
      ? dict.remove
      : authed
        ? dict.add
        : dict.loginRequired;

  function handleClick() {
    if (!authed) {
      router.push(loginHref);
      return;
    }

    startTransition(async () => {
      if (favoriteId) {
        const res = await removeFavoriteAction(favoriteId);
        if (res.ok) {
          setFavoriteId(null);
        } else if (res.authRequired) {
          router.push(loginHref);
        }
      } else {
        const res = await addFavoriteAction(targetType, targetId);
        if (res.ok && res.id) {
          setFavoriteId(res.id);
        } else if (res.authRequired) {
          router.push(loginHref);
        }
      }
    });
  }

  return (
    <Button
      type="button"
      onClick={handleClick}
      disabled={pending}
      variant="secondary"
      size="sm"
      aria-pressed={isFavorite}
      aria-label={label}
      title={pending ? dict.pending : label}
      className={cn(
        "inline-flex items-center gap-2 border border-slate-200 hover:border-slate-350 shadow-2xs font-semibold",
        isFavorite
          ? "bg-rose-50 border-rose-100 hover:bg-rose-100/80 text-rose-600"
          : "text-slate-700",
      )}
    >
      <span aria-hidden className={cn("text-xs transition-transform duration-200", isFavorite ? "text-rose-500 scale-110" : "text-slate-400")}>
        {isFavorite ? "♥" : "♡"}
      </span>
      <span>{isFavorite ? dict.added : dict.add}</span>
    </Button>
  );
}
