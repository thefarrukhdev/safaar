"use client";

import { useEffect, useMemo, useState } from "react";
import type { HotelDetailDict } from "@/i18n/dictionaries";

export function HotelStickyNav({
  dict,
}: {
  dict?: HotelDetailDict["nav"];
}) {
  const [activeSection, setActiveSection] = useState("photos");

  const navItems = useMemo(
    () => [
      { id: "photos", label: dict?.photos ?? "Photos" },
      { id: "amenities", label: dict?.amenities ?? "Amenities" },
      { id: "rooms", label: dict?.rooms ?? "Rooms" },
      { id: "reviews", label: dict?.reviews ?? "Reviews" },
      { id: "location", label: dict?.location ?? "Location" },
    ],
    [dict],
  );

  const handleClick = (e: React.MouseEvent<HTMLAnchorElement>, id: string) => {
    e.preventDefault();
    const target = document.getElementById(id);
    if (target) {
      const headerOffset = 100;
      const elementPosition = target.getBoundingClientRect().top;
      const offsetPosition = elementPosition + window.pageYOffset - headerOffset;
  
      window.scrollTo({
        top: offsetPosition,
        behavior: "smooth"
      });
      setActiveSection(id);
    }
  };

  useEffect(() => {
    const handleScroll = () => {
      let currentSection = "photos";
      let minDistance = Infinity;

      for (const item of navItems) {
        const element = document.getElementById(item.id);
        if (element) {
          const rect = element.getBoundingClientRect();
          // Adjust threshold based on layout (e.g. 150px from top)
          const distance = Math.abs(rect.top - 150); 
          if (distance < minDistance) {
            minDistance = distance;
            currentSection = item.id;
          }
        }
      }

      setActiveSection(currentSection);
    };

    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, [navItems]);

  return (
    <nav className="sticky top-0 z-40 w-full bg-white border-b border-slate-200 hidden md:block">
      <div className="mx-auto flex w-full max-w-[1536px] items-center gap-8 px-8 h-16">
        {navItems.map((item) => (
          <a
            key={item.id}
            href={`#${item.id}`}
            onClick={(e) => handleClick(e, item.id)}
            className={`text-sm font-bold transition-colors h-full flex items-center border-b-2 ${
              activeSection === item.id
                ? "border-slate-900 text-slate-900"
                : "border-transparent text-slate-500 hover:text-slate-900 hover:border-slate-300"
            }`}
          >
            {item.label}
          </a>
        ))}
      </div>
    </nav>
  );
}
