"use client";

import { useEffect, useState, useMemo } from "react";
import { MapContainer, TileLayer, Marker, Popup, useMap, ZoomControl } from "react-leaflet";
import type { AttractionCatalogView } from "@safaar/api-client";
import "leaflet/dist/leaflet.css";
import L from "leaflet";
import Image from "next/image";
import { useTheme } from "next-themes";
import MarkerClusterGroup from "react-leaflet-cluster";
import { Navigation } from "lucide-react";

// A component to auto-fit the map bounds to all markers
function FitBounds({ attractions }: { attractions: AttractionCatalogView[] }) {
  const map = useMap();
  
  useEffect(() => {
    const validCoords = attractions
      .filter((a) => a.latitude != null && a.longitude != null)
      .map((a) => [a.latitude!, a.longitude!] as [number, number]);
      
    if (validCoords.length > 0) {
      const bounds = L.latLngBounds(validCoords);
      map.fitBounds(bounds, { padding: [50, 50], maxZoom: 14 });
    }
  }, [map, attractions]);

  return null;
}

// Locate Me button control
function LocateMeControl() {
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
          className="flex h-11 w-11 items-center justify-center rounded-xl bg-white text-slate-700 shadow-lg transition-transform hover:scale-105 hover:bg-slate-50 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-700"
          title="Mening joylashuvim"
        >
          <Navigation className="h-5 w-5" />
        </button>
      </div>
    </div>
  );
}

export default function AttractionsMap({ 
  attractions,
  hoveredId 
}: { 
  attractions: AttractionCatalogView[];
  hoveredId?: string | null;
}) {
  const [mounted, setMounted] = useState(false);
  const { resolvedTheme } = useTheme();

  useEffect(() => {
    setMounted(true);
  }, []);

  // Custom Airbnb style marker
  const createCustomIcon = (attr: AttractionCatalogView, isHovered: boolean) => {
    return L.divIcon({
      className: "custom-marker bg-transparent border-none",
      html: `
        <div class="relative flex items-center justify-center transition-all duration-300 ${isHovered ? 'scale-110 z-50' : 'scale-100 z-10'}">
          <div class="flex items-center gap-1 rounded-full px-2.5 py-1.5 shadow-lg ${
            isHovered 
              ? 'bg-rose-600 text-white shadow-rose-600/30 ring-2 ring-rose-200 dark:ring-rose-900' 
              : 'bg-slate-900 text-white dark:bg-white dark:text-slate-900'
          }">
            <span class="text-[11px] font-bold tracking-tight whitespace-nowrap">★ ${attr.rating.toFixed(1)}</span>
          </div>
          <!-- Tiny triangle pointer -->
          <div class="absolute -bottom-1 left-1/2 -translate-x-1/2 border-l-4 border-r-4 border-t-[6px] border-l-transparent border-r-transparent ${
            isHovered ? 'border-t-rose-600' : 'border-t-slate-900 dark:border-t-white'
          }"></div>
        </div>
      `,
      iconSize: [48, 28],
      iconAnchor: [24, 28], // Point is exactly bottom center
      popupAnchor: [0, -32],
    });
  };

  const createClusterCustomIcon = function (cluster: any) {
    const count = cluster.getChildCount();
    return L.divIcon({
      html: `
        <div class="flex h-10 w-10 items-center justify-center rounded-full bg-primary-600 text-white shadow-xl shadow-primary-600/30 ring-4 ring-primary-100 dark:ring-primary-900/40">
          <span class="text-sm font-bold">${count}</span>
        </div>
      `,
      className: "custom-cluster-icon",
      iconSize: [40, 40],
      iconAnchor: [20, 20]
    });
  };

  if (!mounted) {
    return <div className="h-full w-full bg-[#E5E5DF] dark:bg-[#1A1A1A] animate-pulse" />;
  }

  const defaultCenter: [number, number] = [41.2995, 69.2401];
  const isDark = resolvedTheme === "dark";
  
  // CARTO now requires API keys, so we use standard OpenStreetMap.
  // For dark mode, we use a CSS filter trick on the tiles.
  const tileUrl = "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png";

  return (
    <div className="h-full w-full relative z-0">
      <MapContainer
        center={defaultCenter}
        zoom={12}
        className={`h-full w-full ${isDark ? 'map-dark-mode' : ''}`}
        scrollWheelZoom={true}
        zoomControl={false}
      >
        <ZoomControl position="topright" />
        
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url={tileUrl}
        />
        
        <LocateMeControl />
        <FitBounds attractions={attractions} />

        <MarkerClusterGroup
          chunkedLoading
          iconCreateFunction={createClusterCustomIcon}
          showCoverageOnHover={false}
          maxClusterRadius={40}
        >
          {attractions.map((attr) => {
            if (!attr.latitude || !attr.longitude) return null;
            const isHovered = hoveredId === attr.id;
            return (
              <Marker 
                key={attr.id} 
                position={[attr.latitude, attr.longitude]}
                icon={createCustomIcon(attr, isHovered)}
                zIndexOffset={isHovered ? 1000 : 0}
              >
                <Popup className="safaar-popup min-w-[200px]">
                  <div className="flex flex-col gap-2 w-[220px]">
                    {attr.imageUrl && (
                      <div className="relative h-28 w-full rounded-md overflow-hidden">
                        <Image 
                          src={attr.imageUrl} 
                          alt={attr.name} 
                          fill 
                          className="object-cover"
                          sizes="220px"
                        />
                      </div>
                    )}
                    <div>
                      <h4 className="font-bold text-sm leading-tight text-slate-900">{attr.name}</h4>
                      <p className="text-xs text-slate-500 mt-1 line-clamp-2">{attr.description}</p>
                    </div>
                  </div>
                </Popup>
              </Marker>
            );
          })}
        </MarkerClusterGroup>
      </MapContainer>
      
      <style dangerouslySetInnerHTML={{__html: `
        .leaflet-container {
          z-index: 10 !important;
          font-family: inherit;
        }
        .safaar-popup .leaflet-popup-content-wrapper {
          border-radius: 12px;
          padding: 4px;
        }
        .safaar-popup .leaflet-popup-content {
          margin: 8px;
        }
        .leaflet-control-zoom {
          border: none !important;
          box-shadow: 0 4px 6px -1px rgb(0 0 0 / 0.1), 0 2px 4px -2px rgb(0 0 0 / 0.1) !important;
          margin-top: 24px !important;
          margin-right: 24px !important;
        }
        .leaflet-control-zoom a {
          background-color: ${isDark ? '#1e293b' : '#ffffff'} !important;
          color: ${isDark ? '#cbd5e1' : '#334155'} !important;
          border-color: ${isDark ? '#334155' : '#e2e8f0'} !important;
        }
        .leaflet-control-zoom a:hover {
          background-color: ${isDark ? '#334155' : '#f8fafc'} !important;
        }
        
        /* Magic CSS trick to make standard OpenStreetMap Dark Mode! */
        .map-dark-mode .leaflet-tile-pane {
          filter: invert(100%) hue-rotate(180deg) brightness(95%) contrast(90%);
        }
      `}} />
    </div>
  );
}
