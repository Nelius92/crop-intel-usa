import React from 'react';
import { Layers, Train, Lightbulb, Map as MapIcon, Wheat, Droplets } from 'lucide-react';

interface MapControlsProps {
    showHeatmap: boolean;
    setShowHeatmap: (v: boolean) => void;
    showRail: boolean;
    setShowRail: (v: boolean) => void;
    showBnsfOpportunities: boolean;
    setShowBnsfOpportunities: (v: boolean) => void;
    showTransloaders: boolean;
    setShowTransloaders: (v: boolean) => void;
    showDrought: boolean;
    setShowDrought: (v: boolean) => void;
}

export const MapControls: React.FC<MapControlsProps> = ({
    showHeatmap, setShowHeatmap,
    showRail, setShowRail,
    showBnsfOpportunities, setShowBnsfOpportunities,
    showTransloaders, setShowTransloaders,
    showDrought, setShowDrought
}) => {
    return (
        <div className="p-4 bg-[#120202]/80 backdrop-blur-xl rounded-2xl border border-white/10 shadow-glass flex flex-col gap-3 w-full sm:w-56 shrink-0 pointer-events-auto">
            <div className="flex items-center gap-2 mb-1">
                <Layers size={18} className="text-corn-accent" />
                <h3 className="text-sm font-bold text-white tracking-wide uppercase">Map Layers</h3>
            </div>

            <label className="flex items-center justify-between group cursor-pointer">
                <div className="flex items-center gap-2 text-sm text-zinc-300 group-hover:text-white transition-colors">
                    <MapIcon size={16} className={showHeatmap ? 'text-green-400' : 'text-zinc-500'} />
                    Price Heatmap
                </div>
                <input
                    type="checkbox"
                    checked={showHeatmap}
                    onChange={(e) => setShowHeatmap(e.target.checked)}
                    className="w-4 h-4 rounded border-zinc-700 bg-zinc-800 text-corn-accent focus:ring-corn-accent/50 focus:ring-offset-0"
                />
            </label>

            <label className="flex items-center justify-between group cursor-pointer">
                <div className="flex items-center gap-2 text-sm text-zinc-300 group-hover:text-white transition-colors">
                    <Droplets size={16} className={showDrought ? 'text-red-400' : 'text-zinc-500'} />
                    Drought Monitor
                </div>
                <input
                    type="checkbox"
                    checked={showDrought}
                    onChange={(e) => setShowDrought(e.target.checked)}
                    className="w-4 h-4 rounded border-zinc-700 bg-zinc-800 text-red-400 focus:ring-red-400/50 focus:ring-offset-0"
                />
            </label>

            <label className="flex items-center justify-between group cursor-pointer">
                <div className="flex items-center gap-2 text-sm text-zinc-300 group-hover:text-white transition-colors">
                    <Wheat size={16} className={showBnsfOpportunities ? 'text-amber-400' : 'text-zinc-500'} />
                    BNSF Opportunities
                </div>
                <input
                    type="checkbox"
                    checked={showBnsfOpportunities}
                    onChange={(e) => setShowBnsfOpportunities(e.target.checked)}
                    className="w-4 h-4 rounded border-zinc-700 bg-zinc-800 text-amber-400 focus:ring-amber-400/50 focus:ring-offset-0"
                />
            </label>

            <label className="flex items-center justify-between group cursor-pointer">
                <div className="flex items-center gap-2 text-sm text-zinc-300 group-hover:text-white transition-colors">
                    <Train size={16} className={showRail ? 'text-orange-400' : 'text-zinc-500'} />
                    BNSF Network Lines
                </div>
                <input
                    type="checkbox"
                    checked={showRail}
                    onChange={(e) => setShowRail(e.target.checked)}
                    className="w-4 h-4 rounded border-zinc-700 bg-zinc-800 text-orange-400 focus:ring-orange-400/50 focus:ring-offset-0"
                />
            </label>

            <label className="flex items-center justify-between group cursor-pointer">
                <div className="flex items-center gap-2 text-sm text-zinc-300 group-hover:text-white transition-colors">
                    <Lightbulb size={16} className={showTransloaders ? 'text-cyan-400' : 'text-zinc-500'} />
                    Transloaders
                </div>
                <input
                    type="checkbox"
                    checked={showTransloaders}
                    onChange={(e) => setShowTransloaders(e.target.checked)}
                    className="w-4 h-4 rounded border-zinc-700 bg-zinc-800 text-cyan-400 focus:ring-cyan-400/50 focus:ring-offset-0"
                />
            </label>
        </div>
    );
};
