import React from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import { Buyer } from '../types';

interface BuyerChartProps {
    buyers: Buyer[];
    onSelect: (buyer: Buyer) => void;
}

export const BuyerChart: React.FC<BuyerChartProps> = ({ buyers, onSelect }) => {
    // Process data for the chart: Get top 10 buyers by max basis
    const data = [...buyers]
        .sort((a, b) => b.basis - a.basis)
        .slice(0, 3)
        .map(buyer => ({
            name: buyer.name,
            basis: buyer.basis,
            location: `${buyer.city}, ${buyer.state}`,
            type: buyer.type,
            rail: buyer.railAccessible,
            originalBuyer: buyer
        }));

    return (
        <div className="w-full h-full bg-corn-card/50 backdrop-blur-md rounded-xl border border-corn-accent/10 p-4 flex flex-col">
            <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                <span className="w-2 h-8 bg-corn-accent rounded-full"></span>
                Top 3 Paying Buyers (Basis)
            </h3>
            <div className="flex-1 min-h-0">
                <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={data} layout="vertical" margin={{ top: 5, right: 30, left: 130, bottom: 5 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#334155" horizontal={false} />
                        <XAxis type="number" stroke="#94a3b8" />
                        <YAxis
                            dataKey="name"
                            type="category"
                            width={120}
                            stroke="#94a3b8"
                            tick={{ fontSize: 11 }}
                            interval={0}
                        />
                        <Tooltip
                            contentStyle={{ backgroundColor: '#120202', borderColor: '#450a0a', color: '#f8fafc' }}
                            itemStyle={{ color: '#ef4444' }}
                            cursor={{ fill: 'rgba(239, 68, 68, 0.1)' }}
                        />
                        <Bar
                            dataKey="basis"
                            radius={[0, 4, 4, 0]}
                            onClick={(data: any) => {
                                if (data && data.originalBuyer) {
                                    onSelect(data.originalBuyer);
                                }
                            }}
                            className="cursor-pointer"
                        >
                            {data.map((entry, index) => (
                                <Cell
                                    key={`cell-${index}`}
                                    fill={entry.rail ? '#22d3ee' : (index < 3 ? '#ef4444' : '#7f1d1d')}
                                    stroke={entry.rail ? '#22d3ee' : 'none'}
                                    strokeWidth={entry.rail ? 1 : 0}
                                    className="hover:opacity-80 transition-opacity cursor-pointer"
                                />
                            ))}
                        </Bar>
                    </BarChart>
                </ResponsiveContainer>
            </div>
        </div>
    );
};
