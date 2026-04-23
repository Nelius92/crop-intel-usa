import React from 'react';
import { Buyer, DataSource, PriceProvenance, isDataStale } from '../../types';
import { getCropPriceUnit } from '../../services/bnsfService';
import { marketDataService } from '../../services/marketDataService';
import { SourceLabel, formatTimeAgo } from '../TrustBadge';

export const CalculationBreakdown: React.FC<{ buyer: Buyer }> = ({ buyer }) => {
    const provenance = buyer.provenance!;
    const benchmarkName = marketDataService.getBenchmarkName(buyer.cropType);
    const benchmark = marketDataService.getBenchmark(buyer.cropType);
    const benchmarkNet = (buyer.netPrice ?? 0) - (buyer.benchmarkDiff ?? 0);
    const buyerNet = provenance.futures.value + provenance.basis.value - provenance.freight.value - provenance.fees.value;
    const buyerUnit = getCropPriceUnit(buyer.cropType);

    return (
        <div className="mt-3 p-3 bg-black/40 rounded-xl border border-white/5 space-y-2.5 text-sm font-mono">
            <div className="text-[10px] text-zinc-500 uppercase tracking-widest font-sans font-bold mb-2">
                Origin: Campbell, MN (BNSF Wahpeton Sub)
            </div>

            <CalcRow label="Futures" value={`$${provenance.futures.value.toFixed(2)}`} ds={provenance.futures} />
            <CalcRow
                label="+ Basis"
                value={`${provenance.basis.value >= 0 ? '+' : ''}$${provenance.basis.value.toFixed(2)}`}
                ds={provenance.basis}
            />

            <div className="border-t border-dashed border-zinc-700 my-1" />

            <div className="flex justify-between items-center text-zinc-200">
                <span>= Cash</span>
                <span className="font-bold">{buyer.cashPrice !== undefined ? `$${buyer.cashPrice.toFixed(2)}` : '--'}</span>
            </div>

            <CalcRow
                label="- Freight"
                value={`-$${provenance.freight.value.toFixed(2)}`}
                ds={provenance.freight}
                color="text-red-400"
            />
            <CalcRow label="- Fees" value={`$${provenance.fees.value.toFixed(2)}`} ds={provenance.fees} />

            <div className="border-t border-dashed border-zinc-700 my-1" />

            <div className="flex justify-between items-center">
                <span className="text-zinc-200 font-bold">= Net Price</span>
                <span className="text-red-400 font-bold text-base">${buyerNet.toFixed(2)}</span>
            </div>
            <div className="text-[10px] text-zinc-500 font-sans">
                {'<-'} What you receive at Campbell, MN
            </div>

            {buyer.benchmarkDiff !== undefined && (
                <div className="mt-3 pt-2.5 border-t border-zinc-800">
                    <div className="flex justify-between items-center text-sm">
                        <span className="text-zinc-400 font-sans">vs {benchmarkName} Benchmark</span>
                        <span className={`font-bold ${buyerNet >= benchmarkNet ? 'text-green-400' : 'text-red-400'}`}>
                            {buyerNet >= benchmarkNet ? '+' : ''}
                            {(buyerNet - benchmarkNet).toFixed(2)}
                        </span>
                    </div>
                    <div className="text-[10px] text-zinc-600 font-sans mt-1">
                        {benchmarkName} Net = Cash - ${benchmark.freight.toFixed(2)} farmer delivery = ${benchmarkNet.toFixed(2)}{buyerUnit}
                    </div>
                    <div className="text-[10px] text-zinc-600 font-sans">
                        Delta = ${buyerNet.toFixed(2)} - ${benchmarkNet.toFixed(2)} = {(buyerNet - benchmarkNet).toFixed(2)}{buyerUnit}
                    </div>
                </div>
            )}
        </div>
    );
};

export const DataFreshnessBar: React.FC<{ provenance: PriceProvenance }> = ({ provenance }) => {
    const mostStale = [provenance.futures, provenance.basis, provenance.freight]
        .sort((left, right) => new Date(left.timestamp).getTime() - new Date(right.timestamp).getTime())[0];
    const stale = isDataStale(mostStale);

    return (
        <div
            className={`mt-3 flex items-center gap-2 text-[10px] px-2 py-1.5 rounded-lg border ${stale
                ? 'bg-amber-500/5 border-amber-500/20 text-amber-400'
                : 'bg-green-500/5 border-green-500/20 text-green-500'
                }`}
        >
            <div className={`w-1.5 h-1.5 rounded-full ${stale ? 'bg-amber-500 animate-pulse' : 'bg-green-500'}`} />
            <span>
                {stale ? 'WARN Data may be stale' : 'Data fresh'} · Basis updated {formatTimeAgo(provenance.basis.timestamp)}
                {' '}· Freight: {provenance.freight.source.split('·')[0].trim()}
            </span>
        </div>
    );
};

const CalcRow: React.FC<{
    label: string;
    value: string;
    ds: DataSource;
    color?: string;
}> = ({ label, value, ds, color = 'text-zinc-300' }) => (
    <div className="space-y-0.5">
        <div className="flex justify-between items-center">
            <span className={color}>{label}</span>
            <span className={`${color} font-semibold`}>{value}</span>
        </div>
        <div className="flex justify-end">
            <SourceLabel ds={ds} />
        </div>
    </div>
);
