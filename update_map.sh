#!/bin/bash

cat << 'INNER_EOF' > /home/farrukh/Projects/Work/Frontend/safaar/apps/web-user/components/features/map/MapContainer.tsx
"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { MapContainer as RLMapContainer, TileLayer, Marker, Popup, useMap, useMapEvents } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import Image from "next/image";
import Link from "next/link";
import { MapPin, Star, Plus, Minus } from "lucide-react";

export interface MapMarkerItem {
  id: string;
  name?: string;
  cityName?: string;
  address?: string;
  priceFormatted?: string;
  rating?: number;
  stars?: number;
  imageUrl?: string;
  linkUrl?: string;
  lat?: number;
  lng?: number;
}

export interface MapContainerProps {
  items: MapMarkerItem[];
  hoveredItemId?: string | null;
  selectedItemId?: string | null;
  onSelectItem?: (item: MapMarkerItem) => void;
  onBoundsChange?: (bounds: { neLat: number; neLng: number; swLat: number; swLng: number }) => void;
  center?: [number, number];
  zoom?: number;
  className?: string;
}

function resolveItemCoords(item: MapMarkerItem): [number, number] | null {
  if (
    typeof item.lat === "number" &&
    typeof item.lng === "number" &&
    Number.isFinite(item.lat) &&
    Number.isFinite(item.lng) &&
    item.lat !== 0 &&
    item.lng !== 0
  ) {
    return [item.lat, item.lng];
  }
  return null;
}

function createPricePinIcon(
  price: string,
  rating?: number,
  isSelected?: boolean,
  isHovered?: boolean,
) {
  const text = price || (rating ? `★ ${rating.toFixed(1)}` : "Ko'rish");
  
  let bgStyle = "background-color: white; color: #0f172a; border: 1px solid #e2e8f0; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06);";
  let dotColor = "#2563eb";
  let transform = "scale(1)";
  let pointerColor = "white";
  let pointerBorder = "border-top: 6px solid #e2e8f0;"; // For the outer border shadow simulation if needed, but simple CSS triangle is fine
  
  if (isSelected) {
    bgStyle = "background-color: #1d4ed8; color: white; border: 1px solid #1d4ed8; box-shadow: 0 0 0 4px rgba(37, 99, 235, 0.3), 0 10px 15px -3px rgba(0, 0, 0, 0.1);";
    dotColor = "#fbbf24";
    transform = "scale(1.15)";
    pointerColor = "#1d4ed8";
  } else if (isHovered) {
    bgStyle = "background-color: #2563eb; color: white; border: 1px solid #2563eb; box-shadow: 0 10px 15px -3px rgba(37, 99, 235, 0.4);";
    dotColor = "white";
    transform = "scale(1.10)";
    pointerColor = "#2563eb";
  }

  const pulseClass = isSelected ? "animate-pulse" : "";
  
  return L.divIcon({
    className: "custom-leaflet-price-pin",
    html: `
      <div style="position: absolute; transform: translate(-50%, -100%) ${transform}; transform-origin: bottom center; transition: all 0.2s ease; cursor: pointer; display: flex; flex-direction: column; align-items: center;">
        <div style="position: relative; z-index: 10; display: inline-flex; align-items: center; gap: 6px; border-radius: 9999px; padding: 6px 12px; font-size: 12px; font-weight: 800; ${bgStyle}">
          <span class="${pulseClass}" style="width: 8px; height: 8px; border-radius: 9999px; background-color: ${dotColor}; display: inline-block;"></span>
          <span>${text}</span>
        </div>
        <div style="position: absolute; bottom: -6px; width: 0; height: 0; border-left: 6px solid transparent; border-right: 6px solid transparent; border-top: 6px solid ${pointerColor}; z-index: 9;"></div>
      </div>
    `,
    iconSize: [0, 0],
    iconAnchor: [0, 0],
    popupAnchor: [0, -40],
  });
}

