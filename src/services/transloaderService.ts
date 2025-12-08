import { Transloader } from '../types';

export const TRANSLOADERS: Transloader[] = [
    // --- BNSF Premier Transloads ---
    {
        id: 'tl-commerce-ca',
        name: 'Ventura Transfer / LAJ Commerce',
        city: 'Commerce',
        state: 'CA',
        lat: 34.0006,
        lng: -118.1598,
        railroad: ['BNSF'],
        commodities: ['Dry Bulk', 'Liquids'],
        type: 'transload'
    },
    {
        id: 'tl-galveston-tx',
        name: 'Texas Deepwater Terminal',
        city: 'Houston',
        state: 'TX',
        lat: 29.7186,
        lng: -95.2044,
        railroad: ['BNSF', 'UP', 'KCS'],
        commodities: ['Grain', 'Liquids', 'Food Grade'],
        type: 'transload'
    },
    {
        id: 'tl-stockton-ca',
        name: 'Stockton Terminal & Eastern',
        city: 'Stockton',
        state: 'CA',
        lat: 37.9577,
        lng: -121.2908,
        railroad: ['BNSF', 'UP'],
        commodities: ['Bulk', 'Steel', 'Lumber'],
        type: 'transload'
    },

    // --- CN Transloads (Canada & Mid-America) ---
    {
        id: 'tl-montreal-qc',
        name: 'CN Montreal CargoFlo',
        city: 'Montreal',
        state: 'QC',
        lat: 45.5017,
        lng: -73.5673,
        railroad: ['CN'],
        commodities: ['Plastics', 'Liquids', 'Bulk'],
        type: 'transload'
    },
    {
        id: 'tl-chicago-il',
        name: 'CN Chicago Intermodal',
        city: 'Harvey',
        state: 'IL',
        lat: 41.6100,
        lng: -87.6500,
        railroad: ['CN'],
        commodities: ['Grain', 'Intermodal'],
        type: 'transload'
    },
    {
        id: 'tl-memphis-tn',
        name: 'CN Memphis CargoFlo',
        city: 'Memphis',
        state: 'TN',
        lat: 35.0500,
        lng: -90.0500,
        railroad: ['CN'],
        commodities: ['Liquids', 'Bulk'],
        type: 'transload'
    },

    // --- CPKC (Canada/US/Mexico) ---
    {
        id: 'tl-st-luc-qc',
        name: 'CPT St-Luc',
        city: 'Montreal',
        state: 'QC',
        lat: 45.4500,
        lng: -73.6500,
        railroad: ['CPKC'],
        commodities: ['Automotive', 'Bulk'],
        type: 'transload'
    },
    {
        id: 'tl-kansas-city-mo',
        name: 'CPKC Knoche Yard',
        city: 'Kansas City',
        state: 'MO',
        lat: 39.1200,
        lng: -94.5500,
        railroad: ['CPKC'],
        commodities: ['Grain', 'Bulk'],
        type: 'transload'
    },

    // --- CSX TRANSFLO (East) ---
    {
        id: 'tl-philadelphia-pa',
        name: 'TRANSFLO Philadelphia',
        city: 'Philadelphia',
        state: 'PA',
        lat: 39.9526,
        lng: -75.1652,
        railroad: ['CSX'],
        commodities: ['Chemicals', 'Waste', 'Bulk'],
        type: 'transload'
    },
    {
        id: 'tl-atlanta-ga',
        name: 'TRANSFLO Atlanta',
        city: 'Atlanta',
        state: 'GA',
        lat: 33.7490,
        lng: -84.3880,
        railroad: ['CSX'],
        commodities: ['Ethanol', 'Sand', 'Plastics'],
        type: 'transload'
    },
    {
        id: 'tl-tampa-fl',
        name: 'TRANSFLO Tampa',
        city: 'Tampa',
        state: 'FL',
        lat: 27.9506,
        lng: -82.4572,
        railroad: ['CSX'],
        commodities: ['Phosphate', 'Chemicals'],
        type: 'transload'
    },
    {
        id: 'tl-columbus-oh',
        name: 'TRANSFLO Columbus',
        city: 'Columbus',
        state: 'OH',
        lat: 39.9612,
        lng: -82.9988,
        railroad: ['CSX'],
        commodities: ['Bulk', 'Steel'],
        type: 'transload'
    },
    {
        id: 'tl-charlotte-nc',
        name: 'Distribution Technology',
        city: 'Charlotte',
        state: 'NC',
        lat: 35.2271,
        lng: -80.8431,
        railroad: ['CSX', 'NS'],
        commodities: ['Food Grade', 'General Cargo'],
        type: 'transload'
    },

    // --- Norfolk Southern TBT ---
    {
        id: 'tl-elizabeth-nj',
        name: 'NS TBT Elizabeth',
        city: 'Elizabeth',
        state: 'NJ',
        lat: 40.6640,
        lng: -74.2107,
        railroad: ['NS'],
        commodities: ['Ethanol', 'Lumber', 'Steel'],
        type: 'transload'
    },
    {
        id: 'tl-swedesboro-nj',
        name: 'Loyalty Operations Center',
        city: 'Swedesboro',
        state: 'NJ',
        lat: 39.7500,
        lng: -75.3100,
        railroad: ['NS'],
        commodities: ['Food Grade', 'Frozen'],
        type: 'transload'
    },

    // --- Union Pacific (Loup Logistics) ---
    {
        id: 'tl-denver-co',
        name: 'Loup Logistics Denver',
        city: 'Denver',
        state: 'CO',
        lat: 39.7392,
        lng: -104.9903,
        railroad: ['UP'],
        commodities: ['Grain', 'Aggregates'],
        type: 'transload'
    },
    {
        id: 'tl-odessa-tx',
        name: 'Loup Logistics Odessa',
        city: 'Odessa',
        state: 'TX',
        lat: 31.8457,
        lng: -102.3676,
        railroad: ['UP'],
        commodities: ['Frac Sand', 'Pipe', 'Oilfield'],
        type: 'transload'
    },
    {
        id: 'tl-westlake-la',
        name: 'Savage Transload',
        city: 'Westlake',
        state: 'LA',
        lat: 30.2400,
        lng: -93.2500,
        railroad: ['KCS', 'UP'],
        commodities: ['Chemicals', 'Petroleum'],
        type: 'transload'
    },
    {
        id: 'tl-marion-oh',
        name: 'Marion Industrial Rail Park',
        city: 'Marion',
        state: 'OH',
        lat: 40.5887,
        lng: -83.1285,
        railroad: ['CSX', 'NS'],
        commodities: ['Lumber', 'Paper', 'Grain'],
        type: 'transload'
    }
];

export const fetchTransloaders = async (): Promise<Transloader[]> => {
    // Simulate async fetch
    return new Promise((resolve) => {
        setTimeout(() => resolve(TRANSLOADERS), 100);
    });
};
