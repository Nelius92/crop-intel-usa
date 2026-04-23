import mapboxgl from 'mapbox-gl';
import type { Feature, GeoJsonProperties, Point } from 'geojson';
import type { Buyer, HeatmapPoint, Transloader } from '../../types';
import { STATE_CENTERS, STATE_NAME_TO_CODE } from './constants';

export function buildStateMetrics(buyers: Buyer[], topStates: string[]) {
    const metrics: Record<string, { maxPrice: number; count: number; isHot: boolean }> = {};
    buyers.forEach((buyer) => {
        if (!metrics[buyer.state]) {
            metrics[buyer.state] = { maxPrice: 0, count: 0, isHot: false };
        }
        metrics[buyer.state].count++;
        if ((buyer.netPrice || 0) > metrics[buyer.state].maxPrice) {
            metrics[buyer.state].maxPrice = buyer.netPrice || 0;
        }
    });

    Object.keys(metrics).forEach((state) => {
        if (metrics[state].maxPrice > 4.5 || topStates.includes(state)) {
            metrics[state].isHot = true;
        }
    });
    return metrics;
}

export function setLayerVisibility(map: mapboxgl.Map, layerId: string, visible: boolean) {
    if (map.getLayer(layerId)) {
        map.setLayoutProperty(layerId, 'visibility', visible ? 'visible' : 'none');
    }
}

export function updateTopStateFilters(map: mapboxgl.Map, topStates: string[]) {
    if (topStates.length > 0) {
        const topStateNames = topStates
            .map((code) => Object.keys(STATE_NAME_TO_CODE).find((key) => STATE_NAME_TO_CODE[key] === code))
            .filter(Boolean);

        if (map.getLayer('state-border-highlight')) {
            map.setFilter('state-border-highlight', ['in', 'STATE_NAME', ...topStateNames]);
        }
        if (map.getLayer('state-fill-highlight')) {
            map.setFilter('state-fill-highlight', ['in', 'STATE_NAME', ...topStateNames]);
        }
        return;
    }

    if (map.getLayer('state-border-highlight')) {
        map.setFilter('state-border-highlight', ['in', 'STATE_NAME', '']);
    }
    if (map.getLayer('state-fill-highlight')) {
        map.setFilter('state-fill-highlight', ['in', 'STATE_NAME', '']);
    }
}

export function buildStateFillExpressions(
    stateMetrics: Record<string, { maxPrice: number; count: number; isHot: boolean }>
): { hasData: boolean; fillColor: any[]; fillOpacity: any[] } {
    const fillColor: any[] = ['match', ['get', 'STATE_NAME']];
    const fillOpacity: any[] = ['match', ['get', 'STATE_NAME']];
    let hasData = false;

    Object.entries(stateMetrics).forEach(([code, data]) => {
        const stateName = Object.keys(STATE_NAME_TO_CODE).find((key) => STATE_NAME_TO_CODE[key] === code);
        if (!stateName) {
            return;
        }

        hasData = true;
        if (data.isHot) {
            fillColor.push(stateName, '#06b6d4');
            fillOpacity.push(stateName, 0.4);
            return;
        }

        fillColor.push(stateName, '#1e293b');
        fillOpacity.push(stateName, 0.1);
    });

    fillColor.push('#000000');
    fillOpacity.push(0);
    return { hasData, fillColor, fillOpacity };
}

export function viewportHasData(
    bounds: mapboxgl.LngLatBounds,
    heatmapData: HeatmapPoint[],
    buyers: Buyer[]
) {
    return heatmapData.some((point) =>
        point.lat >= bounds.getSouth()
        && point.lat <= bounds.getNorth()
        && point.lng >= bounds.getWest()
        && point.lng <= bounds.getEast()
    ) || buyers.some((buyer) =>
        buyer.lat >= bounds.getSouth()
        && buyer.lat <= bounds.getNorth()
        && buyer.lng >= bounds.getWest()
        && buyer.lng <= bounds.getEast()
    );
}

export function focusTopStates(
    map: mapboxgl.Map,
    topStates: string[]
): boolean {
    const centers = topStates
        .map((stateCode) => STATE_CENTERS[stateCode])
        .filter(Boolean) as [number, number][];

    if (centers.length === 0) {
        return false;
    }

    if (centers.length === 1) {
        map.flyTo({ center: centers[0], zoom: 5.5, essential: true, duration: 1200 });
        return true;
    }

    const bounds = new mapboxgl.LngLatBounds();
    centers.forEach(([lng, lat]) => bounds.extend([lng, lat]));
    map.fitBounds(bounds, {
        padding: 80,
        maxZoom: 5.5,
        duration: 1200,
        essential: true,
    });
    return true;
}

export function buildHeatSourceFeatures(
    heatmapMode: 'default' | 'buyers',
    heatmapData: HeatmapPoint[],
    buyers: Buyer[]
): Feature<Point, GeoJsonProperties>[] {
    if (heatmapMode === 'buyers') {
        return buyers.map((buyer) => ({
            type: 'Feature' as const,
            properties: {
                weight: (buyer.basis ?? 0) * 10,
                isOpportunity: (buyer.basis ?? 0) > 0.2 || (buyer.netPrice || 0) > 4.5,
                railScore: buyer.railConfidence ?? buyer.railEvidence?.score ?? 0,
                ...buyer,
            },
            geometry: { type: 'Point' as const, coordinates: [buyer.lng, buyer.lat] },
        }));
    }

    return heatmapData.map((point) => ({
        type: 'Feature' as const,
        properties: {
            weight: point.cornPrice,
            railScore: point.railConfidence ?? point.railEvidence?.score ?? 0,
            ...point,
        },
        geometry: { type: 'Point' as const, coordinates: [point.lng, point.lat] },
    }));
}

export function buildTransloaderFeatures(transloaders: Transloader[]): Feature<Point, GeoJsonProperties>[] {
    return transloaders.map((transloader) => ({
        type: 'Feature' as const,
        properties: transloader,
        geometry: { type: 'Point' as const, coordinates: [transloader.lng, transloader.lat] },
    }));
}
