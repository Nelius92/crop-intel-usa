import React, { useEffect, useRef, useState } from 'react';
import mapboxgl from 'mapbox-gl';
import { HeatmapPoint, Buyer, Transloader } from '../types';
import { RAIL_LINES } from '../services/railService';
import { BuyerMarkers } from './BuyerMarkers';
import { OpportunityDrawer } from './OpportunityDrawer';

// Token from environment variables
const MAPBOX_TOKEN = import.meta.env.VITE_MAPBOX_ACCESS_TOKEN;
if (MAPBOX_TOKEN) {
    mapboxgl.accessToken = MAPBOX_TOKEN;
}

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
    const lastAutoFocusKey = useRef<string>('');
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
            style: 'mapbox://styles/mapbox/navigation-night-v1',
            center: center,
            zoom: zoom,
            pitch: 60,
            bearing: -15,
            projection: { name: 'mercator' }
        });

        map.current.on('load', () => {
            setStyleLoaded(true);

            // Add atmospheric fog for 3D depth
            map.current?.setFog({
                'range': [0.5, 3],
                'color': '#0f172a', // Slate-900 for dark deep space look
                'horizon-blend': 0.15,
                'high-color': '#1e293b',
                'space-color': '#020617',
                'star-intensity': 0.6
            });

            // Add 3D Terrain
            map.current?.addSource('mapbox-dem', {
                'type': 'raster-dem',
                'url': 'mapbox://mapbox.mapbox-terrain-dem-v1',
                'tileSize': 512,
                'maxzoom': 14
            });
            map.current?.setTerrain({ 'source': 'mapbox-dem', 'exaggeration': 1.5 });

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
                    'line-opacity': 0 // Completely transparent base borders
                }
            });

            // 4. Add Highlighted Border Layer (Sleek Glow)
            map.current?.addLayer({
                id: 'state-border-highlight',
                type: 'line',
                source: 'us-states',
                paint: {
                    'line-color': '#22c55e', // Neon Green
                    'line-width': 2,
                    'line-opacity': 0, // Animated later
                    'line-blur': 4
                },
                filter: ['in', 'STATE_NAME', ''] // Default empty filter
            });

            // 4b. Add Highlighted Fill Layer (Subtle Glass)
            map.current?.addLayer({
                id: 'state-fill-highlight',
                type: 'fill',
                source: 'us-states',
                paint: {
                    'fill-color': '#064e3b', // Deep emerald
                    'fill-opacity': 0.15
                },
                filter: ['in', 'STATE_NAME', '']
            }, 'state-border-highlight');

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
                                'BNSF', '#ff5500', // Intense Neon Orange for BNSF
                                'UP', '#fde047',   // Yellow-300
                                'CSX', '#60a5fa',  // Blue-400
                                'NS', '#818cf8',   // Indigo-400
                                'CN', '#f87171',   // Red-400
                                'CPKC', '#c084fc', // Purple-400
                                '#94a3b8'          // Slate-400
                            ],
                            'line-width': [
                                'interpolate', ['linear'], ['zoom'],
                                3, 0.5,
                                6, 2,
                                10, 6
                            ],
                            'line-opacity': [
                                'interpolate', ['linear'], ['zoom'],
                                3, 0.05, // Almost invisible at national level to avoid hairball
                                6, 0.2,
                                10, 0.4
                            ],
                            'line-blur': 4
                        }
                    });

                    // 2. Core Line Layer (Sharp definition depending on zoom)
                    map.current.addLayer({
                        id: 'rail-core',
                        type: 'line',
                        source: 'us-rail-network',
                        layout: { 'line-join': 'round', 'line-cap': 'round' },
                        paint: {
                            'line-color': [
                                'match', ['get', 'owner'],
                                'BNSF', '#ffffff',
                                'UP', '#eab308',
                                'CSX', '#3b82f6',
                                'NS', '#6366f1',
                                'CN', '#ef4444',
                                'CPKC', '#a855f7',
                                '#64748b'
                            ],
                            'line-width': [
                                'interpolate', ['linear'], ['zoom'],
                                3, 0.2, // Ultra-thin at national level
                                6, 1,
                                12, 3
                            ],
                            'line-opacity': [
                                'interpolate', ['linear'], ['zoom'],
                                3, 0.1, // Faint at national level
                                6, 0.5,
                                10, 0.95
                            ]
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
                            'line-width': [
                                'interpolate', ['linear'], ['zoom'],
                                3, 0.5,
                                8, 2
                            ],
                            'line-opacity': 0.4,
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
                data: { type: 'FeatureCollection', features: [] },
                cluster: true,
                clusterMaxZoom: 10,
                clusterRadius: 50,
                clusterProperties: {
                    hasOpportunity: ['any', ['get', 'isOpportunity']],
                    weight: ['max', ['get', 'weight']]
                }
            });

            // 1. Heatmap Base
            map.current?.addLayer({
                id: 'corn-heat-layer',
                type: 'heatmap',
                source: 'corn-heat',
                // Optionally filter out clusters to avoid double counting, or use them.
                // By not filtering '!', ['has', 'point_count'], the heatmap will include clusters
                // using the max weight we defined above.
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

            // 2. Cluster Circles
            map.current?.addLayer({
                id: 'clusters',
                type: 'circle',
                source: 'corn-heat',
                filter: ['has', 'point_count'],
                paint: {
                    'circle-color': '#0f172a', // Deep slate for cluster background
                    'circle-radius': [
                        'step',
                        ['get', 'point_count'],
                        16,  // size for < 5
                        5,
                        20,  // size for 5-14
                        15,
                        26   // size for >= 15
                    ],
                    'circle-stroke-width': 2,
                    'circle-stroke-color': [
                        'case',
                        ['boolean', ['get', 'hasOpportunity'], false],
                        '#22c55e', // Neon green stroke if cluster has opportunity
                        '#38bdf8'  // Light blue otherwise
                    ],
                    'circle-opacity': 0.95,
                    'circle-pitch-alignment': 'map',
                    'circle-pitch-scale': 'map'
                }
            });

            // 3. Cluster Count Text
            map.current?.addLayer({
                id: 'cluster-count',
                type: 'symbol',
                source: 'corn-heat',
                filter: ['has', 'point_count'],
                layout: {
                    'text-field': '{point_count_abbreviated}',
                    'text-font': ['Open Sans Bold', 'Arial Unicode MS Bold'],
                    'text-size': 12,
                },
                paint: {
                    'text-color': '#ffffff'
                }
            });

            // 4. Unclustered Individual Points
            map.current?.addLayer({
                id: 'corn-point-layer',
                type: 'circle',
                source: 'corn-heat',
                filter: ['!', ['has', 'point_count']],
                minzoom: 4,
                paint: {
                    'circle-radius': ['interpolate', ['linear'], ['zoom'], 4, 4, 10, 8],
                    'circle-color': [
                        'case',
                        ['boolean', ['get', 'isOpportunity'], false],
                        '#22c55e', // Neon green for buyers on rail
                        '#64748b'
                    ],
                    'circle-stroke-color': [
                        'case',
                        ['boolean', ['get', 'isOpportunity'], false],
                        '#16a34a', // Darker green stroke
                        '#334155'
                    ],
                    'circle-stroke-width': 2,
                    'circle-opacity': 0.9,
                    'circle-pitch-alignment': 'map', // Map-aligned for true 3D placement
                    'circle-pitch-scale': 'map'
                }
            });

            map.current?.addLayer({
                id: 'corn-point-pulse',
                type: 'circle',
                source: 'corn-heat',
                filter: ['all', ['!', ['has', 'point_count']], ['==', ['get', 'isOpportunity'], true]],
                minzoom: 4,
                paint: {
                    'circle-radius': ['interpolate', ['linear'], ['zoom'], 4, 8, 10, 15],
                    'circle-color': '#22c55e', // Neon green pulse
                    'circle-opacity': 0.1, // Animated via setPaintProperty
                    'circle-pitch-alignment': 'map',
                    'circle-pitch-scale': 'map'
                }
            }, 'corn-point-layer'); // Place exactly below the main point

            // Fetch and styled BNSF Transloaders
            fetch('/data/bnsf-transloaders.geojson')
                .then(res => res.ok ? res.json() : null)
                .then(data => {
                    if (!map.current || !data) return;
                    map.current.addSource('transloaders', {
                        type: 'geojson',
                        data: data
                    });

                    map.current.addLayer({
                        id: 'transloader-layer',
                        type: 'circle',
                        source: 'transloaders',
                        minzoom: 3,
                        paint: {
                            'circle-radius': ['interpolate', ['linear'], ['zoom'], 3, 4, 10, 8],
                            'circle-color': '#a855f7', // Neon Purple
                            'circle-stroke-color': '#7e22ce', // Darker Purple
                            'circle-stroke-width': 2,
                            'circle-opacity': 0.9,
                            'circle-pitch-alignment': 'map',
                            'circle-pitch-scale': 'map'
                        }
                    });

                    // Add a pulsing glow layer for transloaders below the main dot
                    map.current.addLayer({
                        id: 'transloader-pulse',
                        type: 'circle',
                        source: 'transloaders',
                        minzoom: 3,
                        paint: {
                            'circle-radius': ['interpolate', ['linear'], ['zoom'], 3, 8, 10, 16],
                            'circle-color': '#a855f7',
                            'circle-opacity': 0.1, // Animated below
                            'circle-pitch-alignment': 'map',
                            'circle-pitch-scale': 'map'
                        }
                    }, 'transloader-layer');
                })
                .catch(console.error);


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

            // Cluster Click Handler
            map.current?.on('click', 'clusters', (e) => {
                const features = map.current?.queryRenderedFeatures(e.point, {
                    layers: ['clusters']
                });
                const clusterId = features?.[0].properties?.cluster_id;
                const source = map.current?.getSource('corn-heat') as mapboxgl.GeoJSONSource;

                if (clusterId && source) {
                    source.getClusterExpansionZoom(clusterId, (err, zoom) => {
                        if (err || !map.current) return;

                        const geom = features[0].geometry;
                        if (geom.type === 'Point') {
                            map.current.easeTo({
                                center: geom.coordinates as [number, number],
                                zoom: zoom ?? undefined
                            });
                        }
                    });
                }
            });

            // Cluster Hover Cursors
            map.current?.on('mouseenter', 'clusters', () => {
                if (map.current) map.current.getCanvas().style.cursor = 'pointer';
            });
            map.current?.on('mouseleave', 'clusters', () => {
                if (map.current) map.current.getCanvas().style.cursor = '';
            });

            map.current?.on('mouseenter', 'corn-point-layer', () => {
                if (map.current) map.current.getCanvas().style.cursor = 'pointer';
            });
            map.current?.on('mouseleave', 'corn-point-layer', () => {
                if (map.current) map.current.getCanvas().style.cursor = '';
            });

            // Targeted Animation Loop (State Pulse & Rail Flow)
            let t = 0;
            let dashOffset = 0;

            const animate = () => {
                t += 0.02; // Slower, smoother pulse
                dashOffset -= 0.2; // Flow speed

                // 1. Organic "Breathing" for States
                const intensity = (Math.sin(t) + 1) / 2;
                const breath = 0.2 + (intensity * 0.6); // Range 0.2 -> 0.8

                if (map.current?.getLayer('state-border-highlight')) {
                    map.current.setPaintProperty('state-border-highlight', 'line-opacity', breath);
                    map.current.setPaintProperty('state-border-highlight', 'line-blur', 1 + (intensity * 3));
                }

                // Small targeted pulse for Potential Buyers
                if (map.current?.getLayer('corn-point-pulse')) {
                    const buyerPulse = 0.1 + (intensity * 0.4); // 0.1 -> 0.5 opacity
                    map.current.setPaintProperty('corn-point-pulse', 'circle-opacity', buyerPulse);
                }

                // Pulse for BNSF Transloaders
                if (map.current?.getLayer('transloader-pulse')) {
                    const transPulse = 0.05 + (intensity * 0.35); // 0.05 -> 0.4 opacity
                    map.current.setPaintProperty('transloader-pulse', 'circle-opacity', transPulse);
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
        setVisibility('corn-point-pulse', showHeatmap);

        // Toggle all rail-related layers (premium + fallback)
        ['rail-layer', 'rail-glow', 'rail-core', 'rail-flow'].forEach(layer => {
            setVisibility(layer, showRail);
        });

        setVisibility('transloader-layer', !!showTransloaders);
        setVisibility('transloader-pulse', !!showTransloaders);
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
            if (map.current.getLayer('state-fill-highlight')) {
                map.current.setFilter('state-fill-highlight', ['in', 'STATE_NAME', ...topStateNames]);
            }
        } else {
            if (map.current.getLayer('state-border-highlight')) {
                map.current.setFilter('state-border-highlight', ['in', 'STATE_NAME', '']); // Hide all
            }
            if (map.current.getLayer('state-fill-highlight')) {
                map.current.setFilter('state-fill-highlight', ['in', 'STATE_NAME', '']); // Hide all
            }
        }

    }, [topStates, styleLoaded]);

    // Auto-focus the top 3 opportunity states when the ranking changes.
    useEffect(() => {
        if (!map.current || !styleLoaded || topStates.length === 0 || zoomedState) return;

        const centers = topStates
            .map((stateCode) => STATE_CENTERS[stateCode])
            .filter(Boolean) as [number, number][];

        if (centers.length === 0) return;

        const focusKey = [...topStates].sort().join(',');
        if (lastAutoFocusKey.current === focusKey) return;
        lastAutoFocusKey.current = focusKey;

        if (centers.length === 1) {
            map.current.flyTo({ center: centers[0], zoom: 5.5, essential: true });
            return;
        }

        const bounds = new mapboxgl.LngLatBounds();
        centers.forEach(([lng, lat]) => bounds.extend([lng, lat]));
        map.current.fitBounds(bounds, {
            padding: 80,
            maxZoom: 5.5,
            duration: 1200,
            essential: true
        });
    }, [topStates, styleLoaded, zoomedState]);

    // Update State Colors Effect (Fill Layer)
    useEffect(() => {
        if (!map.current || !styleLoaded) return;

        const expression: any[] = ['match', ['get', 'STATE_NAME']];
        const opacityExpression: any[] = ['match', ['get', 'STATE_NAME']];

        let hasData = false;
        Object.entries(stateMetrics).forEach(([code, data]) => {
            const name = Object.keys(STATE_NAME_TO_CODE).find(key => STATE_NAME_TO_CODE[key] === code);
            if (name) {
                hasData = true;
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
            map.current.setPaintProperty('state-fill', 'fill-color', hasData ? expression : '#000000' as any);
            map.current.setPaintProperty('state-fill', 'fill-opacity', hasData ? opacityExpression : 0 as any);
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
                        weight: (b.basis ?? 0) * 10,
                        isOpportunity: (b.basis ?? 0) > 0.2 || (b.netPrice || 0) > 4.5,
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
