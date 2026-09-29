"use client";

import * as React from "react";
import { cn } from "@/lib/cn";

export interface AvatarProps extends React.HTMLAttributes<HTMLDivElement> {
  src?: string | null;
  alt?: string;
  fallback?: string;
  size?: "sm" | "md" | "lg" | "xl";
}

export const Avatar = React.forwardRef<HTMLDivElement, AvatarProps>(
  ({ className, src, alt, fallback, size = "md", ...props }, ref) => {
    const sizeClasses = {
      sm: "h-8 w-8 text-xs",
      md: "h-10 w-10 text-sm",
      lg: "h-12 w-12 text-base",
      xl: "h-16 w-16 text-xl",
    };

    return (
      <div
        ref={ref}
        className={cn(
          "relative flex shrink-0 overflow-hidden rounded-full bg-slate-200 ",
          sizeClasses[size],
          className
        )}
        {...props}
      >
        {src ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={src}
            alt={alt || "Avatar"}
            className="aspect-square h-full w-full object-cover"
            onError={(e) => {
              e.currentTarget.style.display = "none";
              const nextSibling = e.currentTarget.nextElementSibling as HTMLElement;
              if (nextSibling) nextSibling.style.display = "flex";
            }}
          />
        ) : null}
        
        <div
          className={cn(
            "flex h-full w-full items-center justify-center rounded-full bg-primary-100 font-bold text-primary-700  ",
            src ? "hidden" : "flex"
          )}
        >
          {fallback?.slice(0, 2).toUpperCase() || "?"}
        </div>
      </div>
    );
  }
);
Avatar.displayName = "Avatar";