function CustomMarker({ item, isSelected, isHovered, onSelectItem, map }: { item: MapMarkerItem; isSelected: boolean; isHovered: boolean; onSelectItem?: (item: MapMarkerItem) => void; map: L.Map }) {
  const coords: [number, number] = [item.lat!, item.lng!];
  const icon = createPricePinIcon(item.priceFormatted ?? "", item.rating, isSelected, isHovered);
  const popupRef = useRef<L.Popup>(null);

  useEffect(() => {
    // optional logic
  }, [isHovered]);

  return (
    <Marker 
      position={coords} 
      icon={icon} 
      zIndexOffset={isSelected || isHovered ? 1000 : 0}
      eventHandlers={{
        click: () => {
          if (onSelectItem) onSelectItem(item);
          map.flyTo(coords, Math.max(map.getZoom(), 15), { duration: 0.8, easeLinearity: 0.1 });
        }
      }}
    >
      <Popup maxWidth={280} minWidth={280} className="custom-popup" ref={popupRef}>
        <div className="flex flex-col min-w-[280px]">
          {item.imageUrl && (
            <div className="relative h-[160px] w-full overflow-hidden rounded-t-xl bg-slate-100 dark:bg-slate-800">
              <Image 
                src={item.imageUrl} 
                alt={item.name || ""}
                fill
                className="object-cover"
                sizes="(max-width: 768px) 100vw, 280px"
              />
              {item.rating !== undefined && (
                <div className="absolute top-3 right-3 z-10 flex items-center gap-1 rounded-lg bg-white/95 px-2 py-1 text-xs font-bold text-slate-900 shadow-sm backdrop-blur-sm dark:bg-slate-900/90 dark:text-white">
                  <Star className="h-3 w-3 fill-amber-400 text-amber-400" />
                  {item.rating.toFixed(1)}
                </div>
              )}
            </div>
          )}
          <div className="flex flex-col p-4 bg-white dark:bg-slate-900">
            <h3 className="text-sm font-bold text-slate-900 dark:text-white m-0 truncate">{item.name}</h3>
            {(item.cityName || item.address) && (
              <p className="mt-1 flex items-center gap-1 text-xs text-slate-500 dark:text-slate-400 m-0 truncate">
                <MapPin className="h-3 w-3 shrink-0" />
                {item.cityName ? item.cityName + (item.address ? " · " + item.address : "") : item.address}
              </p>
            )}
            {item.priceFormatted && (
              <p className="mt-3 text-base font-extrabold text-[#2563eb] m-0 flex items-baseline gap-1">
                {item.priceFormatted} <span className="text-xs font-medium text-slate-400 dark:text-slate-500">/ kecha</span>
              </p>
            )}
            {item.linkUrl && (
              <Link href={item.linkUrl} className="mt-3 flex w-full items-center justify-center rounded-xl bg-[#2563eb] px-4 py-2.5 text-sm font-bold text-white shadow-md transition-colors hover:bg-[#1d4ed8] !text-white no-underline">
                Ko'rish
              </Link>
            )}
          </div>
        </div>
      </Popup>
    </Marker>
  );
}

function CustomControls() {
  const map = useMap();
  return (
    <div className="absolute bottom-4 right-4 z-[1000] flex flex-col gap-2">
      <button 
        onClick={(e) => { e.preventDefault(); map.zoomIn(); }}
        className="flex h-10 w-10 items-center justify-center rounded-xl bg-white text-[#2563eb] shadow-lg transition-colors hover:bg-[#2563eb] hover:text-white dark:bg-slate-800 dark:text-blue-400 dark:hover:bg-blue-600 dark:hover:text-white"
        title="Zoom in"
      >
        <Plus className="h-5 w-5" />
      </button>
      <button 
        onClick={(e) => { e.preventDefault(); map.zoomOut(); }}
        className="flex h-10 w-10 items-center justify-center rounded-xl bg-white text-[#2563eb] shadow-lg transition-colors hover:bg-[#2563eb] hover:text-white dark:bg-slate-800 dark:text-blue-400 dark:hover:bg-blue-600 dark:hover:text-white"
        title="Zoom out"
      >
        <Minus className="h-5 w-5" />
      </button>
    </div>
  );
}

type MapContentProps = Pick<
  MapContainerProps,
  "items" | "hoveredItemId" | "selectedItemId" | "onSelectItem" | "onBoundsChange"
>;

