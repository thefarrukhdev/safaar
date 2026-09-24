"use client";

import { useEffect, useState } from "react";
import { MapContainer, TileLayer, Marker, Popup, useMap } from "react-leaflet";
import type { AttractionCatalogView } from "@safaar/api-client";
import "leaflet/dist/leaflet.css";
import L from "leaflet";
import Image from "next/image";

// Fix missing marker icons in leaflet
const icon = L.icon({
  iconUrl: "/images/marker-icon.png",
  iconRetinaUrl: "/images/marker-icon-2x.png",
  shadowUrl: "/images/marker-shadow.png",
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41],
});

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

export default function AttractionsMap({ attractions }: { attractions: AttractionCatalogView[] }) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    // Dynamically fix leaflet icon paths
    delete (L.Icon.Default.prototype as any)._getIconUrl;
    L.Icon.Default.mergeOptions({
      iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
      iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
      shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
    });
  }, []);

  if (!mounted) {
    return <div className="h-full w-full bg-[#E5E5DF] dark:bg-[#1A1A1A] animate-pulse" />;
  }

  // Default center: Tashkent
  const defaultCenter: [number, number] = [41.2995, 69.2401];

  return (
    <div className="h-full w-full relative z-0">
      <MapContainer
        center={defaultCenter}
        zoom={12}
        className="h-full w-full"
        scrollWheelZoom={true}
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        
        <FitBounds attractions={attractions} />

        {attractions.map((attr) => {
          if (!attr.latitude || !attr.longitude) return null;
          return (
            <Marker key={attr.id} position={[attr.latitude, attr.longitude]}>
              <Popup className="safaar-popup">
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
      </MapContainer>
      
      <style dangerouslySetInnerHTML={{__html: `
        .leaflet-container {
          z-index: 10 !important;
        }
        .safaar-popup .leaflet-popup-content-wrapper {
          border-radius: 12px;
          padding: 4px;
        }
        .safaar-popup .leaflet-popup-content {
          margin: 8px;
        }
      `}} />
    </div>
  );
}
