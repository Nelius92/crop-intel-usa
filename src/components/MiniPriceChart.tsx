import React from 'react';
import { AreaChart, Area, Tooltip, ResponsiveContainer } from 'recharts';

const data = [
    { time: '08:00', price: 4.20 },
    { time: '10:00', price: 4.25 },
    { time: '12:00', price: 4.32 },
    { time: '14:00', price: 4.28 },
    { time: '16:00', price: 4.35 },
    { time: '18:00', price: 4.40 },
];

export const MiniPriceChart: React.FC = () => {
    return (
        <div className="w-80 h-48 bg-corn-card/80 backdrop-blur-md rounded-xl border border-corn-accent/20 p-4 shadow-2xl">
            <div className="flex justify-between items-start mb-2">
                <div>
                    <h3 className="text-sm font-semibold text-slate-200">National Average</h3>
                    <p className="text-2xl font-bold text-white">$4.40 <span className="text-xs font-normal text-green-400">+4.7%</span></p>
                </div>
                <div className="px-2 py-1 bg-green-500/20 rounded text-xs text-green-400 font-medium">
                    Live
                </div>
            </div>

            <div className="h-28 w-full">
                <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={data}>
                        <defs>
                            <linearGradient id="colorPrice" x1="0" y1="0" x2="0" y2="1">
                                <stop offset="5%" stopColor="#22c55e" stopOpacity={0.3} />
                                <stop offset="95%" stopColor="#22c55e" stopOpacity={0} />
                            </linearGradient>
                        </defs>
                        <Tooltip
                            contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', fontSize: '12px' }}
                            itemStyle={{ color: '#22c55e' }}
                        />
                        <Area
                            type="monotone"
                            dataKey="price"
                            stroke="#22c55e"
                            strokeWidth={2}
                            fillOpacity={1}
                            fill="url(#colorPrice)"
                        />
                    </AreaChart>
                </ResponsiveContainer>
            </div>
        </div>
    );
};
