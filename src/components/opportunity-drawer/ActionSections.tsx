import React from 'react';
import { Globe, Navigation, Phone, Share2 } from 'lucide-react';
import type { Buyer } from '../../types';
import type { BNSFOpportunity } from '../../services/bnsfScraperService';

export const BuyerActionSection: React.FC<{ buyer: Buyer }> = ({ buyer }) => (
    <>
        <div className="h-px bg-zinc-800" />
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4">
            <ActionButton
                icon={<Navigation size={20} />}
                label="Directions"
                active
                onClick={() => {
                    const query = encodeURIComponent(`${buyer.fullAddress || `${buyer.name} ${buyer.city} ${buyer.state}`}`);
                    window.open(`https://www.google.com/maps/search/?api=1&query=${query}`, '_blank');
                }}
            />
            <ActionButton
                icon={<Phone size={20} />}
                label="Call"
                onClick={() => {
                    window.location.href = `tel:${buyer.contactPhone}`;
                }}
                disabled={!buyer.contactPhone}
            />
            <ActionButton
                icon={<Globe size={20} />}
                label="Website"
                onClick={() => {
                    const url = buyer.website?.startsWith('http') ? buyer.website : `https://${buyer.website}`;
                    window.open(url, '_blank');
                }}
                disabled={!buyer.website}
            />
            <ActionButton
                icon={<Share2 size={20} />}
                label="Share"
                onClick={async () => {
                    await navigator.clipboard.writeText(
                        `${buyer.name}: ${buyer.cashPrice !== undefined ? `$${buyer.cashPrice.toFixed(2)}` : 'CALL'} Cash`
                    );
                    alert('Bid info copied to clipboard!');
                }}
            />
        </div>
    </>
);

export const BnsfOpportunityActionSection: React.FC<{ item: BNSFOpportunity }> = ({ item }) => (
    <>
        <div className="h-px bg-zinc-800" />
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4">
            <ActionButton
                icon={<Navigation size={20} />}
                label="Directions"
                active
                onClick={() => {
                    const query = encodeURIComponent(`${item.name} ${item.location.city} ${item.location.state}`);
                    window.open(`https://www.google.com/maps/search/?api=1&query=${query}`, '_blank');
                }}
            />
            <ActionButton
                icon={<Phone size={20} />}
                label="Call"
                onClick={() => {
                    window.location.href = `tel:${item.contactInfo}`;
                }}
                disabled={!item.contactInfo}
            />
            <ActionButton
                icon={<Globe size={20} />}
                label="Website"
                onClick={() => {
                    const url = item.website?.startsWith('http') ? item.website : `https://${item.website}`;
                    window.open(url, '_blank');
                }}
                disabled={!item.website}
            />
            <ActionButton
                icon={<Share2 size={20} />}
                label="Share"
                onClick={async () => {
                    await navigator.clipboard.writeText(`${item.name} (${item.category}): ${item.contactInfo}`);
                    alert('Opportunity info copied to clipboard!');
                }}
            />
        </div>
        <div className="mt-2 text-xs text-zinc-500 font-mono">
            Source: BNSF Firecrawl Scrape / Verified Target
        </div>
    </>
);

const ActionButton = ({
    icon,
    label,
    active = false,
    onClick,
    disabled = false,
}: {
    icon: React.ReactNode;
    label: string;
    active?: boolean;
    onClick: () => void | Promise<void>;
    disabled?: boolean;
}) => (
    <button
        onClick={() => void onClick()}
        disabled={disabled}
        className={`flex flex-col items-center gap-1.5 sm:gap-1 min-w-[70px] sm:min-w-[60px] group ${disabled ? 'opacity-30 cursor-not-allowed' : ''}`}
    >
        <div
            className={`p-3 sm:p-3 rounded-full transition-all duration-300 ${active
                ? 'bg-red-500 text-white shadow-[0_0_15px_rgba(239,68,68,0.5)] scale-110'
                : disabled
                    ? 'bg-zinc-800 text-zinc-600'
                    : 'bg-zinc-800 text-zinc-400 group-hover:bg-zinc-700 group-hover:text-white'
                }`}
        >
            {icon}
        </div>
        <span className={`text-[10px] font-medium tracking-wide text-center ${active ? 'text-red-500' : 'text-zinc-500 group-hover:text-zinc-300'}`}>
            {label}
        </span>
    </button>
);
