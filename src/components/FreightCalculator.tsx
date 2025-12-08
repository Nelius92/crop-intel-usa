import React, { useEffect, useState } from 'react';
import { Buyer } from '../types';
import { calculateFreight, FreightQuote } from '../services/railService';

interface FreightCalculatorProps {
    buyers: Buyer[];
}

interface Deal {
    buyer: Buyer;
    quote: FreightQuote;
    netPrice: number;
}

export const FreightCalculator: React.FC<FreightCalculatorProps> = ({ buyers }) => {
    const [topDeals, setTopDeals] = useState<Deal[]>([]);
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        const calculateBestDeals = async () => {
            if (buyers.length === 0) return;

            setLoading(true);
            try {
                // Calculate freight for ALL buyers to find the true best net price
                const results = await Promise.all(buyers.map(async (buyer) => {
                    const quote = await calculateFreight({ lat: buyer.lat, lng: buyer.lng }, buyer.city);
                    const netPrice = buyer.cashPrice - quote.ratePerBushel;
                    return {
                        buyer,
                        quote: {
                            ...quote,
                            origin: "Campbell, MN", // Hardcoded origin for now
                            destination: buyer.city,
                            distanceMiles: quote.distance,
                            totalCostPerCar: quote.ratePerBushel * 3500, // Approx bushels per car
                            estimatedDays: Math.ceil(quote.distance / 400) // Approx 400 miles per day
                        },
                        netPrice
                    };
                }));

                // Sort by Net Price descending and take top 3
                const sorted = results.sort((a, b) => b.netPrice - a.netPrice).slice(0, 3);
                setTopDeals(sorted);
            } catch (error) {
                console.error("Error calculating freight:", error);
            } finally {
                setLoading(false);
            }
        };

        calculateBestDeals();
    }, [buyers]);

    return (
        <div className="bg-zinc-900/90 backdrop-blur-md border border-zinc-800 rounded-xl p-4 shadow-2xl h-full flex flex-col">
            <h3 className="text-lg font-bold text-white mb-3 flex items-center gap-2 shrink-0">
                <span className="text-cyan-400">🚂</span> Top 3 Net Deals
                <div className="ml-auto flex flex-col items-end">
                    <span className="text-xs font-normal text-zinc-500">Origin: Campbell, MN</span>
                    {topDeals[0]?.quote.isRealTime && (
                        <span className="text-[10px] font-bold text-green-400 bg-green-900/30 px-1.5 py-0.5 rounded border border-green-800/50 animate-pulse">
                            LIVE USDA RATES
                        </span>
                    )}
                </div>
            </h3>

            <div className="space-y-3 overflow-y-auto custom-scrollbar pr-1 flex-1">
                {loading ? (
                    <div className="flex flex-col gap-3">
                        {[1, 2, 3].map(i => (
                            <div key={i} className="h-24 bg-zinc-800/50 rounded-lg animate-pulse" />
                        ))}
                    </div>
                ) : topDeals.length > 0 ? (
                    topDeals.map((deal, index) => (
                        <div key={deal.buyer.id} className="bg-zinc-800/50 rounded-lg p-3 border border-zinc-700/50 hover:border-cyan-500/30 transition-colors group">
                            <div className="flex justify-between items-start mb-2">
                                <div>
                                    <div className="flex items-center gap-2">
                                        <span className="text-xs font-bold bg-cyan-500/20 text-cyan-400 px-1.5 py-0.5 rounded">#{index + 1}</span>
                                        <span className="font-semibold text-zinc-200">{deal.buyer.name}</span>
                                    </div>
                                    <div className="text-xs text-zinc-400 mt-0.5">{deal.buyer.city}, {deal.buyer.state}</div>
                                </div>
                                <div className="text-right">
                                    <div className="text-xs text-zinc-500 uppercase tracking-wider">Net Price</div>
                                    <div className="text-lg font-bold text-green-400">${deal.netPrice.toFixed(2)}</div>
                                </div>
                            </div>

                            <div className="grid grid-cols-2 gap-2 text-xs mt-2 pt-2 border-t border-zinc-700/50">
                                <div>
                                    <div className="text-zinc-500">Cash Bid</div>
                                    <div className="text-zinc-300 font-mono">${deal.buyer.cashPrice.toFixed(2)}</div>
                                </div>
                                <div className="text-right">
                                    <div className="text-zinc-500">Freight Cost</div>
                                    <div className="text-red-300 font-mono">-${deal.quote.ratePerBushel.toFixed(2)}</div>
                                </div>
                                <div>
                                    <div className="text-zinc-500">Distance</div>
                                    <div className="text-zinc-300">{deal.quote.distanceMiles} mi</div>
                                </div>
                                <div className="text-right">
                                    <div className="text-zinc-500">Est. Time</div>
                                    <div className="text-zinc-300">{deal.quote.estimatedDays} days</div>
                                </div>
                            </div>
                        </div>
                    ))
                ) : (
                    <div className="text-center text-zinc-500 py-8">
                        No freight data available.
                    </div>
                )}
            </div>
        </div>
    );
};
