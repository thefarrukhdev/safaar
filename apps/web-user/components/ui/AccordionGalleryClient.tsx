"use client";

import dynamic from"next/dynamic";
import type { AccordionGalleryProps } from"@/components/ui/AccordionGallery";

const AccordionGallery = dynamic<AccordionGalleryProps>(
 () => import("@/components/ui/AccordionGallery"),
 { ssr: false },
);

export { AccordionGallery };
