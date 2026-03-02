import fs from 'fs';
import https from 'https';
import osmtogeojson from 'osmtogeojson';

const OVERPASS_URL = 'https://overpass-api.de/api/interpreter';
const OUTPUT_FILE = './public/data/us-railroads.geojson';

const getBnsfNetwork = async () => {
    // 30.0,-125.0,49.0,-87.0 covers West + Midwest US where BNSF operates
    const query = `
        [out:json][timeout:240];
        (
          way["railway"="rail"]["operator"~"BNSF",i](30.0,-125.0,49.0,-87.0);
          way["railway"="rail"]["name"~"BNSF",i](30.0,-125.0,49.0,-87.0);
        );
        out body;
        >;
        out skel qt;
    `;

    console.log("Fetching dense BNSF network from Overpass API...");

    return new Promise((resolve, reject) => {
        const req = https.request(OVERPASS_URL, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded'
            }
        }, (res) => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => {
                if (res.statusCode !== 200) {
                    console.error("Overpass API error:", res.statusCode, data.substring(0, 200));
                    reject(new Error("API returned non-200"));
                    return;
                }

                try {
                    console.log("Parsing OSM JSON data...");
                    const osmJson = JSON.parse(data);

                    console.log(`Found ${osmJson.elements?.length || 0} segments. Converting to GeoJSON...`);
                    const geojson = osmtogeojson(osmJson);

                    // Add owner and type for styling
                    geojson.features.forEach(f => {
                        f.properties.owner = 'BNSF';
                        f.properties.type = 'mainline'; // Treat all as mainline for the glow effect
                    });

                    // We also want to keep the other railroads for contrast if needed, but the user requested "dense BNSF network". 
                    // To keep it simple and ultra-detailed for BNSF, we just write this out.
                    fs.writeFileSync(OUTPUT_FILE, JSON.stringify(geojson));
                    console.log("Successfully generated dense BNSF GeoJSON to " + OUTPUT_FILE + " (" + geojson.features?.length + " features)");
                    resolve(geojson);
                } catch (e) {
                    console.error("Error parsing/converting data:", e);
                    reject(e);
                }
            });
        });

        req.on('error', reject);
        req.write("data=" + encodeURIComponent(query));
        req.end();
    });
};

getBnsfNetwork().catch(console.error);
