import React, { useEffect, useRef, useState } from 'react';
import mapboxgl from 'mapbox-gl';
import { HeatmapPoint, Buyer, Transloader } from '../types';
import { RAIL_LINES } from '../services/railService';
import { bnsfOpportunitiesService, BNSFOpportunity } from '../services/bnsfScraperService';
import { BuyerMarkers } from './BuyerMarkers';
import { OpportunityDrawer } from './OpportunityDrawer';
import { fetchStateDroughtData, StateDrought } from '../services/droughtService';
import { STATE_CENTERS, STATE_NAME_TO_CODE } from './corn-map/constants';
import {
    buildHeatSourceFeatures,
    buildStateFillExpressions,
    buildStateMetrics,
    buildTransloaderFeatures,
    focusTopStates,
    setLayerVisibility,
    updateTopStateFilters,
    viewportHasData,
} from './corn-map/layers';
import {
    expandCluster,
    POINT_INTERACTION_LAYERS,
    reconstructBnsfOpportunity,
    resolveHeatmapSelection,
} from './corn-map/selection';

// Token from environment variables
const MAPBOX_TOKEN = import.meta.env.VITE_MAPBOX_ACCESS_TOKEN;
if (MAPBOX_TOKEN) {
    mapboxgl.accessToken = MAPBOX_TOKEN;
}

interface CornMapProps {
    showHeatmap: boolean;
    showBuyers: boolean;
    showRail: boolean;
    showBnsfOpportunities?: boolean;
    showTransloaders?: boolean;
    showDrought?: boolean;
    buyers?: Buyer[];
    heatmapData?: HeatmapPoint[]; // Live heatmap data
    transloaders?: Transloader[];
    heatmapMode?: 'default' | 'buyers';
    view?: 'default' | 'usa';
    theme?: string;
    topStates?: string[]; // List of state codes to highlight (e.g. ['CA', 'TX'])
    hoveredRegionId?: string | null;
    isVisible?: boolean; // Whether the map tab is currently active
}

