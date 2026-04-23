import React from 'react';
import { Clock, Train, User } from 'lucide-react';
import type { Buyer } from '../../types';
import { getCropPriceUnit } from '../../services/bnsfService';
import { DataFreshnessBar } from './TrustSections';
import { type DrawerItem, isBnsfOpportunity, isBuyer, isTransloader } from './typeGuards';

export const MarketDataSection: React.FC<{ item: DrawerItem }> = ({ item }) => {
    if (!item) {
        return null;
    }

    return (
        <div>
            <h3 className="text-xs font-bold text-zinc-500 uppercase tracking-wider mb-3">
                {isTransloader(item) ? 'Facility Details' : 'Live Market Data'}
            </h3>
            <div className="grid grid-cols-2 gap-2 sm:gap-3">
                {isBuyer(item) ? (
                    <BuyerMarketCards item={item} />
                ) : isTransloader(item) ? (
                    <>
                        <DataCard label="Railroad" value={item.railroad?.join(', ') || 'N/A'} icon={<Train size={14} />} highlight />
                        <DataCard label="Commodities" value={item.commodities?.[0] || 'General'} />
                        <DataCard label="State" value={item.state || 'N/A'} />
                        <DataCard label="Type" value="Transload" />
                    </>
                ) : isBnsfOpportunity(item) ? (
                    <>
                        <DataCard
                            label="Live Rail Bid"
                            value={`$${item.currentPrice?.toFixed(2) || item.livePriceBase.toFixed(2)}`}
                            color="text-red-400"
                            highlight
                        />
                        <DataCard
                            label="Est. Freight"
                            value={`-$${item.freightRateOverride.toFixed(2)}`}
                            color="text-red-400"
                            icon={<Train size={14} />}
                        />
                        <DataCard label="Facility Type" value={(item.category || '').replace('_', ' ').toUpperCase()} />
                        <DataCard label="Capacity" value={item.capacity || 'Unknown'} />
                        {item.managerName ? <DataCard label="Manager" value={item.managerName} icon={<User size={14} />} /> : null}
                        {item.operatingHours ? <DataCard label="Hours" value={item.operatingHours} icon={<Clock size={14} />} /> : null}
                    </>
                ) : (
                    <>
                        <DataCard label="Price" value={`$${item.cornPrice?.toFixed(2) || '0.00'}`} highlight />
                        <DataCard label="Basis" value={`${(item.basis || 0) > 0 ? '+' : ''}${(item.basis || 0).toFixed(2)}`} />
                        <DataCard
                            label="24h Change"
                            value={`${(item.change24h || 0) > 0 ? '+' : ''}${item.change24h || 0}%`}
                            color={(item.change24h || 0) > 0 ? 'text-green-400' : 'text-red-400'}
                        />
                        <DataCard label="Status" value={item.isOpportunity ? 'Hot' : 'Normal'} color={item.isOpportunity ? 'text-white' : 'text-zinc-400'} />
                    </>
                )}
            </div>

            {isBuyer(item) && item.provenance ? <DataFreshnessBar provenance={item.provenance} /> : null}
        </div>
    );
};

const BuyerMarketCards: React.FC<{ item: Buyer }> = ({ item }) => {
    const unit = getCropPriceUnit(item.cropType);
    const railLevel = item.railServedConfidence || (item.railAccessible ? 'likely' : 'unverified');
    const railLabel = railLevel === 'confirmed'
        ? 'BNSF Confirmed'
        : railLevel === 'likely'
            ? 'Likely Rail Access'
            : railLevel === 'possible'
                ? 'Possible Rail Access'
                : 'Unverified Rail Access';
    const railColor = railLevel === 'confirmed'
        ? 'text-cyan-400'
        : railLevel === 'likely'
            ? 'text-sky-400'
            : railLevel === 'possible'
                ? 'text-amber-400'
                : 'text-slate-500';

    return (
        <>
            <DataCard label={`Net Price (${unit})`} value={`$${item.netPrice?.toFixed(2) || '-'}`} color="text-red-400" highlight />
            <DataCard label={`Cash Bid (${unit})`} value={item.cashPrice !== undefined ? `$${item.cashPrice.toFixed(2)}` : 'CALL'} />
            {item.basis !== undefined ? (
                <DataCard
                    label={`Basis (${unit})`}
                    value={`${item.basis > 0 ? '+' : ''}${item.basis.toFixed(2)}`}
                    color={item.basis >= 0 ? 'text-green-400' : 'text-red-400'}
                />
            ) : (
                <DataCard label="Basis" value="NO BID" />
            )}
            <DataCard
                label={`Freight (${item.freightMode === 'rail' ? 'Rail' : 'Truck'}) ${unit}`}
                value={`-$${Math.abs(item.freightCost ?? 0).toFixed(2)}`}
                color="text-red-400"
            />
            <DataCard label="Rail Access" value={railLabel} color={railColor} icon={<Train size={14} />} />
            {item.benchmarkDiff !== undefined ? (
                <DataCard
                    label="vs Benchmark"
                    value={isNaN(item.benchmarkDiff) ? 'N/A' : `${item.benchmarkDiff >= 0 ? '+' : ''}${item.benchmarkDiff.toFixed(2)}`}
                    color={isNaN(item.benchmarkDiff) ? 'text-slate-500' : item.benchmarkDiff >= 0 ? 'text-green-400' : 'text-red-400'}
                />
            ) : (
                <DataCard label="Region" value={item.region} />
            )}
        </>
    );
};

const DataCard = ({
    label,
    value,
    icon,
    color = 'text-white',
    highlight = false,
}: {
    label: string;
    value: string;
    icon?: React.ReactNode;
    color?: string;
    highlight?: boolean;
}) => (
    <div className={`p-3 rounded-xl border flex flex-col justify-center ${highlight ? 'bg-zinc-800 border-red-500/30' : 'bg-zinc-800/50 border-zinc-800'}`}>
        <div className="text-[10px] text-zinc-500 uppercase tracking-wider mb-1">{label}</div>
        <div className={`text-base font-bold ${color} flex items-center gap-1.5`}>
            {icon}
            {value}
        </div>
    </div>
);
