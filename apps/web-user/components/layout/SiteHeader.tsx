import Link from "next/link";
import { Building2, UtensilsCrossed, Car, Landmark } from "lucide-react";
import type { Locale } from "@/i18n/config";
import type { CommonDict } from "@/i18n/dictionaries";
import { logoutAction } from "@/lib/auth/actions";
import { Button } from "@/components/ui/Button";
import { buttonVariants } from "@/components/ui/button-variants";
import { cn } from "@/lib/cn";
import { CurrencySwitcher } from "./CurrencySwitcher";
import { LocaleSwitcher } from "./LocaleSwitcher";
import { HeaderWrapper, type NavItem } from "./header";

function AuthButtons({
  authed,
  locale,
  dict,
  orientation = "horizontal",
}: {
  authed: boolean;
  locale: Locale;
  dict: CommonDict;
  orientation?: "horizontal" | "vertical";
}) {
  const base = `/${locale}`;
  const isCol = orientation === "vertical";
  const sizeClass = isCol ? "w-full min-h-[48px] text-[15px]" : "";

  const transparentClasses = isCol 
    ? "" 
    : "group-data-[transparent=true]/header:bg-white/10 group-data-[transparent=true]/header:text-white group-data-[transparent=true]/header:border-white/20 group-data-[transparent=true]/header:hover:bg-white/20";
    
  const transparentGhost = isCol 
    ? "" 
    : "group-data-[transparent=true]/header:text-white group-data-[transparent=true]/header:hover:bg-white/10";

  if (authed) {
    return (
      <div className={`flex gap-3 ${isCol ? "flex-col mt-2" : "items-center"}`}>
        <Link
          href={`${base}/account`}
          className={buttonVariants({ variant: "ghost",  className: cn(sizeClass, "font-bold text-slate-700 dark:text-white hover:bg-slate-100", transparentGhost) })}
        >
          {dict.actions.account}
        </Link>
        <form action={logoutAction.bind(null, locale)} className={isCol ? "w-full flex" : ""}>
          <Button size="md" variant="secondary" type="submit" className={cn(isCol ? "w-full flex-1 min-h-[48px] text-[15px]" : "", transparentClasses)}>
            {dict.actions.logout}
          </Button>
        </form>
      </div>
    );
  }

  const loginClasses = buttonVariants({ 
    variant: "secondary", 
    className: cn(sizeClass, isCol ? "" : "!h-10 px-4 text-[14px]", "font-bold", transparentClasses) 
  });
  
  const registerClasses = buttonVariants({ 
    variant: "primary", 
    className: cn(sizeClass, isCol ? "" : "!h-10 px-4 text-[14px]", "font-bold") 
  });

  return (
    <div className={`flex gap-3 ${isCol ? "flex-col mt-2" : "items-center"}`}>
      <Link href={`${base}/login`} className={loginClasses}>
        {dict.actions.login}
      </Link>
      <Link href={`${base}/register`} className={registerClasses}>
        {dict.actions.register}
      </Link>
    </div>
  );
}

export function SiteHeader({
  locale,
  dict,
  authed,
}: {
  locale: Locale;
  dict: CommonDict;
  authed: boolean;
}) {
  const base = `/${locale}`;
  const navDict = dict.nav as typeof dict.nav & {
    transport?: string;
    carRent?: string;
    transfers?: string;
    vipTaxi?: string;
  };

  const desktopItems: NavItem[] = [
    {
      href: `${base}/hotels`,
      label: dict.nav.hotels,
      icon: <Building2 className="h-4.5 w-4.5" />,
    },
    {
      href: `${base}/restaurants`,
      label: navDict.restaurants,
      icon: <UtensilsCrossed className="h-4.5 w-4.5" />,
    },
    {
      href: `${base}/transport`,
      label: navDict.transport,
      icon: <Car className="h-4.5 w-4.5" />,
    },
    {
      href: `${base}/attractions`,
      label: dict.nav.attractions,
      icon: <Landmark className="h-4.5 w-4.5" />,
    },
  ];

  const localeSwitcherLight = <LocaleSwitcher current={locale} light />;
  const authActions = <AuthButtons authed={authed} locale={locale} dict={dict} orientation="horizontal" />;
  const authActionsMobile = <AuthButtons authed={authed} locale={locale} dict={dict} orientation="vertical" />;

  const actions = (
    <div className="flex items-center gap-2">
      {localeSwitcherLight}
      {authActions}
    </div>
  );

  return (
    <HeaderWrapper
      items={desktopItems}
      brand={dict.brand}
      brandHref={base}
      locale={locale}
      actions={actions}
      localeSwitcher={<div className="flex items-center gap-2"><CurrencySwitcher /><LocaleSwitcher current={locale} /></div>}
      authActions={authActionsMobile}
    />
  );
}
