"use client";

import { useEffect, useState, useRef, useMemo } from "react";
import { MapContainer, TileLayer, Marker, useMapEvents, useMap } from "react-leaflet";
import "leaflet/dist/leaflet.css";
import L from "leaflet";
import { Navigation } from "lucide-react";
import { useTheme } from "next-themes";

const defaultCenter: [number, number] = [41.2995, 69.2401]; // Tashkent

function LocateMeControl({ onChange }: { onChange: (lat: number, lng: number) => void }) {
  const map = useMap();
  
  return (
    <div className="leaflet-bottom leaflet-right mb-6 mr-6">
      <div className="leaflet-control pointer-events-auto">
        <button
          type="button"
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            map.locate({ setView: true, maxZoom: 14 });
          }}
          className="flex h-10 w-10 items-center justify-center rounded-xl bg-white text-slate-700 shadow-lg transition-transform hover:scale-105 hover:bg-slate-50 border border-slate-200"
          title="Mening joylashuvim"
        >
          <Navigation className="h-5 w-5" />
        </button>
      </div>
    </div>
  );
}

function LocationMarker({
  position,
  onChange,
}: {
  position: [number, number] | null;
  onChange: (lat: number, lng: number) => void;
}) {
  const map = useMapEvents({
    click(e) {
      onChange(e.latlng.lat, e.latlng.lng);
    },
    locationfound(e) {
      onChange(e.latlng.lat, e.latlng.lng);
      map.flyTo(e.latlng, map.getZoom());
    },
  });

  const markerRef = useRef<L.Marker>(null);
  
  const customIcon = useMemo(() => {
    return L.divIcon({
      className: "custom-marker bg-transparent border-none",
      html: `
        <div class="relative flex items-center justify-center transition-all duration-300 scale-110 z-50">
          <div class="flex items-center gap-1 rounded-full px-2.5 py-1.5 shadow-lg bg-rose-600 text-white shadow-rose-600/30 ring-2 ring-rose-200">
            <span class="text-[11px] font-bold tracking-tight whitespace-nowrap">Joylashuv</span>
          </div>
          <!-- Tiny triangle pointer -->
          <div class="absolute -bottom-1 left-1/2 -translate-x-1/2 border-l-4 border-r-4 border-t-[6px] border-l-transparent border-r-transparent border-t-rose-600"></div>
        </div>
      `,
      iconSize: [60, 28],
      iconAnchor: [30, 28],
    });
  }, []);

  return position === null ? null : (
    <Marker
      position={position}
      draggable={true}
      icon={customIcon}
      eventHandlers={{
        dragend() {
          const marker = markerRef.current;
          if (marker != null) {
            const latlng = marker.getLatLng();
            onChange(latlng.lat, latlng.lng);
          }
        },
      }}
      ref={markerRef}
    ></Marker>
  );
}

interface Props {
  latitude?: number;
  longitude?: number;
  onChange: (lat: number, lng: number) => void;
}

export function LocationPickerMap({ latitude, longitude, onChange }: Props) {
  const [mounted, setMounted] = useState(false);
  const { resolvedTheme } = useTheme();

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
    return <div className="h-full w-full bg-[#E5E5DF] dark:bg-[#1A1A1A] animate-pulse rounded-lg" />;
  }

  const isDark = resolvedTheme === "dark";
  const position: [number, number] | null = latitude && longitude ? [latitude, longitude] : null;
  const initialCenter = position || defaultCenter;

  return (
    <div className="h-[300px] w-full relative z-0 rounded-lg overflow-hidden border border-[var(--border)]">
      <MapContainer
        center={initialCenter}
        zoom={12}
        className={`h-full w-full ${isDark ? 'map-dark-mode' : ''}`}
        scrollWheelZoom={true}
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        <LocateMeControl onChange={onChange} />
        <LocationMarker position={position} onChange={onChange} />
      </MapContainer>
      <style dangerouslySetInnerHTML={{__html: `
        .leaflet-container {
          z-index: 10 !important;
          font-family: inherit;
        }
        /* Dark mode invert for tiles */
        .map-dark-mode .leaflet-tile-pane {
          filter: invert(100%) hue-rotate(180deg) brightness(95%) contrast(90%);
        }
      `}} />
    </div>
  );
}
