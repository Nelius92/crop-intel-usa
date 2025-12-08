import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Phone, Navigation, Share2, Train, Globe } from 'lucide-react';
import { HeatmapPoint, Buyer, Transloader } from '../types';

interface OpportunityDrawerProps {
    item: HeatmapPoint | Buyer | Transloader | null;
    onClose: () => void;
}

export const OpportunityDrawer: React.FC<OpportunityDrawerProps> = ({ item, onClose }) => {
    const isBuyer = (item: any): item is Buyer => 'type' in item && item.type === 'elevator'; // Assuming buyer type is usually elevator/feedlot
    const isTransloader = (item: any): item is Transloader => 'type' in item && item.type === 'transload';

    if (!item) return null;

    return (
        <AnimatePresence>
            {item && (
                <motion.div
                    initial={{ y: '100%' }}
                    animate={{ y: 0 }}
                    exit={{ y: '100%' }}
                    transition={{ type: 'spring', damping: 25, stiffness: 200 }}
                    className="fixed inset-x-0 bottom-0 z-50 flex justify-center pointer-events-none px-4 pb-4"
                >
                    <div className="w-full max-w-lg bg-[#18181b] border border-zinc-800 shadow-2xl rounded-3xl overflow-hidden pointer-events-auto ring-1 ring-white/10">

                        {/* Header Section */}
                        <div className="relative p-6 pb-2">
                            <button
                                onClick={onClose}
                                className="absolute top-4 right-4 p-2 bg-zinc-800 hover:bg-zinc-700 rounded-full text-zinc-400 hover:text-white transition-colors"
                            >
                                <X size={18} />
                            </button>

                            <h2 className="text-2xl font-bold text-white mb-1">
                                {isBuyer(item) || isTransloader(item) ? item.name : 'Market Opportunity'}
                            </h2>
                            <p className="text-zinc-400 text-sm">
                                {isBuyer(item) || isTransloader(item) ? `${item.city}, ${item.state}` : (item.regionName || `Region: ${item.lat.toFixed(2)}, ${item.lng.toFixed(2)}`)}
                            </p>
                        </div>

                        {/* Content Section */}
                        <div className="p-6 pt-4 space-y-6">

                            {/* Live Market Data Section */}
                            <div>
                                <h3 className="text-xs font-bold text-zinc-500 uppercase tracking-wider mb-3">
                                    {isTransloader(item) ? 'Facility Details' : 'Live Market Data'}
                                </h3>
                                <div className="grid grid-cols-2 gap-3">
                                    {isBuyer(item) ? (
                                        <>
                                            <DataCard label="Cash Bid" value={`$${item.cashPrice.toFixed(2)}`} highlight />
                                            <DataCard label="Basis" value={`${item.basis > 0 ? '+' : ''}${item.basis.toFixed(2)}`} color={item.basis >= 0 ? 'text-green-400' : 'text-red-400'} />
                                            <DataCard label="Rail Access" value={item.railAccessible ? 'Yes' : 'No'} icon={<Train size={14} />} />
                                            <DataCard label="Region" value={item.region} />
                                        </>
                                    ) : isTransloader(item) ? (
                                        <>
                                            <DataCard label="Railroad" value={item.railroad?.join(', ') || 'N/A'} icon={<Train size={14} />} highlight />
                                            <DataCard label="Commodities" value={item.commodities?.[0] || 'General'} />
                                            <DataCard label="State" value={item.state || 'N/A'} />
                                            <DataCard label="Type" value="Transload" />
                                        </>
                                    ) : (
                                        <>
                                            <DataCard label="Price" value={`$${item.cornPrice?.toFixed(2) || '0.00'}`} highlight />
                                            <DataCard label="Basis" value={`${(item.basis || 0) > 0 ? '+' : ''}${(item.basis || 0).toFixed(2)}`} />
                                            <DataCard label="24h Change" value={`${(item.change24h || 0) > 0 ? '+' : ''}${item.change24h || 0}%`} color={(item.change24h || 0) > 0 ? 'text-emerald-400' : 'text-red-400'} />
                                            <DataCard label="Status" value={item.isOpportunity ? 'Hot' : 'Normal'} color={item.isOpportunity ? 'text-white' : 'text-zinc-400'} />
                                        </>
                                    )}
                                </div>
                            </div>

                            {/* Buyer Actions (Only for Buyers) */}
                            {isBuyer(item) && (
                                <>
                                    <div className="h-px bg-zinc-800" />
                                    <div className="flex justify-between gap-4">
                                        <ActionButton
                                            icon={<Navigation size={20} />}
                                            label="Directions"
                                            active
                                            onClick={() => {
                                                const query = encodeURIComponent(`${item.fullAddress || item.name + ' ' + item.city + ' ' + item.state}`);
                                                window.open(`https://www.google.com/maps/search/?api=1&query=${query}`, '_blank');
                                            }}
                                        />
                                        <ActionButton
                                            icon={<Phone size={20} />}
                                            label="Call"
                                            onClick={() => window.location.href = `tel:${item.contactPhone}`}
                                            disabled={!item.contactPhone}
                                        />
                                        <ActionButton
                                            icon={<Globe size={20} />}
                                            label="Website"
                                            onClick={() => window.open(item.website, '_blank')}
                                            disabled={!item.website}
                                        />
                                        <ActionButton
                                            icon={<Share2 size={20} />}
                                            label="Share"
                                            onClick={() => {
                                                navigator.clipboard.writeText(`${item.name}: $${item.cashPrice.toFixed(2)} Cash`);
                                                alert('Bid info copied to clipboard!');
                                            }}
                                        />
                                    </div>
                                </>
                            )}

                            {/* Transloader About Section */}
                            {isTransloader(item) && (
                                <div>
                                    <h3 className="text-sm font-bold text-zinc-500 uppercase tracking-wider mb-2">Facility Info</h3>
                                    <p className="text-zinc-400 text-sm leading-relaxed">
                                        {item.name} is a premier transloading facility in {item.city}, {item.state}.
                                        It is served by {item.railroad?.join(' and ') || 'rail'} and specializes in handling {item.commodities?.join(', ') || 'various commodities'}.
                                    </p>
                                </div>
                            )}
                        </div>
                    </div>
                </motion.div>
            )}
        </AnimatePresence>
    );
};

