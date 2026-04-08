import React from 'react';

export interface FacilityModalProps {
    facilityName: string;
    distanceMi: number;
    cashBid: number;
    freightCost: number;
    netPrice: number;
    totalBushels?: number;
    onClose?: () => void;
}

export const FacilityModal: React.FC<FacilityModalProps> = ({
    facilityName,
    distanceMi,
    cashBid,
    freightCost,
    netPrice,
    totalBushels,
    onClose
}) => {
    return (
        // Absolute wrapper overlay covering the map. 
        // pointer-events-none allows panning the map underneath.
        <div className="absolute inset-0 z-50 flex items-start justify-end p-6 pointer-events-none">
            
            {/* The Modal Itself. Re-enable pointer events so the modal can be interacted with. */}
            <div className="pointer-events-auto w-80 bg-[#0f172a]/70 backdrop-blur-xl border border-white/10 shadow-[0_8px_32px_0_rgba(0,0,0,0.5)] rounded-2xl overflow-hidden flex flex-col">
                
                {/* Header Section */}
                <div className="p-5 border-b border-white/10 flex justify-between items-start">
                    <div>
                        <h2 className="font-sans text-white text-lg font-semibold tracking-tight">{facilityName}</h2>
                        <span className="font-sans text-slate-400 uppercase tracking-wider text-xs">
                            Est. Distance: <span className="font-mono text-slate-300 normal-case">{distanceMi} mi</span>
                        </span>
                    </div>
                    {onClose && (
                        <button 
                            onClick={onClose}
                            className="text-slate-400 hover:text-white transition-colors"
                            aria-label="Close modal"
                        >
                            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                            </svg>
                        </button>
                    )}
                </div>

                {/* Calculations Section */}
                <div className="p-5 flex flex-col gap-4">
                    {totalBushels && (
                        <div className="flex justify-between items-center">
                            <span className="font-sans text-slate-400 uppercase tracking-wider text-xs">Volume</span>
                            <span className="font-mono text-white text-sm">{totalBushels.toLocaleString()} <span className="text-slate-500 text-xs">bu</span></span>
                        </div>
                    )}

                    <div className="flex justify-between items-center">
                        <span className="font-sans text-slate-400 uppercase tracking-wider text-xs">Cash Bid</span>
                        <span className="font-mono text-slate-200 text-sm">${cashBid.toFixed(4)}</span>
                    </div>

                    <div className="flex justify-between items-center">
                        <span className="font-sans text-slate-400 uppercase tracking-wider text-xs">Frt. Cost (Est)</span>
                        <span className="font-mono text-red-400 text-sm">-${freightCost.toFixed(4)}</span>
                    </div>

                    <div className="h-px bg-white/10 w-full my-1"></div>

                    {/* Net Result (Glowing) */}
                    <div className="flex justify-between items-end">
                        <span className="font-sans text-slate-400 uppercase tracking-wider text-xs pb-1">Net Price</span>
                        <span className="font-mono text-emerald-400 drop-shadow-[0_0_8px_rgba(52,211,153,0.8)] text-3xl font-bold">
                            ${netPrice.toFixed(4)}
                        </span>
                    </div>
                </div>
                
                {/* Action Footer */}
                <div className="p-4 bg-white/5 flex gap-3 border-t border-white/5">
                    <button className="flex-1 rounded-lg bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-400 border border-emerald-500/50 py-2.5 font-sans text-sm font-medium transition-all shadow-[0_0_15px_rgba(52,211,153,0.1)] hover:shadow-[0_0_20px_rgba(52,211,153,0.3)]">
                        Dispatch
                    </button>
                </div>
            </div>
        </div>
    );
};
