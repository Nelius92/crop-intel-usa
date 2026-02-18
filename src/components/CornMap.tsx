import React, { useEffect, useRef, useState } from 'react';
import mapboxgl from 'mapbox-gl';
import { HeatmapPoint, Buyer, Transloader } from '../types';
import { RAIL_LINES } from '../services/railService';
import { BuyerMarkers } from './BuyerMarkers';
import { OpportunityDrawer } from './OpportunityDrawer';

// Token from environment variables
mapboxgl.accessToken = import.meta.env.VITE_MAPBOX_ACCESS_TOKEN;

interface CornMapProps {
    showHeatmap: boolean;
    showBuyers: boolean;
    showRail: boolean;
    showTransloaders?: boolean;
    buyers?: Buyer[];
    heatmapData?: HeatmapPoint[]; // Live heatmap data
    transloaders?: Transloader[];
    heatmapMode?: 'default' | 'buyers';
    view?: 'default' | 'usa';
    theme?: string;
    topStates?: string[]; // List of state codes to highlight (e.g. ['CA', 'TX'])
    hoveredRegionId?: string | null;
}

const STATE_CENTERS: Record<string, [number, number]> = {
    'CA': [-119.4179, 36.7783],
    'TX': [-99.9018, 31.9686],
    'WA': [-120.7401, 47.7511],
    'ID': [-114.7420, 44.0682],
    'OR': [-120.5542, 43.8041],
    'IL': [-89.3985, 40.6331],
    'IA': [-93.0977, 41.8780],
    'NE': [-99.9018, 41.4925],
    'MN': [-94.6859, 46.7296],
    'KS': [-98.4842, 39.0119],
    'MO': [-92.2884, 37.9643],
    'SD': [-100.2263, 44.2998],
    'ND': [-101.0020, 47.5515],
    'OH': [-82.9071, 40.4173],
    'IN': [-86.1261, 40.2672]
};

const STATE_NAME_TO_CODE: Record<string, string> = {
    'Alabama': 'AL', 'Alaska': 'AK', 'Arizona': 'AZ', 'Arkansas': 'AR', 'California': 'CA',
    'Colorado': 'CO', 'Connecticut': 'CT', 'Delaware': 'DE', 'Florida': 'FL', 'Georgia': 'GA',
    'Hawaii': 'HI', 'Idaho': 'ID', 'Illinois': 'IL', 'Indiana': 'IN', 'Iowa': 'IA',
    'Kansas': 'KS', 'Kentucky': 'KY', 'Louisiana': 'LA', 'Maine': 'ME', 'Maryland': 'MD',
    'Massachusetts': 'MA', 'Michigan': 'MI', 'Minnesota': 'MN', 'Mississippi': 'MS',
    'Missouri': 'MO', 'Montana': 'MT', 'Nebraska': 'NE', 'Nevada': 'NV', 'New Hampshire': 'NH',
    'New Jersey': 'NJ', 'New Mexico': 'NM', 'New York': 'NY', 'North Carolina': 'NC',
    'North Dakota': 'ND', 'Ohio': 'OH', 'Oklahoma': 'OK', 'Oregon': 'OR', 'Pennsylvania': 'PA',
    'Rhode Island': 'RI', 'South Carolina': 'SC', 'South Dakota': 'SD', 'Tennessee': 'TN',
    'Texas': 'TX', 'Utah': 'UT', 'Vermont': 'VT', 'Virginia': 'VA', 'Washington': 'WA',
    'West Virginia': 'WV', 'Wisconsin': 'WI', 'Wyoming': 'WY'
};