export const CornMap: React.FC<CornMapProps> = ({
    showHeatmap,
    showBuyers,
    showRail,
    showBnsfOpportunities = true,
    showTransloaders = true,
    showDrought = false,
    buyers = [],
    heatmapData = [],
    transloaders = [],
    heatmapMode = 'default',
    view = 'default',
    hoveredRegionId,
    topStates = [],
    isVisible = true
}) => {
    const mapContainer = useRef<HTMLDivElement>(null);
    const map = useRef<mapboxgl.Map | null>(null);
    const lastAutoFocusKey = useRef<string>('');
    const buyersRef = useRef<Buyer[]>(buyers); // Ref to avoid stale closure in map click handlers
    const [selectedItem, setSelectedItem] = useState<HeatmapPoint | Buyer | Transloader | BNSFOpportunity | null>(null);
    const [styleLoaded, setStyleLoaded] = useState(false);
    const [bnsfLayersLoaded, setBnsfLayersLoaded] = useState(false);
    const [zoomedState, setZoomedState] = useState<string | null>(null);
    const [droughtData, setDroughtData] = useState<Map<string, StateDrought>>(new Map());
    const droughtDataRef = useRef<Map<string, StateDrought>>(new Map());

    // Keep buyersRef in sync with latest prop
    useEffect(() => { buyersRef.current = buyers; }, [buyers]);
    // Keep droughtDataRef in sync with latest state
    useEffect(() => { droughtDataRef.current = droughtData; }, [droughtData]);

    // Compute State Metrics for Coloring/Blinking
    const stateMetrics = React.useMemo(() => buildStateMetrics(buyers, topStates), [buyers, topStates]);

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

            // Apply custom dark mode styling
            const style = map.current?.getStyle();
            if (style && style.layers) {
                style.layers.forEach(layer => {
                    const id = layer.id || '';
                    if (id.includes('poi') || id.includes('park') || id.includes('road-minor') || id.includes('road-street') || id.includes('road-path') || id.includes('road-pedestrian') || id.includes('road-steps') || id.includes('landuse')) {
                        map.current?.setLayoutProperty(id, 'visibility', 'none');
                    }
                    if (id.includes('water') && layer.type === 'fill') {
                        map.current?.setPaintProperty(id, 'fill-color', '#0B0F19');
                    }
                    if (id === 'background' || id.includes('background')) {
                        map.current?.setPaintProperty(id, 'background-color', '#141923');
                    }
                    if (id.includes('admin-1') && layer.type === 'line') {
                        map.current?.setPaintProperty(id, 'line-color', '#334155');
                        map.current?.setPaintProperty(id, 'line-opacity', 0.4);
                    }
                });
            }

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
                    'line-color': '#334155',
                    'line-width': 1,
                    'line-opacity': 0.4 // 40% base opacity per user request
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

            // ── Drought Monitor Fill Layer ────────────────────────────
            // Renders BELOW state borders but above base state fill
            // Color is dynamically set from USDM API data
            map.current?.addLayer({
                id: 'drought-fill',
                type: 'fill',
                source: 'us-states',
                paint: {
                    'fill-color': '#000000',
                    'fill-opacity': 0
                },
                layout: {
                    'visibility': 'none'  // Off by default — user opts in
                }
            }, 'state-border');

            // Drought border highlight (subtle border around drought states)
            map.current?.addLayer({
                id: 'drought-border',
                type: 'line',
                source: 'us-states',
                paint: {
                    'line-color': '#000000',
                    'line-width': 1.5,
                    'line-opacity': 0
                },
                layout: {
                    'visibility': 'none'
                }
            }, 'state-border');

            // --- Premium Rail Network Layers (Glow + Core + Flow) ---
            fetch('/data/bnsf-full-network.geojson')
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

                    // 1. Outer Glow Layer
                    if (!map.current.getLayer('rail-glow')) {
                        map.current.addLayer({
                            id: 'rail-glow',
                            type: 'line',
                            source: 'us-rail-network',
                            layout: { 'line-join': 'round', 'line-cap': 'round' },
                            paint: {
                                'line-color': '#F97316',
                                'line-width': 8,
                                'line-blur': 4,
                                'line-opacity': 0.25
                            }
                        });
                    }

                    // 2. Core Line Layer
                    if (!map.current.getLayer('rail-core')) {
                        map.current.addLayer({
                            id: 'rail-core',
                            type: 'line',
                            source: 'us-rail-network',
                            layout: { 'line-join': 'round', 'line-cap': 'round' },
                            paint: {
                                'line-color': '#FF6B00',
                                'line-width': 1.5,
                                'line-opacity': 1
                            }
                        });
                    }
                })
                .catch((e) => {
                    console.error("Rail GeoJSON failed:", e);
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
                            'line-color': '#ff5500', // Authentic BNSF Orange
                            'line-width': 2,
                            'line-opacity': 0.8
                        }
                    });
                });

            map.current?.addSource('market-heat', {
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
                id: 'market-heat-layer',
                type: 'heatmap',
                source: 'market-heat',
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
                source: 'market-heat',
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
                source: 'market-heat',
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

            // 4. Unclustered Individual Points (Buyers)
            map.current?.addLayer({
                id: 'market-point-layer',
                type: 'circle',
                source: 'market-heat',
                filter: ['!', ['has', 'point_count']],
                minzoom: 4,
                paint: {
                    'circle-radius': ['interpolate', ['linear'], ['zoom'], 4, 4, 10, 8],
                    'circle-color': [
                        'case',
                        ['>', ['coalesce', ['get', 'railScore'], 0], 50], '#00E676',
                        '#FFD600'
                    ],
                    'circle-stroke-color': 'rgba(255, 255, 255, 0.8)',
                    'circle-stroke-width': 2,
                    'circle-opacity': 0.9,
                    'circle-pitch-alignment': 'map', // Map-aligned for true 3D placement
                    'circle-pitch-scale': 'map'
                }
            });

            map.current?.addLayer({
                id: 'market-point-pulse',
                type: 'circle',
                source: 'market-heat',
                filter: ['!', ['has', 'point_count']],
                minzoom: 4,
                paint: {
                    'circle-radius': ['interpolate', ['linear'], ['zoom'], 4, 8, 10, 15],
                    'circle-color': [
                        'case',
                        ['>', ['coalesce', ['get', 'railScore'], 0], 50], '#00E676',
                        '#FFD600'
                    ],
                    'circle-opacity': 0.1, // Animated via setPaintProperty
                    'circle-pitch-alignment': 'map',
                    'circle-pitch-scale': 'map'
                }
            }, 'market-point-layer'); // Place exactly below the main point

            // --- BNSF Opportunities Layer (Scraped Data) ---
            bnsfOpportunitiesService.getLiveOpportunities().then(bnsfOpps => {
                if (!map.current) return;

                const bnsfGeoJson = {
                    type: 'FeatureCollection',
                    features: bnsfOpps.map(opp => ({
                        type: 'Feature',
                        properties: opp,
                        geometry: { type: 'Point', coordinates: [opp.location.lng, opp.location.lat] }
                    }))
                };

                map.current.addSource('bnsf-opportunities', {
                    type: 'geojson',
                    data: bnsfGeoJson as any,
                    cluster: true,
                    clusterMaxZoom: 12,
                    clusterRadius: 35
                });

                // Clusters Layer
                map.current.addLayer({
                    id: 'bnsf-opp-clusters',
                    type: 'circle',
                    source: 'bnsf-opportunities',
                    filter: ['has', 'point_count'],
                    paint: {
                        'circle-color': '#d97706', // Darker amber for clusters
                        'circle-radius': ['step', ['get', 'point_count'], 15, 10, 20, 50, 25]
                    }
                });

                // Cluster Count Text
                map.current.addLayer({
                    id: 'bnsf-opp-cluster-count',
                    type: 'symbol',
                    source: 'bnsf-opportunities',
                    filter: ['has', 'point_count'],
                    layout: {
                        'text-field': '{point_count_abbreviated}',
                        'text-font': ['DIN Offc Pro Medium', 'Arial Unicode MS Bold'],
                        'text-size': 12
                    },
                    paint: {
                        'text-color': '#111827'
                    }
                });

                // Core Marker (Unclustered)
                map.current.addLayer({
                    id: 'bnsf-opp-layer',
                    type: 'circle',
                    source: 'bnsf-opportunities',
                    filter: ['!', ['has', 'point_count']],
                    minzoom: 3,
                    paint: {
                        'circle-radius': ['interpolate', ['linear'], ['zoom'], 4, 6, 10, 10],
                        'circle-color': '#f59e0b', // Gold/Amber
                        'circle-stroke-color': '#b45309',
                        'circle-stroke-width': 2,
                        'circle-opacity': 0.95,
                        'circle-pitch-alignment': 'map',
                        'circle-pitch-scale': 'map'
                    }
                });

                // Outer Glow Pulse (Unclustered)
                map.current.addLayer({
                    id: 'bnsf-opp-pulse',
                    type: 'circle',
                    source: 'bnsf-opportunities',
                    filter: ['!', ['has', 'point_count']],
                    minzoom: 3,
                    paint: {
                        'circle-radius': ['interpolate', ['linear'], ['zoom'], 3, 12, 10, 24],
                        'circle-color': '#f59e0b',
                        'circle-opacity': 0.1, // Animated
                        'circle-pitch-alignment': 'map',
                        'circle-pitch-scale': 'map'
                    }
                }, 'bnsf-opp-layer');

                // Signal that the async layers are ready so toggles work
                setBnsfLayersLoaded(true);

            }).catch(console.error);
            // ----------------------------------------------

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


            // Events — Guard state-fill clicks so data point clicks don't also trigger zoom
            map.current?.on('click', 'state-fill', (e) => {
                // Don't zoom if the click hit a data point layer
                const hitFeatures = map.current?.queryRenderedFeatures(e.point, {
                    layers: POINT_INTERACTION_LAYERS.filter((layerId) => map.current?.getLayer(layerId))
                });
                if (hitFeatures && hitFeatures.length > 0) return; // A data point handled this click

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

            map.current?.on('click', 'market-point-layer', (e) => {
                e.originalEvent.stopPropagation();
                if (e.features && e.features[0]) {
                    const selected = resolveHeatmapSelection(e.features[0].properties, buyersRef.current);
                    if (selected) {
                        setSelectedItem(selected);
                    }
                }
            });

            map.current?.on('click', 'bnsf-opp-layer', (e) => {
                e.originalEvent.stopPropagation();
                if (e.features && e.features[0]) {
                    const opportunity = reconstructBnsfOpportunity(e.features[0].properties);
                    if (opportunity) {
                        setSelectedItem(opportunity);
                    }
                }
            });

            // Cluster Click Handler
            map.current?.on('click', 'clusters', (e) => {
                const features = map.current?.queryRenderedFeatures(e.point, {
                    layers: ['clusters']
                });
                if (features && features.length > 0 && map.current) {
                    expandCluster(map.current, 'market-heat', features);
                }
            });

            // BNSF Cluster Click Handler
            map.current?.on('click', 'bnsf-opp-clusters', (e) => {
                const features = map.current?.queryRenderedFeatures(e.point, {
                    layers: ['bnsf-opp-clusters']
                });
                if (features && features.length > 0 && map.current) {
                    expandCluster(map.current, 'bnsf-opportunities', features);
                }
            });

            // Cluster Hover Cursors
            map.current?.on('mouseenter', 'clusters', () => {
                if (map.current) map.current.getCanvas().style.cursor = 'pointer';
            });
            map.current?.on('mouseleave', 'clusters', () => {
                if (map.current) map.current.getCanvas().style.cursor = '';
            });

            map.current?.on('mouseenter', 'market-point-layer', () => {
                if (map.current) map.current.getCanvas().style.cursor = 'pointer';
            });
            map.current?.on('mouseleave', 'market-point-layer', () => {
                if (map.current) map.current.getCanvas().style.cursor = '';
            });

            map.current?.on('mouseenter', 'bnsf-opp-layer', () => {
                if (map.current) map.current.getCanvas().style.cursor = 'pointer';
            });
            map.current?.on('mouseleave', 'bnsf-opp-layer', () => {
                if (map.current) map.current.getCanvas().style.cursor = '';
            });

            map.current?.on('mouseenter', 'bnsf-opp-clusters', () => {
                if (map.current) map.current.getCanvas().style.cursor = 'pointer';
            });
            map.current?.on('mouseleave', 'bnsf-opp-clusters', () => {
                if (map.current) map.current.getCanvas().style.cursor = '';
            });

            // ── Drought Layer: Hover Tooltip ────────────────────────
            const droughtPopup = new mapboxgl.Popup({
                closeButton: false,
                closeOnClick: false,
                className: 'drought-tooltip',
                maxWidth: '240px',
                offset: 10,
            });

            map.current?.on('mouseenter', 'drought-fill', (e) => {
                if (!map.current) return;
                map.current.getCanvas().style.cursor = 'crosshair';

                const stateName = e.features?.[0]?.properties?.STATE_NAME;
                if (!stateName) return;

                const stateCode = STATE_NAME_TO_CODE[stateName];
                const drought = stateCode ? droughtDataRef.current.get(stateCode) : null;
                if (!drought || drought.severity === 'none') return;

                const emoji = drought.severity === 'exceptional' || drought.severity === 'extreme' ? '🔴'
                    : drought.severity === 'severe' ? '🟠'
                        : drought.severity === 'moderate' ? '🟡' : '⚪';

                droughtPopup
                    .setLngLat(e.lngLat)
                    .setHTML(`
                        <div style="font-family: system-ui, -apple-system, sans-serif; padding: 6px 0;">
                            <div style="font-size: 13px; font-weight: 700; color: #fff; margin-bottom: 4px;">
                                ${emoji} ${stateName}
                            </div>
                            <div style="font-size: 11px; color: #a1a1aa; margin-bottom: 6px;">
                                ${drought.severity.charAt(0).toUpperCase() + drought.severity.slice(1)} Drought
                            </div>
                            <div style="display: grid; grid-template-columns: repeat(5, 1fr); gap: 3px; font-size: 9px; font-family: monospace;">
                                <div style="text-align: center; padding: 2px; background: rgba(250,204,21,0.2); border-radius: 3px; color: #fde047;">D0<br/>${drought.d0.toFixed(0)}%</div>
                                <div style="text-align: center; padding: 2px; background: rgba(251,191,36,0.2); border-radius: 3px; color: #fbbf24;">D1<br/>${drought.d1.toFixed(0)}%</div>
                                <div style="text-align: center; padding: 2px; background: rgba(251,146,60,0.2); border-radius: 3px; color: #fb923c;">D2<br/>${drought.d2.toFixed(0)}%</div>
                                <div style="text-align: center; padding: 2px; background: rgba(239,68,68,0.2); border-radius: 3px; color: #ef4444;">D3<br/>${drought.d3.toFixed(0)}%</div>
                                <div style="text-align: center; padding: 2px; background: rgba(127,29,29,0.3); border-radius: 3px; color: #fca5a5;">D4<br/>${drought.d4.toFixed(0)}%</div>
                            </div>
                        </div>
                    `)
                    .addTo(map.current);
            });

            map.current?.on('mousemove', 'drought-fill', (e) => {
                if (droughtPopup.isOpen()) {
                    droughtPopup.setLngLat(e.lngLat);
                }
            });

            map.current?.on('mouseleave', 'drought-fill', () => {
                if (map.current) map.current.getCanvas().style.cursor = '';
                droughtPopup.remove();
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
                if (map.current?.getLayer('market-point-pulse')) {
                    const buyerPulse = 0.1 + (intensity * 0.4); // 0.1 -> 0.5 opacity
                    map.current.setPaintProperty('market-point-pulse', 'circle-opacity', buyerPulse);
                }

                // Pulse for BNSF Transloaders
                if (map.current?.getLayer('transloader-pulse')) {
                    const transPulse = 0.05 + (intensity * 0.35); // 0.05 -> 0.4 opacity
                    map.current.setPaintProperty('transloader-pulse', 'circle-opacity', transPulse);
                }

                // Pulse for BNSF Opportunities
                if (map.current?.getLayer('bnsf-opp-pulse')) {
                    const oppPulse = 0.08 + (intensity * 0.4);
                    map.current.setPaintProperty('bnsf-opp-pulse', 'circle-opacity', oppPulse);
                }

                // 2. Removed Flow Animation for cleanup

                requestAnimationFrame(animate);
            };
            animate();
        });
    }, []);

    // Resize map when tab becomes visible (keep-alive pattern)
    // Mapbox renders to 0x0 when container is display:none
    useEffect(() => {
        if (isVisible && map.current) {
            // Small delay ensures the container has its final dimensions
            const timer = setTimeout(() => map.current?.resize(), 50);
            return () => clearTimeout(timer);
        }
    }, [isVisible]);

    // Toggle layers visibility
    useEffect(() => {
        if (!map.current || !styleLoaded) return;

        setLayerVisibility(map.current, 'market-heat-layer', showHeatmap);
        setLayerVisibility(map.current, 'market-point-layer', showHeatmap);
        setLayerVisibility(map.current, 'market-point-pulse', showHeatmap);

        // Toggle all rail-related layers (premium + fallback)
        ['rail-layer', 'rail-glow', 'rail-core', 'rail-flow'].forEach((layerId) => {
            setLayerVisibility(map.current!, layerId, showRail);
        });

        setLayerVisibility(map.current, 'transloader-layer', !!showTransloaders);
        setLayerVisibility(map.current, 'transloader-pulse', !!showTransloaders);

        // Drought Monitor layer toggle
        setLayerVisibility(map.current, 'drought-fill', !!showDrought);
        setLayerVisibility(map.current, 'drought-border', !!showDrought);

        if (bnsfLayersLoaded) {
            setLayerVisibility(map.current, 'bnsf-opp-layer', !!showBnsfOpportunities);
            setLayerVisibility(map.current, 'bnsf-opp-pulse', !!showBnsfOpportunities);
            setLayerVisibility(map.current, 'bnsf-opp-clusters', !!showBnsfOpportunities);
            setLayerVisibility(map.current, 'bnsf-opp-cluster-count', !!showBnsfOpportunities);
        }

        // state-glow-layer logic if needed, or always valid
        if (map.current.getLayer('state-border')) {
            map.current.setLayoutProperty('state-border', 'visibility', 'visible');
        }

    }, [showHeatmap, showRail, showTransloaders, showBnsfOpportunities, showDrought, styleLoaded, bnsfLayersLoaded]);

    // Update Highlight Layer based on Top States
    useEffect(() => {
        if (!map.current || !styleLoaded) return;
        updateTopStateFilters(map.current, topStates);
    }, [topStates, styleLoaded]);

    // Auto-focus the top 3 opportunity states when the ranking changes.
    // SMART: If the user's current viewport already contains data points
    // for the new crop, do NOT re-center — preserve their context.
    useEffect(() => {
        if (!map.current || !styleLoaded || topStates.length === 0 || zoomedState) return;

        const focusKey = [...topStates].sort().join(',');
        if (lastAutoFocusKey.current === focusKey) return;
        lastAutoFocusKey.current = focusKey;

        // ── Viewport preservation check ─────────────────────────────────
        // If the current viewport contains any data points for this crop,
        // the user is already looking at relevant data — don't rip them away.
        const currentBounds = map.current.getBounds();
        if (currentBounds && viewportHasData(currentBounds, heatmapData, buyers)) {
            return;
        }
        focusTopStates(map.current, topStates);
    }, [topStates, styleLoaded, zoomedState, heatmapData, buyers]);

    // Update State Colors Effect (Fill Layer)
    useEffect(() => {
        if (!map.current || !styleLoaded) return;

        const { hasData, fillColor, fillOpacity } = buildStateFillExpressions(stateMetrics);

        if (map.current.getLayer('state-fill')) {
            map.current.setPaintProperty('state-fill', 'fill-color', hasData ? fillColor : '#000000' as any);
            map.current.setPaintProperty('state-fill', 'fill-opacity', hasData ? fillOpacity : 0 as any);
        }

    }, [stateMetrics, styleLoaded]);

    // ── Drought Monitor: Fetch data & color states ────────────────
    useEffect(() => {
        if (!styleLoaded) return;
        fetchStateDroughtData()
            .then(data => setDroughtData(data))
            .catch(err => console.error('[CornMap] Drought fetch failed:', err));
    }, [styleLoaded]);

    // Apply drought colors to the drought fill layer when data arrives or showDrought changes
    useEffect(() => {
        if (!map.current || !styleLoaded || droughtData.size === 0) return;

        const STATE_NAME_TO_CODE_ENTRIES = Object.entries(STATE_NAME_TO_CODE);

        // Build data-driven fill-color and fill-opacity expressions
        const fillColorExpr: any[] = ['match', ['get', 'STATE_NAME']];
        const fillOpacityExpr: any[] = ['match', ['get', 'STATE_NAME']];
        const borderColorExpr: any[] = ['match', ['get', 'STATE_NAME']];
        const borderOpacityExpr: any[] = ['match', ['get', 'STATE_NAME']];

        let hasData = false;

        for (const [stateName, stateCode] of STATE_NAME_TO_CODE_ENTRIES) {
            const drought = droughtData.get(stateCode);
            if (!drought) continue;

            // Only color states that have some drought
            if (drought.severity === 'none') continue;

            hasData = true;

            // Use the severity color with graduated opacity for dark theme
            let fillColor: string;
            let opacity: number;
            let borderColor: string;

            switch (drought.severity) {
                case 'exceptional':
                    fillColor = '#730000'; opacity = 0.35; borderColor = '#990000'; break;
                case 'extreme':
                    fillColor = '#E60000'; opacity = 0.28; borderColor = '#FF3333'; break;
                case 'severe':
                    fillColor = '#FFAA00'; opacity = 0.22; borderColor = '#FFCC44'; break;
                case 'moderate':
                    fillColor = '#FCD37F'; opacity = 0.18; borderColor = '#FFE0A0'; break;
                case 'abnormal':
                    fillColor = '#FFFF00'; opacity = 0.12; borderColor = '#FFFF66'; break;
                default:
                    fillColor = '#000000'; opacity = 0; borderColor = '#000000'; break;
            }

            fillColorExpr.push(stateName, fillColor);
            fillOpacityExpr.push(stateName, opacity);
            borderColorExpr.push(stateName, borderColor);
            borderOpacityExpr.push(stateName, 0.5);
        }

        // Default fallback for states with no drought
        fillColorExpr.push('#000000');
        fillOpacityExpr.push(0);
        borderColorExpr.push('#000000');
        borderOpacityExpr.push(0);

        if (hasData && map.current.getLayer('drought-fill')) {
            map.current.setPaintProperty('drought-fill', 'fill-color', fillColorExpr as any);
            map.current.setPaintProperty('drought-fill', 'fill-opacity', fillOpacityExpr as any);
        }

        if (hasData && map.current.getLayer('drought-border')) {
            map.current.setPaintProperty('drought-border', 'line-color', borderColorExpr as any);
            map.current.setPaintProperty('drought-border', 'line-opacity', borderOpacityExpr as any);
        }

    }, [droughtData, showDrought, styleLoaded]);

    // Update heatmap data
    useEffect(() => {
        if (!map.current || !styleLoaded) return;
        const source = map.current.getSource('market-heat') as mapboxgl.GeoJSONSource;
        if (source) {
            const features = buildHeatSourceFeatures(heatmapMode, heatmapData, buyers);
            source.setData({ type: 'FeatureCollection', features });
        }
    }, [heatmapData, buyers, heatmapMode, styleLoaded]);

    // Update Transloaders
    useEffect(() => {
        if (!map.current || !styleLoaded) return;
        const source = map.current.getSource('transloaders') as mapboxgl.GeoJSONSource;
        if (source && transloaders) {
            const features = buildTransloaderFeatures(transloaders);
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
            map.current.setPaintProperty('market-point-layer', 'circle-radius', [
                'case',
                ['==', ['get', 'id'], hoveredRegionId],
                20,
                ['interpolate', ['linear'], ['zoom'], 4, 4, 10, 10]
            ]);
            map.current.setPaintProperty('market-point-layer', 'circle-color', [
                'case',
                ['==', ['get', 'id'], hoveredRegionId],
                '#22c55e',
                ['case', ['>', ['coalesce', ['get', 'railScore'], 0], 50], '#00E676', '#FFD600']
            ]);
        } else {
            map.current.setPaintProperty('market-point-layer', 'circle-radius', [
                'interpolate',
                ['linear'],
                ['zoom'],
                4, 4,
                10, 10
            ]);
            map.current.setPaintProperty('market-point-layer', 'circle-color', [
                'case',
                ['>', ['coalesce', ['get', 'railScore'], 0], 50], '#00E676',
                '#FFD600'
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
