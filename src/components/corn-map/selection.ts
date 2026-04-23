import type { GeoJSONSource, Map, MapboxGeoJSONFeature } from 'mapbox-gl';
import type { Buyer, HeatmapPoint } from '../../types';
import type { BNSFOpportunity } from '../../services/bnsfScraperService';

export const POINT_INTERACTION_LAYERS = [
    'market-point-layer',
    'bnsf-opp-layer',
    'clusters',
    'bnsf-opp-clusters',
    'transloader-layer',
];

export function resolveHeatmapSelection(
    properties: MapboxGeoJSONFeature['properties'],
    buyers: Buyer[]
): Buyer | HeatmapPoint | null {
    const buyerId = properties?.buyerId || properties?.id;
    if (buyerId) {
        const matchedBuyer = buyers.find((buyer) => buyer.id === buyerId || `buyer-heat-${buyer.id}` === buyerId);
        if (matchedBuyer) {
            return matchedBuyer;
        }
    }

    return properties ? (properties as unknown as HeatmapPoint) : null;
}

export function reconstructBnsfOpportunity(
    properties: MapboxGeoJSONFeature['properties']
): BNSFOpportunity | null {
    if (!properties) {
        return null;
    }

    const opportunity: BNSFOpportunity = {
        ...(properties as unknown as BNSFOpportunity),
        location: {
            lat: (properties.lat as number | undefined) ?? 0,
            lng: (properties.lng as number | undefined) ?? 0,
            city: (properties.city as string | undefined) ?? 'Unknown',
            state: (properties.state as string | undefined) ?? 'Unknown',
        },
    };

    if (typeof properties.location === 'string') {
        opportunity.location = JSON.parse(properties.location);
    }

    return opportunity;
}

export function expandCluster(
    map: Map,
    sourceId: string,
    features: MapboxGeoJSONFeature[]
) {
    const clusterId = features?.[0]?.properties?.cluster_id;
    const source = map.getSource(sourceId) as GeoJSONSource | undefined;
    if (!clusterId || !source) {
        return;
    }

    source.getClusterExpansionZoom(clusterId, (error, zoom) => {
        if (error) {
            return;
        }

        const geometry = features[0].geometry;
        if (geometry.type === 'Point') {
            map.easeTo({
                center: geometry.coordinates as [number, number],
                zoom: zoom ?? undefined,
            });
        }
    });
}
