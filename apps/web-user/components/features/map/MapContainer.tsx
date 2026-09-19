"use client";

import { useEffect, useRef, useState } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { MapContainer as RLMapContainer, TileLayer, Marker, Popup, useMap, useMapEvents } from "react-leaflet";
import Image from "next/image";
import Link from "next/link";
import { ZoomControl } from "react-leaflet";

export interface MapMarkerItem {
  id: string;
  name: string;
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
  const bgClass =
    isSelected || isHovered
      ? "bg-primary-600 text-white ring-4 ring-primary-500/30 scale-110 shadow-xl border-white"
      : "bg-card text-slate-900 border-slate-300 shadow-md dark:bg-slate-900 dark:text-white dark:border-slate-700";

  return L.divIcon({
    className: "custom-leaflet-price-pin",
    html: `
      <div class="inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-extrabold transition-all duration-200 cursor-pointer shadow-md ${bgClass}">
        <span class="h-2 w-2 rounded-full ${isSelected ? "bg-amber-400 animate-pulse" : "bg-primary-500"}"></span>
        <span>${text}</span>
      </div>
    `,
    iconSize: [110, 36],
    iconAnchor: [55, 18],
    popupAnchor: [0, -18],
  });
}

interface BoundsPayload {
  neLat: number;
  neLng: number;
  swLat: number;
  swLng: number;
}

function MapEvents({ onBoundsChange }: { onBoundsChange?: (bounds: BoundsPayload) => void }) {
  const map = useMapEvents({
    moveend: () => {
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
  return null;
}

function CustomMarker({ item, isSelected, isHovered, onSelectItem, map }: { item: MapMarkerItem; isSelected: boolean; isHovered: boolean; onSelectItem?: (item: MapMarkerItem) => void; map: L.Map }) {
  const coords: [number, number] = [item.lat!, item.lng!];
  const icon = createPricePinIcon(item.priceFormatted ?? "", item.rating, isSelected, isHovered);
  const popupRef = useRef<L.Popup>(null);

  useEffect(() => {
    if (isHovered && popupRef.current) {
      // Don't auto-open popup on hover unless you want it to, 
      // but usually hover just highlights the marker icon (handled by isHovered in icon).
    }
  }, [isHovered]);

  return (
    <Marker 
      position={coords} 
      icon={icon} 
      zIndexOffset={isSelected || isHovered ? 1000 : 0}
      eventHandlers={{
        click: () => {
          if (onSelectItem) onSelectItem(item);
          map.flyTo(coords, Math.max(map.getZoom(), 14), { duration: 0.6 });
        }
      }}
    >
      <Popup maxWidth={260} minWidth={220} className="custom-popup" ref={popupRef}>
        <div className="flex flex-col gap-2 p-1 min-w-[220px]">
          {item.imageUrl && (
            <div className="relative h-28 w-full overflow-hidden rounded-xl bg-slate-100">
              <Image 
                src={item.imageUrl} 
                alt={item.name || ""}
                fill
                className="object-cover"
                sizes="(max-width: 768px) 100vw, 260px"
              />
            </div>
          )}
          <div className="flex flex-col gap-1 pt-1">
            <h3 className="text-sm font-bold text-slate-900 m-0">{item.name}</h3>
            {(item.cityName || item.address) && (
              <p className="text-xs text-slate-500 m-0">
                {item.cityName ? item.cityName + " · " : ""}{item.address || ""}
              </p>
            )}
            {item.priceFormatted && (
              <p className="mt-1 text-sm font-extrabold text-primary-600 m-0">{item.priceFormatted}</p>
            )}
            {item.linkUrl && (
              <Link href={item.linkUrl} className="mt-2 inline-flex items-center justify-center rounded-xl bg-primary-600 px-3 py-1.5 text-xs font-bold text-white shadow-xs hover:bg-primary-700 !text-white no-underline">
                Batafsil
              </Link>
            )}
          </div>
        </div>
      </Popup>
    </Marker>
  );
}

type MapContentProps = Pick<
  MapContainerProps,
  "items" | "hoveredItemId" | "selectedItemId" | "onSelectItem" | "onBoundsChange"
>;

function MapContent({ items, hoveredItemId, selectedItemId, onSelectItem, onBoundsChange }: MapContentProps) {
  const map = useMap();
  const [tileUrl, setTileUrl] = useState("https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png");
  
  // Set theme once mounted
  useEffect(() => {
    const isDark = document.documentElement.classList.contains("dark");
    if (isDark) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setTileUrl("https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png");
    }
  }, []);
  
  // Fit bounds when items change
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
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>'
        maxZoom={19}
      />
      <ZoomControl position="bottomright" />
      <MapEvents onBoundsChange={onBoundsChange} />
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
  className = "h-[550px] w-full rounded-xl overflow-hidden border border-slate-200/80 bg-card shadow-xl dark:border-slate-800 dark:bg-slate-900",
}: MapContainerProps) {
  const firstCoords = items.map(resolveItemCoords).find(c => c) ?? center;
  
  return (
    <div className={className}>
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
