import { HeatmapPoint, Buyer } from '../types';
import buyersData from '../data/buyers.json';

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

export const FALLBACK_BUYERS_DATA: Buyer[] = buyersData as unknown as Buyer[];
