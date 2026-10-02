"use client";

import { useEffect, useState } from "react";
import { MapContainer, TileLayer, Marker, Popup, useMap, ZoomControl } from "react-leaflet";
import type { AttractionCatalogView } from "@safaar/api-client";
import "leaflet/dist/leaflet.css";
import L from "leaflet";
import Image from "next/image";
import Link from "next/link";
import MarkerClusterGroup from "react-leaflet-cluster";
import { Navigation, ChevronRight } from "lucide-react";

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
          className="flex h-11 w-11 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-900 transition-all duration-200 ease-out hover:bg-slate-50 active:scale-[0.97] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:ring-offset-2 focus-visible:ring-offset-white"
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
  hoveredId,
  locale,
}: { 
  attractions: AttractionCatalogView[];
  hoveredId?: string | null;
  locale: string;
}) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  // Custom Airbnb style marker
  const createCustomIcon = (attr: AttractionCatalogView, isHovered: boolean) => {
    return L.divIcon({
      className: "custom-marker bg-transparent border-none",
      html: `
        <div class="relative flex items-center justify-center transition-all duration-200 ease-out ${isHovered ? 'scale-110 z-50' : 'scale-100 z-10'}">
          <div class="flex items-center gap-1 rounded-full px-2.5 py-1.5 ${ isHovered ? 'bg-blue-600 text-white' : 'bg-slate-900 text-white' }">
            <span class="text-[11px] font-bold tracking-tight whitespace-nowrap">★ ${attr.rating.toFixed(1)}</span>
          </div>
          <!-- Tiny triangle pointer -->
          <div class="absolute -bottom-1 left-1/2 -translate-x-1/2 border-l-4 border-r-4 border-t-[6px] border-l-transparent border-r-transparent ${ isHovered ? 'border-t-blue-600' : 'border-t-slate-900' }"></div>
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
        <div class="flex h-10 w-10 items-center justify-center rounded-full bg-blue-600 text-white border-[3px] border-white">
          <span class="text-sm font-bold">${count}</span>
        </div>
      `,
      className: "custom-cluster-icon",
      iconSize: [40, 40],
      iconAnchor: [20, 20]
    });
  };

  if (!mounted) {
    return <div className="h-full w-full bg-slate-100 animate-pulse" />;
  }

  const defaultCenter: [number, number] = [41.2995, 69.2401];
  
  // CARTO now requires API keys, so we use standard OpenStreetMap.
  const tileUrl = "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png";

  return (
    <div className="h-full w-full relative z-0">
      <MapContainer
        center={defaultCenter}
        zoom={12}
        className="h-full w-full"
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
                      <div className="relative h-28 w-full rounded-2xl overflow-hidden bg-slate-100">
                        <Image 
                          src={attr.imageUrl} 
                          alt={attr.name} 
                          fill 
                          className="object-cover"
                          sizes="220px"
                        />
                      </div>
                    )}
                    <div className="px-1.5 pb-1">
                      <h4 className="font-semibold text-sm leading-tight text-slate-900">{attr.name}</h4>
                      <p className="text-xs text-slate-500 mt-1.5 line-clamp-2">{attr.description}</p>
                      <div className="mt-3.5 border-t border-slate-100 pt-2.5">
                        <Link 
                          href={`/${locale}/attractions/${attr.id}`}
                          className="group flex w-full items-center justify-between rounded-lg py-1 text-[13px] font-semibold text-slate-900 transition-colors hover:text-blue-600 active:scale-[0.98]"
                        >
                          <span>Batafsil ma'lumot</span>
                          <span className="flex h-6 w-6 items-center justify-center rounded-full bg-slate-50 transition-colors group-hover:bg-blue-50">
                            <ChevronRight className="h-3.5 w-3.5" />
                          </span>
                        </Link>
                      </div>
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
          border-radius: 20px;
          padding: 10px;
          box-shadow: 0 12px 48px -12px rgba(0,0,0,0.15), 0 4px 16px -4px rgba(0,0,0,0.05);
          border: 1px solid #e2e8f0;
        }
        .safaar-popup .leaflet-popup-tip {
          box-shadow: none;
          border-right: 1px solid #e2e8f0;
          border-bottom: 1px solid #e2e8f0;
        }
        .safaar-popup .leaflet-popup-content {
          margin: 0;
        }
        .leaflet-control-zoom {
          border: 1px solid #e2e8f0 !important;
          border-radius: 8px !important;
          overflow: hidden;
          box-shadow: none !important;
          margin-top: 24px !important;
          margin-right: 24px !important;
        }
        .leaflet-control-zoom a {
          background-color: #ffffff !important;
          color: #334155 !important;
          border-color: #e2e8f0 !important;
        }
        .leaflet-control-zoom a:hover {
          background-color: #f8fafc !important;
        }
        .custom-cluster-icon {
          background: transparent;
          border: none;
        }
      `}} />
    </div>
  );
}
