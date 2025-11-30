import { HeatmapPoint, Buyer } from '../types';

export const FALLBACK_HEATMAP_DATA: HeatmapPoint[] = [
    { id: 'h1', lat: 41.8781, lng: -87.6298, cornPrice: 4.50, basis: 0.15, change24h: 1.2, isOpportunity: false, regionName: "Chicago Terminal", marketLabel: "Steady demand" },
    { id: 'h2', lat: 41.2565, lng: -95.9345, cornPrice: 4.65, basis: 0.30, change24h: 2.5, isOpportunity: true, regionName: "Omaha Council Bluffs", marketLabel: "Strong ethanol bids" },
    { id: 'h3', lat: 44.9778, lng: -93.2650, cornPrice: 4.40, basis: -0.10, change24h: -0.5, isOpportunity: false, regionName: "Minneapolis", marketLabel: "River logistics slowing" },
    { id: 'h4', lat: 38.6270, lng: -90.1994, cornPrice: 4.75, basis: 0.45, change24h: 0.8, isOpportunity: true, regionName: "St. Louis", marketLabel: "Export demand high" },
    { id: 'h5', lat: 40.8136, lng: -96.7026, cornPrice: 4.55, basis: 0.20, change24h: 1.5, isOpportunity: false, regionName: "Lincoln NE", marketLabel: "Feedlot demand steady" },
    { id: 'h6', lat: 35.4676, lng: -97.5164, cornPrice: 4.80, basis: 0.50, change24h: 0.2, isOpportunity: true, regionName: "Oklahoma City", marketLabel: "Rail shuttle active" },
    { id: 'h7', lat: 46.8083, lng: -100.7837, cornPrice: 4.30, basis: -0.25, change24h: -1.0, isOpportunity: false, regionName: "Bismarck ND", marketLabel: "Harvest pressure" },
    { id: 'h8', lat: 41.5868, lng: -93.6250, cornPrice: 4.60, basis: 0.25, change24h: 1.8, isOpportunity: false, regionName: "Des Moines", marketLabel: "Processor demand" },
    { id: 'h9', lat: 39.7392, lng: -104.9903, cornPrice: 4.90, basis: 0.60, change24h: 0.5, isOpportunity: true, regionName: "Denver", marketLabel: "Western feedlots" },
    { id: 'h10', lat: 41.4418, lng: -82.1735, cornPrice: 4.45, basis: 0.10, change24h: 0.0, isOpportunity: false, regionName: "Lorain OH", marketLabel: "Lake export quiet" }
];

export const FALLBACK_BUYERS_DATA: Buyer[] = [
    { id: 'b1', name: "Big River Resources", type: "ethanol", basis: 0.35, cashPrice: 4.70, city: "West Burlington", state: "IA", region: "Southeast Iowa", railAccessible: true, nearTransload: false, lat: 40.811, lng: -91.179, contactName: "Jim Miller", contactPhone: "(319) 555-0101", contactEmail: "bids@bigriver.com" },
    { id: 'b2', name: "ADM Decatur", type: "processor", basis: 0.25, cashPrice: 4.60, city: "Decatur", state: "IL", region: "Central Illinois", railAccessible: true, nearTransload: true, lat: 39.840, lng: -88.954, contactName: "Sarah Jenkins", contactPhone: "(217) 555-0123", contactEmail: "corn.desk@adm.com" },
    { id: 'b3', name: "Valero Albion", type: "ethanol", basis: 0.40, cashPrice: 4.75, city: "Albion", state: "NE", region: "Northeast Nebraska", railAccessible: true, nearTransload: false, lat: 41.690, lng: -98.003, contactName: "Mike Ross", contactPhone: "(402) 555-0199", contactEmail: "grains@valero.com" },
    { id: 'b4', name: "Cargill Blair", type: "processor", basis: 0.30, cashPrice: 4.65, city: "Blair", state: "NE", region: "Eastern Nebraska", railAccessible: true, nearTransload: true, lat: 41.543, lng: -96.134, contactName: "Lisa Chen", contactPhone: "(402) 555-0155", contactEmail: "blair.corn@cargill.com" },
    { id: 'b5', name: "Hereford Feedlots", type: "feedlot", basis: 0.65, cashPrice: 5.00, city: "Hereford", state: "TX", region: "Texas Panhandle", railAccessible: true, nearTransload: false, lat: 34.815, lng: -102.398, contactName: "Bill Cody", contactPhone: "(806) 555-0177", contactEmail: "feed@hereford.com" },
    { id: 'b6', name: "POET Biorefining", type: "ethanol", basis: 0.20, cashPrice: 4.55, city: "Chancellor", state: "SD", region: "Southeast SD", railAccessible: false, nearTransload: false, lat: 43.370, lng: -96.990, contactName: "Tom Hardy", contactPhone: "(605) 555-0188", contactEmail: "bids.chancellor@poet.com" },
    { id: 'b7', name: "Bunge St. Louis", type: "river", basis: 0.50, cashPrice: 4.85, city: "St. Louis", state: "MO", region: "St. Louis", railAccessible: true, nearTransload: true, lat: 38.627, lng: -90.199, contactName: "River Desk", contactPhone: "(314) 555-0144", contactEmail: "stl.grain@bunge.com" },
    { id: 'b8', name: "Andersons Maumee", type: "shuttle", basis: 0.15, cashPrice: 4.50, city: "Maumee", state: "OH", region: "Toledo Area", railAccessible: true, nearTransload: false, lat: 41.565, lng: -83.650, contactName: "Grain Merch", contactPhone: "(419) 555-0166", contactEmail: "maumee.corn@andersons.com" }
];
