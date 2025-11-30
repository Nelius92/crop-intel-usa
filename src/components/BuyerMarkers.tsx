import React, { useEffect, useRef } from 'react';
import mapboxgl from 'mapbox-gl';
import { Buyer } from '../types';
import { createRoot } from 'react-dom/client';

interface BuyerMarkersProps {
    map: mapboxgl.Map;
    buyers: Buyer[];
    onSelect: (buyer: Buyer) => void;
}

export const BuyerMarkers: React.FC<BuyerMarkersProps> = ({ map, buyers, onSelect }) => {
    const markersRef = useRef<mapboxgl.Marker[]>([]);

    useEffect(() => {
        // Clear existing markers
        markersRef.current.forEach(marker => marker.remove());
        markersRef.current = [];

        buyers.forEach(buyer => {
            // Create a DOM element for the marker
            const el = document.createElement('div');
            el.className = 'marker-container group cursor-pointer';

            // Render marker content using React
            const root = createRoot(el);

            // Color based on type
            let colorClass = 'bg-slate-500';
            if (buyer.type === 'ethanol') colorClass = 'bg-green-500';
            else if (buyer.type === 'feedlot') colorClass = 'bg-amber-500';
            else if (buyer.type === 'shuttle' || buyer.railAccessible) colorClass = 'bg-cyan-500';

            // High Bid Logic (Net Price > 4.50 or Basis > 0.20)
            const isHighBid = (buyer.netPrice && buyer.netPrice > 4.50) || buyer.basis > 0.20;

            // Bigger glow for high bids
            const glowClass = isHighBid
                ? 'animate-pulse-green shadow-[0_0_30px_rgba(34,197,94,0.6)] z-50'
                : (buyer.railAccessible ? 'shadow-[0_0_15px_rgba(34,211,238,0.5)]' : '');

            // Larger size for high bids
            const sizeClass = isHighBid ? 'w-6 h-6 border-4' : 'w-4 h-4 border-2';

            root.render(
                <div
                    className={`${sizeClass} rounded-full border-white ${colorClass} ${glowClass} transition-transform group-hover:scale-125 relative`}
                    onClick={(e) => {
                        e.stopPropagation();
                        onSelect(buyer);
                    }}
                >
                    {/* Ping effect for Rail Accessible */}
                    {buyer.railAccessible && !isHighBid && (
                        <div className="absolute -inset-1 rounded-full border border-cyan-400 opacity-50 animate-ping" />
                    )}
                    {/* Stronger Ping for High Bid */}
                    {isHighBid && (
                        <div className="absolute -inset-4 rounded-full border-4 border-green-500 opacity-40 animate-ping" style={{ animationDuration: '1.5s' }} />
                    )}
                </div>
            );

            // Add marker to map
            const marker = new mapboxgl.Marker(el)
                .setLngLat([buyer.lng, buyer.lat])
                .addTo(map);

            markersRef.current.push(marker);
        });

        return () => {
            markersRef.current.forEach(marker => marker.remove());
        };
    }, [map, buyers, onSelect]);

    return null; // This component manages Mapbox markers directly
};
