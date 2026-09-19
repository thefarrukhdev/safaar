import type { ReactNode } from "react";

export type NavItem = {
  href: string;
  label: string;
  icon?: ReactNode;
  exact?: boolean;
  children?: Omit<NavItem, "children">[];
};

export interface HeaderProps {
  items: NavItem[];
  brand: string;
  brandHref: string;
  locale?: string;
  actions?: ReactNode;
  localeSwitcher?: ReactNode;
  authActions?: ReactNode;
}
