import React, { useEffect } from 'react';
import { FALLBACK_BUYERS_DATA } from '../services/fallbackData';
import { enrichBuyerWithGoogleData } from '../services/buyersService';

export const DataEnricher: React.FC = () => {
    // const [jsonOutput, setJsonOutput] = React.useState("");

    useEffect(() => {
        const enrich = async () => {
            console.log("Starting data enrichment...");
            const enrichedBuyers = [];

            // Process in chunks to avoid rate limits
            for (const buyer of FALLBACK_BUYERS_DATA) {
                // Skip if already has a real phone number (not 555)
                if (buyer.contactPhone && !buyer.contactPhone.includes('555')) {
                    enrichedBuyers.push(buyer);
                    continue;
                }

                try {
                    console.log(`Enriching ${buyer.name}...`);
                    const enriched = await enrichBuyerWithGoogleData(buyer);
                    enrichedBuyers.push(enriched);
                    // Small delay to be nice to the API
                    await new Promise(resolve => setTimeout(resolve, 300));
                } catch (err) {
                    console.error(`Failed to enrich ${buyer.name}`, err);
                    enrichedBuyers.push(buyer);
                }
            }

            const finalJson = JSON.stringify(enrichedBuyers);
            console.log("START_JSON");
            console.log(finalJson);
            console.log("END_JSON");
            // setJsonOutput(JSON.stringify(enrichedBuyers, null, 4));
        };

        enrich();
    }, []);

    return (
        <div className="fixed inset-0 bg-black/90 z-[100] p-8 flex flex-col items-center justify-center overflow-auto">
            <h2 className="text-white text-xl mb-4">Data Enrichment Complete</h2>
            <div className="text-green-500">Check Console for Data</div>
        </div>
    );
};
