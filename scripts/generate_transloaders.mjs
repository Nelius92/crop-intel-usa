import fs from 'fs';

const transloaders = [
    { name: "BNSF Logistics Center Fontana", city: "Fontana", state: "CA", lat: 34.0922, lng: -117.4350 },
    { name: "BNSF Logistics Park Chicago", city: "Elwood", state: "IL", lat: 41.3853, lng: -88.1067 },
    { name: "BNSF Alliance Intermodal Facility", city: "Haslet", state: "TX", lat: 32.9618, lng: -97.3106 },
    { name: "BNSF Seattle International Gateway", city: "Seattle", state: "WA", lat: 47.5855, lng: -122.3364 },
    { name: "BNSF Logistics Park Kansas City", city: "Edgerton", state: "KS", lat: 38.7617, lng: -95.0116 },
    { name: "BNSF Memphis Intermodal Facility", city: "Memphis", state: "TN", lat: 35.0392, lng: -89.9238 },
    { name: "BNSF Denver Intermodal Facility", city: "Denver", state: "CO", lat: 39.8033, lng: -104.9758 },
    { name: "BNSF Phoenix Transload", city: "Glendale", state: "AZ", lat: 33.5434, lng: -112.1856 },
    { name: "BNSF Stockton Intermodal Facility", city: "Stockton", state: "CA", lat: 37.9177, lng: -121.2611 },
    { name: "BNSF Omaha Transload Terminal", city: "Omaha", state: "NE", lat: 41.2066, lng: -95.9616 },
    { name: "BNSF Sweetwater Logistics Center", city: "Sweetwater", state: "TX", lat: 32.4709, lng: -100.4058 },
    { name: "BNSF Minot Transload", city: "Minot", state: "ND", lat: 48.2329, lng: -101.2922 },
    { name: "BNSF Spokane International", city: "Spokane", state: "WA", lat: 47.6685, lng: -117.3090 },
    { name: "BNSF Lincoln Managed Transload", city: "Lincoln", state: "NE", lat: 40.8136, lng: -96.7025 },
    { name: "BNSF Galesburg Transload", city: "Galesburg", state: "IL", lat: 40.9416, lng: -90.3807 }
];

const geojson = {
    type: "FeatureCollection",
    features: transloaders.map((t, index) => ({
        type: "Feature",
        properties: {
            id: "bnsf-transload-" + index,
            name: t.name,
            city: t.city,
            state: t.state,
            type: "Premier Transload"
        },
        geometry: {
            type: "Point",
            coordinates: [t.lng, t.lat]
        }
    }))
};

fs.writeFileSync('./public/data/bnsf-transloaders.geojson', JSON.stringify(geojson, null, 2));
console.log("Successfully generated BNSF Premier Transload Network geojson.");