function MapContent({ items, hoveredItemId, selectedItemId, onSelectItem, onBoundsChange }: MapContentProps) {
  const map = useMap();
  const [isDark, setIsDark] = useState(false);
  const [visibleCount, setVisibleCount] = useState(items.length);

  useEffect(() => {
    const dark = document.documentElement.classList.contains("dark");
    setIsDark(dark);

    const observer = new MutationObserver(() => {
      setIsDark(document.documentElement.classList.contains("dark"));
    });
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ["class"] });
    return () => observer.disconnect();
  }, []);

  const updateVisibleCount = useCallback(() => {
    const bounds = map.getBounds();
    let count = 0;
    items.forEach(item => {
      const coords = resolveItemCoords(item);
      if (coords && bounds.contains(L.latLng(coords[0], coords[1]))) {
        count++;
      }
    });
    setVisibleCount(count);
  }, [map, items]);

  useMapEvents({
    moveend: () => {
      updateVisibleCount();
      if (onBoundsChange) {
        const bounds = map.getBounds();
        onBoundsChange({
          neLat: bounds.getNorthEast().lat,
          neLng: bounds.getNorthEast().lng,
          swLat: bounds.getSouthWest().lat,
          swLng: bounds.getSouthWest().lng,
        });
      }
    },
  });

  useEffect(() => {
    updateVisibleCount();
  }, [updateVisibleCount]);

  const tileUrl = isDark
    ? "https://tiles.stadiamaps.com/tiles/alidade_smooth_dark/{z}/{x}/{y}{r}.png"
    : "https://tiles.stadiamaps.com/tiles/alidade_smooth/{z}/{x}/{y}{r}.png";

  const attribution = '&copy; <a href="https://stadiamaps.com/" target="_blank">Stadia Maps</a> &copy; <a href="https://openmaptiles.org/" target="_blank">OpenMapTiles</a> &copy; <a href="https://www.openstreetmap.org/copyright" target="_blank">OpenStreetMap</a>';
  
  useEffect(() => {
    const validCoords = items.map(resolveItemCoords).filter(Boolean) as [number, number][];
    if (validCoords.length > 0) {
      const bounds = L.latLngBounds(validCoords);
      if (bounds.isValid()) {
         map.fitBounds(bounds, { padding: [40, 40], maxZoom: 15 });
      }
    }
  }, [items, map]);

  return (
    <>
      <TileLayer
        url={tileUrl}
        attribution={attribution}
        maxZoom={19}
      />
      <CustomControls />
      <div className="absolute top-4 left-4 z-[1000] rounded-full bg-white px-3 py-1.5 text-xs font-bold text-[#2563eb] shadow-md dark:bg-slate-800 dark:text-blue-400 pointer-events-none">
        {visibleCount} ta mehmonxona
      </div>
      {items.map((item: MapMarkerItem) => {
        const coords = resolveItemCoords(item);
        if (!coords) return null;
        
        return (
          <CustomMarker
            key={item.id}
            item={item}
            isSelected={item.id === selectedItemId}
            isHovered={item.id === hoveredItemId}
            onSelectItem={onSelectItem}
            map={map}
          />
        );
      })}
    </>
  );
}

export function MapContainer({
  items,
  hoveredItemId,
  selectedItemId,
  onSelectItem,
  onBoundsChange,
  center = [41.2995, 69.2401],
  zoom = 12,
  className = "relative h-[580px] w-full rounded-2xl overflow-hidden border border-slate-200 shadow-2xl dark:border-slate-700/60 bg-slate-100 dark:bg-slate-900",
}: MapContainerProps) {
  const firstCoords = items.map(resolveItemCoords).find(c => c) ?? center;
  
  return (
    <div className={className}>
      <style>{`
        .leaflet-popup-content { margin: 0 !important; padding: 0 !important; }
        .leaflet-popup-content-wrapper { padding: 0 !important; border-radius: 16px !important; overflow: hidden !important; box-shadow: 0 20px 60px rgba(0,0,0,0.15) !important; background: transparent !important; }
        .leaflet-popup-tip-container { display: none; }
        @keyframes fadeInUp { from { opacity:0; transform:translateY(8px); } to { opacity:1; transform:translateY(0); } }
        .leaflet-popup { animation: fadeInUp 0.2s ease; margin-bottom: 8px; }
      `}</style>
      <RLMapContainer center={firstCoords} zoom={zoom} zoomControl={false} style={{ height: "100%", width: "100%", zIndex: 0 }}>
        <MapContent 
          items={items}
          hoveredItemId={hoveredItemId}
          selectedItemId={selectedItemId}
          onSelectItem={onSelectItem}
          onBoundsChange={onBoundsChange} 
        />
      </RLMapContainer>
    </div>
  )
}
INNER_EOF
