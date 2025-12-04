import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Phone, Navigation, MapPin, Star, Share2, User, Train, Clock, Globe } from 'lucide-react';
import { HeatmapPoint, Buyer } from '../types';

interface OpportunityDrawerProps {
    item: HeatmapPoint | Buyer | null;
    onClose: () => void;
}

export const OpportunityDrawer: React.FC<OpportunityDrawerProps> = ({ item, onClose }) => {
    const isBuyer = (item: any): item is Buyer => 'type' in item;

    const [isEditing, setIsEditing] = React.useState(false);
    const [editValues, setEditValues] = React.useState({ cashPrice: 0, basis: 0 });

    React.useEffect(() => {
        if (item && isBuyer(item)) {
            setEditValues({ cashPrice: item.cashPrice, basis: item.basis });
        }
    }, [item]);

    if (!item) return null;

    const handleSaveBid = () => {
        if (!item || !isBuyer(item)) return;

        // Update local storage or state management here
        // For this demo, we'll emit a custom event that the parent or service can listen to,
        // or directly modify the object if it's shared reference (risky but quick for demo).
        // Better: Save to a "manualBids" map in localStorage.

        const manualBids = JSON.parse(localStorage.getItem('manualBids') || '{}');
        manualBids[item.id] = {
            cashPrice: parseFloat(editValues.cashPrice.toString()),
            basis: parseFloat(editValues.basis.toString()),
            timestamp: new Date().toISOString()
        };
        localStorage.setItem('manualBids', JSON.stringify(manualBids));

        // Force reload to reflect changes (simple approach)
        window.location.reload();
    };

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
                    <div className="w-full max-w-2xl bg-zinc-900/95 backdrop-blur-xl border border-white/10 shadow-2xl rounded-3xl overflow-hidden pointer-events-auto max-h-[85vh] flex flex-col ring-1 ring-black/50">

                        {/* Hero Section (Map/Image) */}
                        <div className="relative h-40 bg-zinc-800 shrink-0">
                            <div className="absolute inset-0 bg-gradient-to-t from-zinc-900 via-transparent to-transparent z-10" />
                            {/* Placeholder for map/street view - using a gradient pattern for now if no image */}
                            <div className="w-full h-full bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-slate-700 via-zinc-900 to-black opacity-50" />

                            <button
                                onClick={onClose}
                                className="absolute top-4 right-4 p-2 bg-black/40 hover:bg-black/60 backdrop-blur-md rounded-full text-white transition-colors z-20"
                            >
                                <X size={20} />
                            </button>

                            <div className="absolute bottom-4 left-6 z-20">
                                <h2 className="text-2xl font-bold text-white shadow-black drop-shadow-md">
                                    {isBuyer(item) ? item.name : 'Market Opportunity'}
                                </h2>
                                <div className="flex items-center gap-2 text-zinc-300 text-sm">
                                    {isBuyer(item) ? (
                                        <>
                                            <span className="flex items-center gap-1"><Star size={12} className="text-yellow-400 fill-yellow-400" /> 4.8</span>
                                            <span>•</span>
                                            <span className="capitalize">{item.type}</span>
                                            <span>•</span>
                                            <span>{item.city}, {item.state}</span>
                                        </>
                                    ) : (
                                        <span>{item.regionName || `Grid: ${item.lat.toFixed(2)}, ${item.lng.toFixed(2)}`}</span>
                                    )}
                                </div>
                            </div>
                        </div>

                        {/* Action Buttons */}
                        {isBuyer(item) && (
                            <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-800 shrink-0 overflow-x-auto no-scrollbar gap-4">
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
                                    onClick={async () => {
                                        if (navigator.share) {
                                            try {
                                                await navigator.share({
                                                    title: `Corn Bid: ${item.name}`,
                                                    text: `Check out this bid from ${item.name}: $${item.cashPrice.toFixed(2)} Cash / ${item.basis.toFixed(2)} Basis.`,
                                                    url: window.location.href
                                                });
                                            } catch (err) {
                                                console.log('Error sharing:', err);
                                            }
                                        } else {
                                            navigator.clipboard.writeText(`${item.name}: $${item.cashPrice.toFixed(2)} Cash`);
                                            alert('Bid info copied to clipboard!');
                                        }
                                    }}
                                />
                                <button
                                    onClick={() => setIsEditing(!isEditing)}
                                    className={`flex flex-col items-center gap-1 min-w-[60px] group`}
                                >
                                    <div className={`p-3 rounded-full transition-all duration-300 ${isEditing ? 'bg-yellow-500 text-black' : 'bg-zinc-800 text-zinc-400 group-hover:bg-zinc-700 group-hover:text-white'}`}>
                                        <User size={20} />
                                    </div>
                                    <span className={`text-[10px] font-medium tracking-wide ${isEditing ? 'text-yellow-400' : 'text-zinc-500'}`}>
                                        Edit Bid
                                    </span>
                                </button>
                            </div>
                        )}

                        {/* Edit Mode UI */}
                        {isEditing && isBuyer(item) && (
                            <div className="px-6 py-4 bg-yellow-500/10 border-b border-yellow-500/20">
                                <h3 className="text-yellow-400 text-sm font-bold uppercase mb-3">Manual Bid Override</h3>
                                <div className="grid grid-cols-2 gap-4 mb-4">
                                    <div>
                                        <label className="text-zinc-400 text-xs uppercase block mb-1">Cash Price</label>
                                        <input
                                            type="number"
                                            step="0.01"
                                            value={editValues.cashPrice}
                                            onChange={(e) => setEditValues({ ...editValues, cashPrice: parseFloat(e.target.value) })}
                                            className="w-full bg-black/40 border border-zinc-700 rounded p-2 text-white font-mono"
                                        />
                                    </div>
                                    <div>
                                        <label className="text-zinc-400 text-xs uppercase block mb-1">Basis</label>
                                        <input
                                            type="number"
                                            step="0.01"
                                            value={editValues.basis}
                                            onChange={(e) => setEditValues({ ...editValues, basis: parseFloat(e.target.value) })}
                                            className="w-full bg-black/40 border border-zinc-700 rounded p-2 text-white font-mono"
                                        />
                                    </div>
                                </div>
                                <button
                                    onClick={handleSaveBid}
                                    className="w-full bg-yellow-500 hover:bg-yellow-400 text-black font-bold py-2 rounded transition-colors"
                                >
                                    Save Manual Bid
                                </button>
                            </div>
                        )}

                        {/* Scrollable Content */}
                        <div className="overflow-y-auto p-6 space-y-6 bg-zinc-900">

                            {/* Market Data Grid */}
                            <div>
                                <h3 className="text-sm font-bold text-zinc-500 uppercase tracking-wider mb-3">Live Market Data</h3>
                                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                                    {isBuyer(item) ? (
                                        <>
                                            <DataCard label="Cash Bid" value={`$${item.cashPrice.toFixed(2)}`} highlight />
                                            <DataCard label="Basis" value={`${item.basis > 0 ? '+' : ''}${item.basis.toFixed(2)}`} color={item.basis >= 0 ? 'text-green-400' : 'text-red-400'} />
                                            <DataCard label="Rail" value={item.railAccessible ? 'Yes' : 'No'} icon={<Train size={14} />} />
                                            <DataCard label="Region" value={item.region} />
                                        </>
                                    ) : (
                                        <>
                                            <DataCard label="Price" value={`$${item.cornPrice.toFixed(2)}`} highlight />
                                            <DataCard label="Basis" value={`${item.basis > 0 ? '+' : ''}${item.basis}`} />
                                            <DataCard label="24h Change" value={`${item.change24h > 0 ? '+' : ''}${item.change24h}%`} color={item.change24h > 0 ? 'text-green-400' : 'text-red-400'} />
                                            <DataCard label="Status" value={item.isOpportunity ? 'Hot' : 'Normal'} />
                                        </>
                                    )}
                                </div>
                            </div>

                            {/* Contact & Info Details */}
                            {isBuyer(item) && (
                                <div className="space-y-4">
                                    <h3 className="text-sm font-bold text-zinc-500 uppercase tracking-wider">Location & Contact</h3>

                                    <div className="bg-zinc-800/50 rounded-xl p-4 space-y-4 border border-zinc-800">
                                        <div className="flex items-start gap-3">
                                            <MapPin className="text-zinc-400 mt-1" size={18} />
                                            <div>
                                                <div className="text-zinc-200 font-medium">Address</div>
                                                <div className="text-zinc-500 text-sm">{item.fullAddress || `${item.city}, ${item.state}`}</div>
                                                {item.rating && (
                                                    <div className="flex items-center gap-1 mt-1">
                                                        <Star size={12} className="text-yellow-400 fill-yellow-400" />
                                                        <span className="text-xs text-zinc-300">{item.rating}</span>
                                                        <span className="text-xs text-zinc-500">({item.userRatingsTotal})</span>
                                                    </div>
                                                )}
                                            </div>
                                        </div>

                                        <div className="flex items-center gap-3">
                                            <Clock className="text-zinc-400" size={18} />
                                            <div>
                                                <div className="text-zinc-200 text-sm">Open • Closes 5 PM</div>
                                                <div className="text-zinc-500 text-xs">Mon-Fri: 7:00 AM - 5:00 PM</div>
                                            </div>
                                        </div>

                                        <div className="h-px bg-zinc-700/50 my-2" />

                                        <div className="flex items-center gap-3">
                                            <User className="text-zinc-400" size={18} />
                                            <div>
                                                <div className="text-zinc-200 text-sm">{item.contactName || 'Sales Representative'}</div>
                                                <div className="text-zinc-500 text-xs">Grain Merchandiser</div>
                                            </div>
                                        </div>

                                        <div className="flex items-center gap-3">
                                            <Phone className="text-zinc-400" size={18} />
                                            <div className="text-cyan-400 text-sm hover:underline cursor-pointer">
                                                {item.contactPhone || '(555) 123-4567'}
                                            </div>
                                        </div>
                                    </div>

                                    <div className="h-px bg-zinc-700/50 my-2" />

                                    <div className="bg-zinc-800/50 rounded-xl p-4 border border-zinc-800">
                                        <div className="text-zinc-500 text-xs uppercase tracking-wider mb-1">Futures ({item.contractMonth || 'Spot'})</div>
                                        <div className="text-2xl font-mono text-white font-bold">
                                            {item.futuresPrice ? `$${item.futuresPrice.toFixed(2)}` : '-'}
                                        </div>
                                    </div>
                                    <div className="bg-zinc-800/50 rounded-xl p-4 border border-zinc-800">
                                        <div className="text-zinc-500 text-xs uppercase tracking-wider mb-1">Basis</div>
                                        <div className={`text-2xl font-mono font-bold ${item.basis >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                                            {item.basis > 0 ? '+' : ''}{item.basis.toFixed(2)}
                                        </div>
                                    </div>
                                    <div className="bg-zinc-800/50 rounded-xl p-4 border border-zinc-800">
                                        <div className="text-zinc-500 text-xs uppercase tracking-wider mb-1">Cash Price</div>
                                        <div className="text-2xl font-mono text-white font-bold">
                                            ${item.cashPrice.toFixed(2)}
                                        </div>
                                    </div>
                                    {item.benchmarkDiff !== undefined && (
                                        <div className="bg-zinc-800/50 rounded-xl p-4 border border-zinc-800 col-span-2 sm:col-span-3 flex justify-between items-center">
                                            <span className="text-zinc-400 text-sm">vs Hankinson Renewable Energy</span>
                                            <span className={`text-lg font-mono font-bold ${item.benchmarkDiff > 0 ? 'text-green-400' : item.benchmarkDiff < 0 ? 'text-red-400' : 'text-slate-400'}`}>
                                                {item.benchmarkDiff > 0 ? '+' : ''}{item.benchmarkDiff.toFixed(2)}
                                            </span>
                                        </div>
                                    )}
                                </div>
                            )}

                            {/* About Section */}
                            {isBuyer(item) && (
                                <div>
                                    <h3 className="text-sm font-bold text-zinc-500 uppercase tracking-wider mb-2">About</h3>
                                    <p className="text-zinc-400 text-sm leading-relaxed">
                                        {item.name} is a key {item.type} facility in the {item.region} region.
                                        {item.railAccessible ? " They offer rail access, allowing for competitive bids." : " They primarily rely on truck logistics."}
                                        {item.basis > 0.2 ? " Currently showing strong basis levels indicating high demand." : " Basis levels are standard for this time of year."}
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