const ActionButton = ({ icon, label, active = false, onClick, disabled = false }: any) => (
    <button
        onClick={onClick}
        disabled={disabled}
        className={`flex flex-col items-center gap-1 min-w-[60px] group ${disabled ? 'opacity-30 cursor-not-allowed' : ''}`}
    >
        <div className={`p-3 rounded-full transition-all duration-300 ${active
            ? 'bg-cyan-500 text-black shadow-[0_0_15px_rgba(6,182,212,0.5)] scale-110'
            : disabled
                ? 'bg-zinc-800 text-zinc-600'
                : 'bg-zinc-800 text-zinc-400 group-hover:bg-zinc-700 group-hover:text-white'
            }`}>
            {icon}
        </div>
        <span className={`text-[10px] font-medium tracking-wide ${active ? 'text-cyan-400' : 'text-zinc-500 group-hover:text-zinc-300'}`}>
            {label}
        </span>
    </button>
);

const DataCard = ({ label, value, icon, color = 'text-white', highlight = false }: any) => (
    <div className={`p-3 rounded-xl border flex flex-col justify-center ${highlight ? 'bg-zinc-800 border-cyan-500/30' : 'bg-zinc-800/50 border-zinc-800'}`}>
        <div className="text-[10px] text-zinc-500 uppercase tracking-wider mb-1">{label}</div>
        <div className={`text-base font-bold ${color} flex items-center gap-1.5`}>
            {icon}
            {value}
        </div>
    </div>
);
