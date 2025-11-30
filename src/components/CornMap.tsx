import React, { useEffect, useRef, useState } from 'react';
import mapboxgl from 'mapbox-gl';
import { HeatmapPoint, Buyer } from '../types';
import { RAIL_LINES } from '../services/railService';
import { BuyerMarkers } from './BuyerMarkers';
import { OpportunityDrawer } from './OpportunityDrawer';

// Hardcoded token as requested
mapboxgl.accessToken = 'MAPBOX_TOKEN_REMOVED';

interface CornMapProps {
    showHeatmap: boolean;
    showBuyers: boolean;
    showRail: boolean;
    buyers?: Buyer[];
    heatmapData?: HeatmapPoint[]; // Live heatmap data
    heatmapMode?: 'default' | 'buyers';
    theme?: 'default' | 'green-glow';
    view?: 'default' | 'usa';
    hoveredRegionId?: string | null;
}

export const CornMap: React.FC<CornMapProps> = ({
    showHeatmap,
    showBuyers,
    showRail,
    buyers = [],
    heatmapData = [],
    heatmapMode = 'default',
    // theme = 'default', // Unused for now
    view = 'default',
    hoveredRegionId
}) => {
    const mapContainer = useRef<HTMLDivElement>(null);
    const map = useRef<mapboxgl.Map | null>(null);
    const [selectedItem, setSelectedItem] = useState<HeatmapPoint | Buyer | null>(null);

    useEffect(() => {
        if (map.current) return; // Initialize map only once

        const center: [number, number] = view === 'usa' ? [-98.5795, 39.8283] : [-93.6, 42.0];
        const zoom = view === 'usa' ? 3.5 : 5.5;

        map.current = new mapboxgl.Map({
            container: mapContainer.current!,
            style: 'mapbox://styles/mapbox/dark-v11', // Revert to Dark Theme
            center: center,
            zoom: zoom,
            pitch: 0, // Keep flat for Network Map feel, but dark
        });

        map.current.on('load', () => {
            // Add Rail Source
            map.current?.addSource('rail-lines', {
                type: 'geojson',
                data: {
                    type: 'FeatureCollection',
                    features: RAIL_LINES.map(line => ({
                        type: 'Feature',
                        properties: { id: line.id },
                        geometry: {
                            type: 'LineString',
                            coordinates: line.path.map(p => [p.lng, p.lat])
                        }
                    }))
                }
            });

            // Add Rail Layer - Network Style
            map.current?.addLayer({
                id: 'rail-layer',
                type: 'line',
                source: 'rail-lines',
                layout: {
                    'line-join': 'round',
                    'line-cap': 'round'
                },
                paint: {
                    'line-color': '#f97316', // Bright BNSF Orange for contrast on dark
                    'line-width': 3,
                    'line-opacity': 0.8,
                }
            });

            // Add Heatmap Source
            map.current?.addSource('corn-heat', {
                type: 'geojson',
                data: { type: 'FeatureCollection', features: [] }
            });

            // Add Heatmap Layer - Green/Amber Theme for "Money"
            map.current?.addLayer({
                id: 'corn-heat-layer',
                type: 'heatmap',
                source: 'corn-heat',
                paint: {
                    'heatmap-weight': [
                        'interpolate',
                        ['linear'],
                        ['get', 'weight'],
                        0, 0,
                        10, 1
                    ],
                    'heatmap-intensity': [
                        'interpolate',
                        ['linear'],
                        ['zoom'],
                        0, 1,
                        9, 3
                    ],
                    // Green/Gold Theme
                    'heatmap-color': [
                        'interpolate',
                        ['linear'],
                        ['heatmap-density'],
                        0, 'rgba(0,0,0,0)',
                        0.2, 'rgba(20, 83, 45, 0.5)', // Dark Green
                        0.4, 'rgba(22, 163, 74, 0.6)', // Green
                        0.6, 'rgba(34, 197, 94, 0.7)', // Bright Green
                        0.8, 'rgba(234, 179, 8, 0.8)', // Yellow/Gold
                        1, 'rgba(255, 255, 255, 0.9)'  // White
                    ],
                    'heatmap-radius': [
                        'interpolate',
                        ['linear'],
                        ['zoom'],
                        0, 2,
                        9, 30
                    ],
                    'heatmap-opacity': 0.7
                }
            });

            // Add Circle Layer for individual points (Opportunity Zones)
            map.current?.addLayer({
                id: 'corn-point-layer',
                type: 'circle',
                source: 'corn-heat',
                minzoom: 4,
                paint: {
                    'circle-radius': [
                        'interpolate',
                        ['linear'],
                        ['zoom'],
                        4, 4,
                        10, 10
                    ],
                    'circle-color': [
                        'case',
                        ['boolean', ['get', 'isOpportunity'], false],
                        '#4ade80', // Bright Green for opportunity
                        '#fbbf24'  // Amber otherwise
                    ],
                    'circle-stroke-color': '#ffffff',
                    'circle-stroke-width': [
                        'case',
                        ['boolean', ['get', 'isOpportunity'], false],
                        2,
                        1
                    ],
                    'circle-opacity': 0.9
                }
            });

            // Click event for heatmap points
            map.current?.on('click', 'corn-point-layer', (e) => {
                if (e.features && e.features[0]) {
                    const props = e.features[0].properties as unknown as HeatmapPoint;
                    setSelectedItem(props);
                }
            });

            // Change cursor on hover
            map.current?.on('mouseenter', 'corn-point-layer', () => {
                if (map.current) map.current.getCanvas().style.cursor = 'pointer';
            });
            map.current?.on('mouseleave', 'corn-point-layer', () => {
                if (map.current) map.current.getCanvas().style.cursor = '';
            });

        });
    }, []);

    // Update heatmap data
    useEffect(() => {
        if (!map.current || !map.current.isStyleLoaded()) return;

        const source = map.current.getSource('corn-heat') as mapboxgl.GeoJSONSource;
        if (source) {
            let features: any[] = [];

            if (heatmapMode === 'buyers') {
                features = buyers.map(b => ({
                    type: 'Feature',
                    properties: {
                        weight: b.basis * 10, // Scale basis for weight
                        isOpportunity: b.basis > 0.2 || b.netPrice && b.netPrice > 4.5, // Highlight high bids
                        ...b
                    },
                    geometry: { type: 'Point', coordinates: [b.lng, b.lat] }
                }));
            } else {
                // Use live heatmap data
                features = heatmapData.map(p => ({
                    type: 'Feature',
                    properties: {
                        weight: p.cornPrice, // Use price for weight
                        ...p
                    },
                    geometry: { type: 'Point', coordinates: [p.lng, p.lat] }
                }));
            }

            source.setData({ type: 'FeatureCollection', features });
        }
    }, [heatmapData, buyers, heatmapMode]);

    // Handle Hover Effect from Top 3 Card
    useEffect(() => {
        if (!map.current || !map.current.isStyleLoaded()) return;

        if (hoveredRegionId) {
            map.current.setPaintProperty('corn-point-layer', 'circle-radius', [
                'case',
                ['==', ['get', 'id'], hoveredRegionId],
                20, // Enlarge hovered
                ['interpolate', ['linear'], ['zoom'], 4, 4, 10, 10] // Default
            ]);
            map.current.setPaintProperty('corn-point-layer', 'circle-stroke-width', [
                'case',
                ['==', ['get', 'id'], hoveredRegionId],
                4,
                ['case', ['boolean', ['get', 'isOpportunity'], false], 2, 1]
            ]);
            // Make it pulse color
            map.current.setPaintProperty('corn-point-layer', 'circle-color', [
                'case',
                ['==', ['get', 'id'], hoveredRegionId],
                '#22c55e', // Strong Green
                ['case', ['boolean', ['get', 'isOpportunity'], false], '#4ade80', '#fbbf24']
            ]);
        } else {
            // Reset
            map.current.setPaintProperty('corn-point-layer', 'circle-radius', [
                'interpolate',
                ['linear'],
                ['zoom'],
                4, 4,
                10, 10
            ]);
            map.current.setPaintProperty('corn-point-layer', 'circle-stroke-width', [
                'case',
                ['boolean', ['get', 'isOpportunity'], false],
                2,
                1
            ]);
            map.current.setPaintProperty('corn-point-layer', 'circle-color', [
                'case',
                ['boolean', ['get', 'isOpportunity'], false],
                '#4ade80',
                '#fbbf24'
            ]);
        }
    }, [hoveredRegionId]);

    // Toggle layers visibility
    useEffect(() => {
        if (!map.current) return;

        const setVisibility = (layerId: string, visible: boolean) => {
            if (map.current?.getLayer(layerId)) {
                map.current.setLayoutProperty(layerId, 'visibility', visible ? 'visible' : 'none');
            }
        };

        setVisibility('corn-heat-layer', showHeatmap);
        setVisibility('corn-point-layer', showHeatmap);
        setVisibility('rail-layer', showRail);

    }, [showHeatmap, showRail]);

    return (
        <div className="relative w-full h-full">
            <div ref={mapContainer} className="w-full h-full" />

            {showBuyers && map.current && (
                <BuyerMarkers
                    map={map.current}
                    buyers={buyers}
                    onSelect={setSelectedItem}
                />
            )}

            <OpportunityDrawer
                item={selectedItem}
                onClose={() => setSelectedItem(null)}
            />
        </div>
    );
};
