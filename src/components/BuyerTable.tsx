import React from 'react';
import { Buyer } from '../types';
import { Train, Truck } from 'lucide-react';

interface BuyerTableProps {
    buyers: Buyer[];
    onSelect: (buyer: Buyer) => void;
}

export const BuyerTable: React.FC<BuyerTableProps> = ({ buyers, onSelect }) => {
    return (
        <div className="w-full bg-corn-card/50 backdrop-blur-md rounded-xl border border-corn-accent/10 flex flex-col">
            <div className="p-4 border-b border-corn-accent/10">
                <h3 className="text-lg font-bold text-white">Buyer Directory</h3>
            </div>

            <div className="w-full">
                {/* Desktop Table View */}
                <div className="hidden md:block w-full">
                    <table className="w-full text-left border-collapse">
                        <thead className="bg-white/5 sticky top-0 z-10 backdrop-blur-sm">
                            <tr>
                                <th className="px-4 py-4 text-xs font-semibold text-slate-400 uppercase tracking-wider">Name</th>
                                <th className="px-4 py-4 text-xs font-semibold text-slate-400 uppercase tracking-wider">Type</th>
                                <th className="px-4 py-4 text-xs font-semibold text-slate-400 uppercase tracking-wider">Region</th>
                                <th className="px-4 py-4 text-xs font-semibold text-slate-400 uppercase tracking-wider">Contact</th>
                                <th className="px-4 py-4 text-xs font-semibold text-slate-400 uppercase tracking-wider text-right">Basis</th>
                                <th className="px-4 py-4 text-xs font-semibold text-slate-400 uppercase tracking-wider text-right">Cash</th>
                                <th className="px-4 py-4 text-xs font-semibold text-slate-400 uppercase tracking-wider text-right text-red-400">Freight</th>
                                <th className="px-4 py-4 text-xs font-semibold text-slate-400 uppercase tracking-wider text-right text-green-400">Net Price</th>
                                <th className="px-4 py-4 text-xs font-semibold text-slate-400 uppercase tracking-wider text-center">Logistics</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-white/5">
                            {buyers.map((buyer) => (
                                <tr
                                    key={buyer.id}
                                    className="hover:bg-white/5 even:bg-white/[0.02] transition-colors cursor-pointer group"
                                    onClick={() => onSelect(buyer)}
                                >
                                    <td className="px-4 py-4">
                                        <div className="font-medium text-slate-200 text-base group-hover:text-corn-accent transition-colors flex items-center gap-1.5">
                                            {buyer.name}
                                            {buyer.verified && (
                                                <div className="text-green-400" title="Verified by CornIntel Auditor">
                                                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4">
                                                        <path fillRule="evenodd" d="M8.603 3.799A4.49 4.49 0 0112 2.25c1.357 0 2.573.6 3.397 1.549a4.49 4.49 0 013.498 1.307 4.491 4.491 0 011.307 3.497A4.49 4.49 0 0121.75 12a4.49 4.49 0 01-1.549 3.397 4.491 4.491 0 01-1.307 3.497 4.491 4.491 0 01-3.497 1.307A4.49 4.49 0 0112 21.75a4.49 4.49 0 01-3.397-1.549 4.49 4.49 0 01-3.498-1.306 4.491 4.491 0 01-1.307-3.498A4.49 4.49 0 012.25 12c0-1.357.6-2.573 1.549-3.397a4.49 4.49 0 011.307-3.497 4.491 4.491 0 013.497-1.307zm7.007 6.387a.75.75 0 10-1.22-.872l-3.236 4.53L9.53 12.22a.75.75 0 00-1.06 1.06l2.25 2.25a.75.75 0 001.14-.094l3.75-5.25z" clipRule="evenodd" />
                                                    </svg>
                                                </div>
                                            )}
                                        </div>
                                        <div className="text-xs text-slate-500 mt-0.5">{buyer.city}, {buyer.state}</div>
                                    </td>
                                    <td className="px-4 py-4">
                                        <span className={`inline-flex px-2.5 py-1 rounded-md text-xs font-medium capitalize border border-white/5
                                            ${buyer.type === 'ethanol' ? 'bg-green-500/10 text-green-400 border-green-500/20' :
                                                buyer.type === 'feedlot' ? 'bg-amber-500/10 text-amber-400 border-amber-500/20' :
                                                    'bg-blue-500/10 text-blue-400 border-blue-500/20'}`}>
                                            {buyer.type}
                                        </span>
                                    </td>
                                    <td className="px-4 py-4 text-sm text-slate-300">{buyer.region}</td>
                                    <td className="px-4 py-4">
                                        <div className="flex flex-col">
                                            <span className="text-sm font-medium text-white/90">{buyer.contactName || 'N/A'}</span>
                                            <span className="text-xs text-slate-400 font-mono mt-0.5">{buyer.contactPhone}</span>
                                        </div>
                                    </td>
                                    <td className="px-4 py-4 text-right font-mono text-base">
                                        <span className={`font-semibold ${buyer.basis >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                                            {buyer.basis > 0 ? '+' : ''}{buyer.basis.toFixed(2)}
                                        </span>
                                    </td>
                                    <td className="px-4 py-4 text-right font-mono text-sm text-slate-300">
                                        ${buyer.cashPrice?.toFixed(2)}
                                    </td>
                                    <td className="px-4 py-4 text-right font-mono text-sm text-red-400">
                                        -${buyer.freightCost?.toFixed(2) || '0.00'}
                                    </td>
                                    <td className="px-4 py-4 text-right font-mono text-base font-bold text-green-400">
                                        ${buyer.netPrice?.toFixed(2) || '-'}
                                    </td>
                                    <td className="px-4 py-4 flex justify-center gap-2">
                                        {buyer.railAccessible && (
                                            <div className="px-2 py-1 bg-cyan-500/10 rounded-md text-cyan-400 border border-cyan-500/20 flex items-center gap-1.5" title="Rail Accessible">
                                                <Train size={14} />
                                                <span className="text-[10px] font-medium uppercase tracking-wide">Rail</span>
                                            </div>
                                        )}
                                        {buyer.nearTransload && (
                                            <div className="px-2 py-1 bg-purple-500/10 rounded-md text-purple-400 border border-purple-500/20 flex items-center gap-1.5" title="Near Transload">
                                                <Truck size={14} />
                                                <span className="text-[10px] font-medium uppercase tracking-wide">Truck</span>
                                            </div>
                                        )}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>

                {/* Mobile Card View */}
                <div className="md:hidden flex flex-col gap-3 p-3">
                    {buyers.map((buyer) => (
                        <div
                            key={buyer.id}
                            onClick={() => onSelect(buyer)}
                            className="bg-white/5 rounded-lg p-4 border border-white/5 active:bg-white/10 transition-colors"
                        >
                            <div className="flex justify-between items-start mb-3">
                                <div>
                                    <div>
                                        <h4 className="font-bold text-white text-lg flex items-center gap-1.5">
                                            {buyer.name}
                                            {buyer.verified && (
                                                <div className="text-green-400" title="Verified by CornIntel Auditor">
                                                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4">
                                                        <path fillRule="evenodd" d="M8.603 3.799A4.49 4.49 0 0112 2.25c1.357 0 2.573.6 3.397 1.549a4.49 4.49 0 013.498 1.307 4.491 4.491 0 011.307 3.497A4.49 4.49 0 0121.75 12a4.49 4.49 0 01-1.549 3.397 4.491 4.491 0 01-1.307 3.497 4.491 4.491 0 01-3.497 1.307A4.49 4.49 0 0112 21.75a4.49 4.49 0 01-3.397-1.549 4.49 4.49 0 01-3.498-1.306 4.491 4.491 0 01-1.307-3.498A4.49 4.49 0 012.25 12c0-1.357.6-2.573 1.549-3.397a4.49 4.49 0 011.307-3.497 4.491 4.491 0 013.497-1.307zm7.007 6.387a.75.75 0 10-1.22-.872l-3.236 4.53L9.53 12.22a.75.75 0 00-1.06 1.06l2.25 2.25a.75.75 0 001.14-.094l3.75-5.25z" clipRule="evenodd" />
                                                    </svg>
                                                </div>
                                            )}
                                        </h4>
                                        <div className="text-sm text-slate-400">{buyer.city}, {buyer.state}</div>
                                    </div>
                                    <div className="text-right">
                                        <div className="text-xs text-slate-500 uppercase tracking-wider mb-1">Net Price</div>
                                        <div className="text-xl font-mono font-bold text-green-400">
                                            ${buyer.netPrice?.toFixed(2) || '-'}
                                        </div>
                                        <div className="text-xs text-red-400 font-mono mt-1">
                                            Freight: -${buyer.freightCost?.toFixed(2) || '0.00'}
                                        </div>
                                    </div>
                                </div>

                                <div className="flex items-center gap-2 mb-3">
                                    <span className={`inline-flex px-2 py-1 rounded text-xs font-medium capitalize border border-white/5
                                    ${buyer.type === 'ethanol' ? 'bg-green-500/10 text-green-400 border-green-500/20' :
                                            buyer.type === 'feedlot' ? 'bg-amber-500/10 text-amber-400 border-amber-500/20' :
                                                'bg-blue-500/10 text-blue-400 border-blue-500/20'}`}>
                                        {buyer.type}
                                    </span>
                                    <span className="text-xs text-slate-500 px-2 border-l border-white/10">{buyer.region}</span>
                                </div>

                                <div className="flex items-center justify-between pt-3 border-t border-white/5">
                                    <div className="flex gap-2">
                                        {buyer.railAccessible && (
                                            <div className="p-1.5 bg-cyan-500/10 rounded text-cyan-400 border border-cyan-500/20">
                                                <Train size={14} />
                                            </div>
                                        )}
                                        {buyer.nearTransload && (
                                            <div className="p-1.5 bg-purple-500/10 rounded text-purple-400 border border-purple-500/20">
                                                <Truck size={14} />
                                            </div>
                                        )}
                                    </div>
                                    <div className="text-right">
                                        <div className="text-sm text-white">{buyer.contactName}</div>
                                        <div className="text-xs text-slate-500 font-mono">{buyer.contactPhone}</div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>

                {buyers.length === 0 && (
                    <div className="p-8 text-center text-slate-500">
                        Loading buyer data...
                    </div>
                )}
            </div>
        </div>
    );
};