export const CornMap: React.FC<CornMapProps> = ({
    showHeatmap,
    showBuyers,
    showRail,
    showTransloaders = true,
    buyers = [],
    heatmapData = [],
    transloaders = [],
    heatmapMode = 'default',
    view = 'default',
    hoveredRegionId,
    topStates = []
}) => {
    const mapContainer = useRef<HTMLDivElement>(null);
    const map = useRef<mapboxgl.Map | null>(null);
    const [selectedItem, setSelectedItem] = useState<HeatmapPoint | Buyer | Transloader | null>(null);
    const [styleLoaded, setStyleLoaded] = useState(false);
    const [zoomedState, setZoomedState] = useState<string | null>(null);

    // Compute State Metrics for Coloring/Blinking
    const stateMetrics = React.useMemo(() => {
        const metrics: Record<string, { maxPrice: number, count: number, isHot: boolean }> = {};
        buyers.forEach(b => {
            if (!metrics[b.state]) metrics[b.state] = { maxPrice: 0, count: 0, isHot: false };
            metrics[b.state].count++;
            if ((b.netPrice || 0) > metrics[b.state].maxPrice) metrics[b.state].maxPrice = b.netPrice || 0;
        });

        Object.keys(metrics).forEach(state => {
            if (metrics[state].maxPrice > 4.5 || topStates.includes(state)) {
                metrics[state].isHot = true;
            }
        });
        return metrics;
    }, [buyers, topStates]);

    useEffect(() => {
        if (map.current) return;

        const center: [number, number] = view === 'usa' ? [-98.5795, 39.8283] : [-93.6, 42.0];
        const zoom = view === 'usa' ? 3.5 : 5.5;

        map.current = new mapboxgl.Map({
            container: mapContainer.current!,
            style: 'mapbox://styles/mapbox/dark-v11',
            center: center,
            zoom: zoom,
            pitch: 0,
            projection: { name: 'mercator' }
        });

        map.current.on('load', () => {
            setStyleLoaded(true);

            // 1. Add US States Source
            map.current?.addSource('us-states', {
                type: 'geojson',
                data: 'https://docs.mapbox.com/mapbox-gl-js/assets/us_states.geojson'
            });

            // 2. Add State Fill Layer (Base)
            map.current?.addLayer({
                id: 'state-fill',
                type: 'fill',
                source: 'us-states',
                paint: {
                    'fill-color': '#000000',
                    'fill-opacity': 0
                }
            }, 'waterway-label');

            // 3. Add State Border Layer (Static Base)
            map.current?.addLayer({
                id: 'state-border',
                type: 'line',
                source: 'us-states',
                paint: {
                    'line-color': '#06b6d4',
                    'line-width': 1,
                    'line-opacity': 0.1 // Static low opacity
                }
            });

            // 4. Add Highlighted Border Layer (For Animation)
            map.current?.addLayer({
                id: 'state-border-highlight',
                type: 'line',
                source: 'us-states',
                paint: {
                    'line-color': '#22c55e', // Green for money/opportunity
                    'line-width': 3,
                    'line-opacity': 0 // Starts hidden, animated later
                },
                filter: ['in', 'STATE_NAME', ''] // Default empty filter
            });

            // --- Premium Rail Network Layers (Glow + Core + Flow) ---
            fetch('/data/us-railroads.geojson')
                .then(response => response.ok ? response.json() : Promise.reject('GeoJSON not available'))
                .then(geojsonData => {
                    if (!map.current) return;

                    if (!map.current.getSource('us-rail-network')) {
                        map.current.addSource('us-rail-network', {
                            type: 'geojson',
                            data: geojsonData,
                            lineMetrics: true // Enable gradient/flow support
                        });
                    }

                    // 1. Outer Glow Layer (Atmospheric effect)
                    map.current.addLayer({
                        id: 'rail-glow',
                        type: 'line',
                        source: 'us-rail-network',
                        layout: { 'line-join': 'round', 'line-cap': 'round' },
                        paint: {
                            'line-color': [
                                'match', ['get', 'owner'],
                                'BNSF', '#fb923c', // Orange-400
                                'UP', '#fde047',   // Yellow-300
                                'CSX', '#60a5fa',  // Blue-400
                                'NS', '#818cf8',   // Indigo-400
                                'CN', '#f87171',   // Red-400
                                'CPKC', '#c084fc', // Purple-400
                                '#94a3b8'          // Slate-400
                            ],
                            'line-width': [
                                'match', ['get', 'type'],
                                'mainline', 6,
                                3
                            ],
                            'line-opacity': 0.2,
                            'line-blur': 2
                        }
                    });

                    // 2. Core Line Layer (Sharp definition)
                    map.current.addLayer({
                        id: 'rail-core',
                        type: 'line',
                        source: 'us-rail-network',
                        layout: { 'line-join': 'round', 'line-cap': 'round' },
                        paint: {
                            'line-color': [
                                'match', ['get', 'owner'],
                                'BNSF', '#f97316', // Orange-500
                                'UP', '#eab308',   // Yellow-500
                                'CSX', '#3b82f6',  // Blue-500
                                'NS', '#6366f1',   // Indigo-500
                                'CN', '#ef4444',   // Red-500
                                'CPKC', '#a855f7', // Purple-500
                                '#64748b'          // Slate-500
                            ],
                            'line-width': [
                                'match', ['get', 'type'],
                                'mainline', 2,
                                1
                            ],
                            'line-opacity': 0.9
                        }
                    });

                    // 3. Flow Animation Layer (Movement effect for mainlines)
                    map.current.addLayer({
                        id: 'rail-flow',
                        type: 'line',
                        source: 'us-rail-network',
                        filter: ['==', 'type', 'mainline'], // Only animate mainlines
                        layout: { 'line-join': 'round', 'line-cap': 'round' },
                        paint: {
                            'line-color': '#ffffff',
                            'line-width': 2,
                            'line-opacity': 0.6,
                            'line-dasharray': [0, 4, 3] // Animated via setPaintProperty
                        }
                    });
                })
                .catch(() => {
                    console.warn("Using fallback rail styling");
                    // Fallback to static RAIL_LINES data
                    if (!map.current) return;

                    map.current.addSource('rail-lines', {
                        type: 'geojson',
                        data: {
                            type: 'FeatureCollection',
                            features: RAIL_LINES.map(line => ({
                                type: 'Feature',
                                properties: { id: line.id },
                                geometry: { type: 'LineString', coordinates: line.path.map(p => [p.lng, p.lat]) }
                            }))
                        }
                    });

                    map.current.addLayer({
                        id: 'rail-layer',
                        type: 'line',
                        source: 'rail-lines',
                        layout: { 'line-join': 'round', 'line-cap': 'round' },
                        paint: {
                            'line-color': '#f97316',
                            'line-width': 2,
                            'line-opacity': 0.6
                        }
                    });
                });

            map.current?.addSource('corn-heat', {
                type: 'geojson',
                data: { type: 'FeatureCollection', features: [] }
            });

            map.current?.addLayer({
                id: 'corn-heat-layer',
                type: 'heatmap',
                source: 'corn-heat',
                paint: {
                    'heatmap-weight': ['interpolate', ['linear'], ['get', 'weight'], 0, 0, 10, 1],
                    'heatmap-intensity': ['interpolate', ['linear'], ['zoom'], 0, 1, 9, 3],
                    'heatmap-color': [
                        'interpolate',
                        ['linear'],
                        ['heatmap-density'],
                        0, 'rgba(0,0,0,0)',
                        0.2, 'rgba(6, 182, 212, 0.3)',
                        0.5, 'rgba(6, 182, 212, 0.6)',
                        1, 'rgba(34, 211, 238, 0.9)'
                    ],
                    'heatmap-radius': ['interpolate', ['linear'], ['zoom'], 0, 2, 9, 20],
                    'heatmap-opacity': 0.5
                }
            });

            map.current?.addLayer({
                id: 'corn-point-layer',
                type: 'circle',
                source: 'corn-heat',
                minzoom: 4,
                paint: {
                    'circle-radius': ['interpolate', ['linear'], ['zoom'], 4, 3, 10, 6],
                    'circle-color': [
                        'case',
                        ['boolean', ['get', 'isOpportunity'], false],
                        '#22d3ee',
                        '#64748b'
                    ],
                    'circle-stroke-color': '#000',
                    'circle-stroke-width': 1,
                    'circle-opacity': 0.9
                }
            });

            map.current?.addSource('transloaders', {
                type: 'geojson',
                data: { type: 'FeatureCollection', features: [] }
            });
            map.current?.addLayer({
                id: 'transloader-layer',
                type: 'circle',
                source: 'transloaders',
                minzoom: 3,
                paint: {
                    'circle-radius': ['interpolate', ['linear'], ['zoom'], 3, 2, 10, 5],
                    'circle-color': '#a855f7',
                    'circle-opacity': 0.7
                }
            });


            // Events
            map.current?.on('click', 'state-fill', (e) => {
                if (e.features && e.features.length > 0) {
                    const feature = e.features[0];
                    const stateName = feature.properties?.STATE_NAME;
                    const stateCode = STATE_NAME_TO_CODE[stateName];

                    if (stateCode) {
                        // Interactive Zoom / Drill Down
                        setZoomedState(prev => {
                            if (prev === stateCode) return null;
                            return stateCode;
                        });

                        const knownCenter = STATE_CENTERS[stateCode];
                        if (knownCenter) {
                            map.current?.flyTo({ center: knownCenter, zoom: 6 });
                        }
                    }
                }
            });

            map.current?.on('click', 'corn-point-layer', (e) => {
                e.originalEvent.stopPropagation();
                if (e.features && e.features[0]) {
                    setSelectedItem(e.features[0].properties as any);
                }
            });

            // Targeted Animation Loop (State Pulse & Rail Flow)
            let t = 0;
            let dashOffset = 0;

            const animate = () => {
                t += 0.02; // Slower, smoother pulse
                dashOffset -= 0.2; // Flow speed

                // 1. Organic "Breathing" for States
                // Use a combination of sine waves for a less mechanical feel
                const intensity = (Math.sin(t) + 1) / 2;
                const breath = 0.2 + (intensity * 0.5); // Range 0.2 -> 0.7

                if (map.current?.getLayer('state-border-highlight')) {
                    map.current.setPaintProperty('state-border-highlight', 'line-opacity', breath);
                    map.current.setPaintProperty('state-border-highlight', 'line-blur', 1 + (intensity * 2)); // Subtle blur pulse
                }

                // 2. Rail Flow Animation (Pulse)
                if (map.current?.getLayer('rail-flow')) {
                    // Pulsing opacity to simulate active data flow
                    const flowPulse = (Math.sin(t * 3) + 1) / 2;
                    map.current.setPaintProperty('rail-flow', 'line-opacity', 0.2 + (flowPulse * 0.4));
                }

                requestAnimationFrame(animate);
            };
            animate();
        });
    }, []);

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

        // Toggle all rail-related layers (premium + fallback)
        ['rail-layer', 'rail-glow', 'rail-core', 'rail-flow'].forEach(layer => {
            setVisibility(layer, showRail);
        });

        setVisibility('transloader-layer', !!showTransloaders);
        // state-glow-layer logic if needed, or always valid
        if (map.current.getLayer('state-border')) {
            map.current.setLayoutProperty('state-border', 'visibility', 'visible');
        }

    }, [showHeatmap, showRail, showTransloaders]);

    // Update Highlight Layer based on Top States
    useEffect(() => {
        if (!map.current || !styleLoaded) return;

        if (topStates.length > 0) {
            // Convert codes to full names for Mapbox filter
            const topStateNames = topStates
                .map(code => Object.keys(STATE_NAME_TO_CODE).find(key => STATE_NAME_TO_CODE[key] === code))
                .filter(Boolean);

            if (map.current.getLayer('state-border-highlight')) {
                map.current.setFilter('state-border-highlight', ['in', 'STATE_NAME', ...topStateNames]);
            }
        } else {
            if (map.current.getLayer('state-border-highlight')) {
                map.current.setFilter('state-border-highlight', ['in', 'STATE_NAME', '']); // Hide all
            }
        }

    }, [topStates, styleLoaded]);

    // Update State Colors Effect (Fill Layer)
    useEffect(() => {
        if (!map.current || !styleLoaded) return;

        const expression: any[] = ['match', ['get', 'STATE_NAME']];
        const opacityExpression: any[] = ['match', ['get', 'STATE_NAME']];

        Object.entries(stateMetrics).forEach(([code, data]) => {
            const name = Object.keys(STATE_NAME_TO_CODE).find(key => STATE_NAME_TO_CODE[key] === code);
            if (name) {
                if (data.isHot) {
                    expression.push(name, '#06b6d4'); // Cyan for data presence
                    opacityExpression.push(name, 0.4);
                } else {
                    expression.push(name, '#1e293b');
                    opacityExpression.push(name, 0.1);
                }
            }
        });

        expression.push('#000000');
        opacityExpression.push(0);

        if (map.current.getLayer('state-fill')) {
            map.current.setPaintProperty('state-fill', 'fill-color', expression as any);
            map.current.setPaintProperty('state-fill', 'fill-opacity', opacityExpression as any);
        }

    }, [stateMetrics, styleLoaded]);

    // Update heatmap data
    useEffect(() => {
        if (!map.current || !styleLoaded) return;
        const source = map.current.getSource('corn-heat') as mapboxgl.GeoJSONSource;
        if (source) {
            let features: any[] = [];

            if (heatmapMode === 'buyers') {
                features = buyers.map(b => ({
                    type: 'Feature',
                    properties: {
                        weight: b.basis * 10,
                        isOpportunity: b.basis > 0.2 || (b.netPrice || 0) > 4.5,
                        ...b
                    },
                    geometry: { type: 'Point', coordinates: [b.lng, b.lat] }
                }));
            } else {
                features = heatmapData.map(p => ({
                    type: 'Feature',
                    properties: {
                        weight: p.cornPrice,
                        ...p
                    },
                    geometry: { type: 'Point', coordinates: [p.lng, p.lat] }
                }));
            }
            source.setData({ type: 'FeatureCollection', features });
        }
    }, [heatmapData, buyers, heatmapMode, styleLoaded]);

    // Update Transloaders
    useEffect(() => {
        if (!map.current || !styleLoaded) return;
        const source = map.current.getSource('transloaders') as mapboxgl.GeoJSONSource;
        if (source && transloaders) {
            const features = transloaders.map(t => ({
                type: 'Feature',
                properties: t,
                geometry: { type: 'Point', coordinates: [t.lng, t.lat] }
            }));
            source.setData({ type: 'FeatureCollection', features } as any);
        }
    }, [transloaders, styleLoaded]);

    // Zoom Handling
    useEffect(() => {
        if (!map.current || !zoomedState) return;
        const center = STATE_CENTERS[zoomedState];
        if (center) {
            map.current.flyTo({ center, zoom: 6, essential: true });
        }
    }, [zoomedState]);

    // Hover Handling
    useEffect(() => {
        if (!map.current || !map.current.isStyleLoaded()) return;

        if (hoveredRegionId) {
            map.current.setPaintProperty('corn-point-layer', 'circle-radius', [
                'case',
                ['==', ['get', 'id'], hoveredRegionId],
                20,
                ['interpolate', ['linear'], ['zoom'], 4, 4, 10, 10]
            ]);
            map.current.setPaintProperty('corn-point-layer', 'circle-color', [
                'case',
                ['==', ['get', 'id'], hoveredRegionId],
                '#22c55e',
                ['case', ['boolean', ['get', 'isOpportunity'], false], '#22d3ee', '#64748b']
            ]);
        } else {
            map.current.setPaintProperty('corn-point-layer', 'circle-radius', [
                'interpolate',
                ['linear'],
                ['zoom'],
                4, 4,
                10, 10
            ]);
            map.current.setPaintProperty('corn-point-layer', 'circle-color', [
                'case',
                ['boolean', ['get', 'isOpportunity'], false],
                '#22d3ee',
                '#64748b'
            ]);
        }
    }, [hoveredRegionId]);


    return (
        <div className="relative w-full h-full bg-black">
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
