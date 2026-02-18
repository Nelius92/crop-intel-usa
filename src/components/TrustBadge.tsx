import React, { useState } from 'react';
import { DataSource, DataConfidence, isDataStale } from '../types';

interface TrustBadgeProps {
    confidence: DataConfidence;
    source: string;
    timestamp: string;
    staleAfterMinutes: number;
    compact?: boolean; // Just the dot, no label
}

function formatTimeAgo(timestamp: string): string {
    const diffMs = Date.now() - new Date(timestamp).getTime();
    const mins = Math.floor(diffMs / 60000);
    if (mins < 1) return 'just now';
    if (mins < 60) return `${mins}m ago`;
    const hours = Math.floor(mins / 60);
    if (hours < 24) return `${hours}h ago`;
    const days = Math.floor(hours / 24);
    return `${days}d ago`;
}

const CONFIDENCE_CONFIG: Record<DataConfidence, { icon: string; color: string; bgColor: string; label: string }> = {
    verified: { icon: '✓', color: 'text-green-400', bgColor: 'bg-green-500/20 border-green-500/30', label: 'Verified' },
    estimated: { icon: '~', color: 'text-yellow-400', bgColor: 'bg-yellow-500/20 border-yellow-500/30', label: 'Estimated' },
    missing: { icon: '?', color: 'text-red-400', bgColor: 'bg-red-500/20 border-red-500/30', label: 'Missing' },
};

export const TrustBadge: React.FC<TrustBadgeProps> = ({
    confidence,
    source,
    timestamp,
    staleAfterMinutes,
    compact = false
}) => {
    const [showTooltip, setShowTooltip] = useState(false);
    const config = CONFIDENCE_CONFIG[confidence];
    const stale = isDataStale({ value: 0, confidence, source, timestamp, staleAfterMinutes });

    return (
        <div
            className="relative inline-flex"
            onMouseEnter={() => setShowTooltip(true)}
            onMouseLeave={() => setShowTooltip(false)}
            onClick={(e) => { e.stopPropagation(); setShowTooltip(!showTooltip); }}
        >
            {compact ? (
                <div className={`w-2 h-2 rounded-full ${stale ? 'bg-amber-500 animate-pulse' : confidence === 'verified' ? 'bg-green-500' : confidence === 'estimated' ? 'bg-yellow-500' : 'bg-red-500'}`} />
            ) : (
                <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-semibold border ${config.bgColor} ${config.color}`}>
                    {config.icon} {config.label}
                </span>
            )}

            {/* Tooltip */}
            {showTooltip && (
                <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 z-[100] w-56 p-2.5 bg-zinc-900 border border-white/10 rounded-lg shadow-2xl text-[11px] space-y-1.5 pointer-events-none">
                    <div className="flex items-center justify-between">
                        <span className={`font-bold ${config.color}`}>{config.icon} {config.label}</span>
                        {stale && <span className="text-amber-400 font-medium">⚠ Stale</span>}
                    </div>
                    <div className="text-zinc-400">
                        <div>Source: <span className="text-zinc-200">{source}</span></div>
                        <div>Updated: <span className="text-zinc-200">{formatTimeAgo(timestamp)}</span></div>
                        <div className="text-zinc-500">Stale after {staleAfterMinutes < 1440 ? `${staleAfterMinutes}m` : `${Math.round(staleAfterMinutes / 60)}h`}</div>
                    </div>
                    <div className="absolute bottom-0 left-1/2 -translate-x-1/2 translate-y-full w-0 h-0 border-l-4 border-r-4 border-t-4 border-transparent border-t-zinc-900" />
                </div>
            )}
        </div>
    );
};

/** Freshness dot — shows green/amber/red based on timestamp staleness */
export const FreshnessDot: React.FC<{ dataSource: DataSource }> = ({ dataSource }) => {
    return (
        <TrustBadge
            confidence={dataSource.confidence}
            source={dataSource.source}
            timestamp={dataSource.timestamp}
            staleAfterMinutes={dataSource.staleAfterMinutes}
            compact
        />
    );
};

/** Inline source label for the Explanation drawer */
export const SourceLabel: React.FC<{ ds: DataSource }> = ({ ds }) => {
    const config = CONFIDENCE_CONFIG[ds.confidence];
    return (
        <span className={`text-[10px] ${config.color} font-medium`}>
            {ds.source} · {config.label} {config.icon}
        </span>
    );
};

export { formatTimeAgo };
