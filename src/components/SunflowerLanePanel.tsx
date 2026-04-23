/**
 * SunflowerLanePanel — Crop Intel
 * ================================
 * Map overlay panel showing Best Lanes from Campbell, MN for
 * sunflower oilseed and confection. Includes:
 * - Lane ranking by NDV
 * - Interline indicator badges
 * - Tracking bridge status
 * - One-click "Lock Premium" automated offer (Bushel model)
 */

import React, { useState, useEffect, useCallback } from 'react';
import {
    SUNFLOWER_LANES,
    SunflowerLane,
    generateAutomatedOffer,
    getTrackingBridge,
    AutomatedOffer,
    SunflowerCategory,
} from '../data/sunflowerLanes';

// ── Styles ──────────────────────────────────────────────────────
const styles: Record<string, React.CSSProperties> = {
    panel: {
        position: 'absolute',
        top: 16,
        right: 16,
        width: 380,
        maxHeight: 'calc(100vh - 100px)',
        overflowY: 'auto',
        background: 'linear-gradient(145deg, rgba(15,23,42,0.95), rgba(30,41,59,0.92))',
        backdropFilter: 'blur(20px)',
        borderRadius: 16,
        border: '1px solid rgba(148,163,184,0.15)',
        boxShadow: '0 25px 60px rgba(0,0,0,0.4)',
        color: '#e2e8f0',
        fontFamily: "'Inter', system-ui, sans-serif",
        zIndex: 1000,
    },
    header: {
        padding: '16px 20px 12px',
        borderBottom: '1px solid rgba(148,163,184,0.1)',
    },
    title: {
        fontSize: 16,
        fontWeight: 700,
        margin: 0,
        background: 'linear-gradient(135deg, #22d3ee, #a78bfa)',
        WebkitBackgroundClip: 'text',
        WebkitTextFillColor: 'transparent',
    },
    subtitle: {
        fontSize: 11,
        color: '#94a3b8',
        marginTop: 2,
    },
    tabs: {
        display: 'flex',
        gap: 4,
        padding: '8px 20px',
        borderBottom: '1px solid rgba(148,163,184,0.08)',
    },
    tab: {
        flex: 1,
        padding: '6px 0',
        fontSize: 11,
        fontWeight: 600,
        textAlign: 'center' as const,
        borderRadius: 8,
        cursor: 'pointer',
        border: 'none',
        transition: 'all 0.2s',
    },
    tabActive: {
        background: 'rgba(139,92,246,0.2)',
        color: '#a78bfa',
    },
    tabInactive: {
        background: 'transparent',
        color: '#64748b',
    },
    laneCard: {
        margin: '8px 12px',
        padding: '14px 16px',
        borderRadius: 12,
        border: '1px solid rgba(148,163,184,0.1)',
        background: 'rgba(30,41,59,0.5)',
        transition: 'all 0.2s',
        cursor: 'pointer',
    },
    laneHeader: {
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: 8,
    },
    buyerName: {
        fontSize: 14,
        fontWeight: 700,
    },
    badge: {
        fontSize: 9,
        fontWeight: 700,
        padding: '2px 8px',
        borderRadius: 20,
        textTransform: 'uppercase' as const,
        letterSpacing: '0.5px',
    },
    statsGrid: {
        display: 'grid',
        gridTemplateColumns: '1fr 1fr 1fr',
        gap: 8,
        marginBottom: 10,
    },
    stat: {
        textAlign: 'center' as const,
    },
    statValue: {
        fontSize: 16,
        fontWeight: 800,
        display: 'block',
    },
    statLabel: {
        fontSize: 9,
        color: '#94a3b8',
        textTransform: 'uppercase' as const,
        letterSpacing: '0.5px',
    },
    trackingBar: {
        display: 'flex',
        gap: 2,
        marginBottom: 10,
    },
    trackingSegment: {
        flex: 1,
        height: 4,
        borderRadius: 2,
    },
    offerButton: {
        width: '100%',
        padding: '10px 0',
        border: 'none',
        borderRadius: 10,
        fontSize: 12,
        fontWeight: 700,
        cursor: 'pointer',
        transition: 'all 0.2s',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 6,
    },
    countdown: {
        fontSize: 10,
        color: '#f97316',
        textAlign: 'center' as const,
        marginTop: 4,
    },
};

// ── Signal Colors ───────────────────────────────────────────────
const SIGNAL_STYLES: Record<string, { bg: string; text: string; label: string }> = {
    'strong-sell': { bg: 'rgba(34,197,94,0.15)', text: '#22c55e', label: '🟢 STRONG SELL' },
    'sell': { bg: 'rgba(59,130,246,0.15)', text: '#3b82f6', label: '🔵 SELL' },
    'hold': { bg: 'rgba(245,158,11,0.15)', text: '#f59e0b', label: '🟡 HOLD' },
    'weak': { bg: 'rgba(239,68,68,0.15)', text: '#ef4444', label: '🔴 WEAK' },
};

// ── CountdownTimer ──────────────────────────────────────────────
const CountdownTimer: React.FC<{ expiresAt: string; onExpire: () => void }> = ({ expiresAt, onExpire }) => {
    const [seconds, setSeconds] = useState(60);

    useEffect(() => {
        const interval = setInterval(() => {
            const remaining = Math.max(0, Math.floor((new Date(expiresAt).getTime() - Date.now()) / 1000));
            setSeconds(remaining);
            if (remaining <= 0) {
                clearInterval(interval);
                onExpire();
            }
        }, 1000);
        return () => clearInterval(interval);
    }, [expiresAt, onExpire]);

    const color = seconds > 30 ? '#22c55e' : seconds > 10 ? '#f59e0b' : '#ef4444';
    return (
        <div style={{ ...styles.countdown, color }}>
            ⏱ Offer expires in {seconds}s
        </div>
    );
};

// ── TrackingBridge Display ──────────────────────────────────────
const TrackingBridge: React.FC<{ lane: SunflowerLane }> = ({ lane }) => {
    const bridge = getTrackingBridge(lane);
    if (!bridge) return null;

    return (
        <div style={{ marginBottom: 10 }}>
            <div style={{ fontSize: 9, color: '#94a3b8', marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                Tracking Coverage
            </div>
            <div style={styles.trackingBar}>
                {bridge.segments.map((seg, i) => (
                    <div
                        key={i}
                        style={{
                            ...styles.trackingSegment,
                            background: seg.status === 'full-visibility'
                                ? '#22c55e'
                                : seg.status === 'partial-visibility'
                                    ? '#f59e0b'
                                    : '#ef4444',
                            flex: seg.estimatedHours,
                        }}
                        title={`${seg.carrier}: ${seg.status} (${seg.estimatedHours}h)`}
                    />
                ))}
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 9, color: '#64748b' }}>
                {bridge.segments.map((seg, i) => (
                    <span key={i}>{seg.carrier} ({seg.estimatedHours}h)</span>
                ))}
            </div>
            {bridge.visibilityGap.exists && (
                <div style={{
                    marginTop: 6,
                    padding: '6px 8px',
                    borderRadius: 6,
                    background: 'rgba(245,158,11,0.08)',
                    border: '1px solid rgba(245,158,11,0.2)',
                    fontSize: 9,
                    color: '#fbbf24',
                    lineHeight: 1.4,
                }}>
                    ⚠️ {bridge.visibilityGap.mitigation}
                </div>
            )}
        </div>
    );
};

// ── LaneCard ────────────────────────────────────────────────────
const LaneCard: React.FC<{
    lane: SunflowerLane;
    isExpanded: boolean;
    onToggle: () => void;
    onOfferGenerate: (offer: AutomatedOffer) => void;
}> = ({ lane, isExpanded, onToggle, onOfferGenerate }) => {
    const [offer, setOffer] = useState<AutomatedOffer | null>(null);
    const [locked, setLocked] = useState(false);
    const sig = SIGNAL_STYLES[lane.signal];

    const handleLockIn = useCallback(() => {
        const newOffer = generateAutomatedOffer(lane, 'cash', 1);
        setOffer(newOffer);
        onOfferGenerate(newOffer);
    }, [lane, onOfferGenerate]);

    const handleConfirm = useCallback(() => {
        setLocked(true);
    }, []);

    const handleExpire = useCallback(() => {
        setOffer(null);
    }, []);

    return (
        <div
            style={{
                ...styles.laneCard,
                borderColor: isExpanded ? `${lane.color}44` : 'rgba(148,163,184,0.1)',
                boxShadow: isExpanded ? `0 0 20px ${lane.color}15` : 'none',
            }}
            onClick={onToggle}
        >
            {/* Header */}
            <div style={styles.laneHeader}>
                <div>
                    <span style={{ ...styles.buyerName, color: lane.color }}>
                        {lane.category === 'confection' ? '🌻' : '🛢️'} {lane.buyer}
                    </span>
                    <span style={{ fontSize: 11, color: '#94a3b8', marginLeft: 6 }}>
                        {lane.destination.city}, {lane.destination.state}
                    </span>
                </div>
                <span style={{
                    ...styles.badge,
                    background: lane.interline === 1 ? 'rgba(245,158,11,0.15)' : 'rgba(34,197,94,0.15)',
                    color: lane.interline === 1 ? '#f59e0b' : '#22c55e',
                }}>
                    {lane.interline === 1 ? `I=1 ${lane.interlineCarrier}` : 'I=0 BNSF'}
                </span>
            </div>

            {/* Stats */}
            <div style={styles.statsGrid}>
                <div style={styles.stat}>
                    <span style={{ ...styles.statValue, color: '#22d3ee' }}>${lane.bidCwt}</span>
                    <span style={styles.statLabel}>Bid/CWT</span>
                </div>
                <div style={styles.stat}>
                    <span style={{ ...styles.statValue, color: lane.color }}>${lane.ndvCwt}</span>
                    <span style={styles.statLabel}>NDV/CWT</span>
                </div>
                <div style={styles.stat}>
                    <span style={{ ...styles.statValue, color: sig.text }}>{sig.label}</span>
                    <span style={styles.statLabel}>Signal</span>
                </div>
            </div>

            {/* Expanded content */}
            {isExpanded && (
                <div onClick={e => e.stopPropagation()}>
                    {/* Freight breakdown */}
                    <div style={{
                        display: 'grid',
                        gridTemplateColumns: '1fr 1fr',
                        gap: 8,
                        marginBottom: 10,
                        padding: '8px 10px',
                        borderRadius: 8,
                        background: 'rgba(15,23,42,0.5)',
                    }}>
                        <div>
                            <span style={{ fontSize: 9, color: '#64748b' }}>Freight/CWT</span>
                            <span style={{ display: 'block', fontSize: 13, fontWeight: 700 }}>
                                ${lane.freightCwt}
                            </span>
                        </div>
                        <div>
                            <span style={{ fontSize: 9, color: '#64748b' }}>Freight % of Bid</span>
                            <span style={{ display: 'block', fontSize: 13, fontWeight: 700 }}>
                                {lane.freightPctOfBid}%
                            </span>
                        </div>
                        <div>
                            <span style={{ fontSize: 9, color: '#64748b' }}>NDV/Car</span>
                            <span style={{ display: 'block', fontSize: 13, fontWeight: 700, color: '#22d3ee' }}>
                                ${lane.ndvPerCar.toLocaleString()}
                            </span>
                        </div>
                        <div>
                            <span style={{ fontSize: 9, color: '#64748b' }}>Futures Anchor</span>
                            <span style={{ display: 'block', fontSize: 13, fontWeight: 700 }}>
                                {lane.futuresAnchor.symbol} {lane.futuresAnchor.price}{lane.futuresAnchor.unit}
                            </span>
                        </div>
                    </div>

                    {/* Tracking bridge */}
                    <TrackingBridge lane={lane} />

                    {/* Automated Offer Button */}
                    {!offer && !locked && (
                        <button
                            style={{
                                ...styles.offerButton,
                                background: lane.signal === 'strong-sell'
                                    ? 'linear-gradient(135deg, #22c55e, #16a34a)'
                                    : lane.signal === 'sell'
                                        ? 'linear-gradient(135deg, #3b82f6, #2563eb)'
                                        : 'linear-gradient(135deg, #64748b, #475569)',
                                color: '#fff',
                            }}
                            onClick={handleLockIn}
                        >
                            ⚡ Lock Premium — ${lane.ndvCwt}/cwt
                        </button>
                    )}

                    {/* Active Offer Countdown */}
                    {offer && !locked && (
                        <div>
                            <div style={{
                                padding: '10px 12px',
                                borderRadius: 10,
                                background: 'rgba(34,197,94,0.08)',
                                border: '1px solid rgba(34,197,94,0.3)',
                                marginBottom: 6,
                            }}>
                                <div style={{ fontSize: 10, color: '#94a3b8', marginBottom: 4 }}>
                                    AUTOMATED OFFER — {offer.contractType.toUpperCase()}
                                </div>
                                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                                    <span style={{ fontSize: 12 }}>Quantity</span>
                                    <span style={{ fontSize: 12, fontWeight: 700 }}>
                                        {offer.quantityCwt.toLocaleString()} CWT (1 car)
                                    </span>
                                </div>
                                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                                    <span style={{ fontSize: 12 }}>Contract Value</span>
                                    <span style={{ fontSize: 12, fontWeight: 700, color: '#22c55e' }}>
                                        ${offer.totalContractValue.toLocaleString()}
                                    </span>
                                </div>
                                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                                    <span style={{ fontSize: 12 }}>Delivery</span>
                                    <span style={{ fontSize: 12 }}>{offer.deliveryWindow}</span>
                                </div>
                            </div>
                            <button
                                style={{
                                    ...styles.offerButton,
                                    background: 'linear-gradient(135deg, #22c55e, #16a34a)',
                                    color: '#fff',
                                    animation: 'pulse 1.5s infinite',
                                }}
                                onClick={handleConfirm}
                            >
                                ✅ CONFIRM — Lock ${ offer.priceCwt}/cwt
                            </button>
                            <CountdownTimer expiresAt={offer.expiresAt} onExpire={handleExpire} />
                        </div>
                    )}

                    {/* Locked confirmation */}
                    {locked && (
                        <div style={{
                            padding: '12px',
                            borderRadius: 10,
                            background: 'rgba(34,197,94,0.1)',
                            border: '1px solid rgba(34,197,94,0.3)',
                            textAlign: 'center',
                        }}>
                            <div style={{ fontSize: 20, marginBottom: 4 }}>✅</div>
                            <div style={{ fontSize: 13, fontWeight: 700, color: '#22c55e' }}>Premium Locked</div>
                            <div style={{ fontSize: 10, color: '#94a3b8' }}>
                                Contract #{offer?.laneId.slice(-8)} · {offer?.deliveryWindow}
                            </div>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
};

// ── Main Panel ──────────────────────────────────────────────────
export const SunflowerLanePanel: React.FC<{
    onLaneSelect?: (lane: SunflowerLane) => void;
    onOfferGenerate?: (offer: AutomatedOffer) => void;
}> = ({ onLaneSelect, onOfferGenerate }) => {
    const [activeTab, setActiveTab] = useState<SunflowerCategory>('oilseed');
    const [expandedLane, setExpandedLane] = useState<string | null>(null);

    const filteredLanes = SUNFLOWER_LANES
        .filter(l => l.category === activeTab)
        .sort((a, b) => b.ndvCwt - a.ndvCwt);

    const bestNdv = filteredLanes[0]?.ndvCwt || 0;

    return (
        <div style={styles.panel}>
            {/* Header */}
            <div style={styles.header}>
                <h3 style={styles.title}>🌻 Sunflower Best Lanes</h3>
                <div style={styles.subtitle}>
                    From Campbell, MN · Ranked by Net Delivered Value
                </div>
            </div>

            {/* Category Tabs */}
            <div style={styles.tabs}>
                {(['oilseed', 'confection'] as SunflowerCategory[]).map(cat => (
                    <button
                        key={cat}
                        style={{
                            ...styles.tab,
                            ...(activeTab === cat ? styles.tabActive : styles.tabInactive),
                        }}
                        onClick={() => setActiveTab(cat)}
                    >
                        {cat === 'oilseed' ? '🛢️ High Oleic' : '🌻 Confection'}
                    </button>
                ))}
            </div>

            {/* Best NDV banner */}
            <div style={{
                margin: '8px 12px 0',
                padding: '10px 14px',
                borderRadius: 10,
                background: 'linear-gradient(135deg, rgba(34,211,238,0.08), rgba(167,139,250,0.08))',
                border: '1px solid rgba(34,211,238,0.15)',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
            }}>
                <div>
                    <div style={{ fontSize: 9, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                        Best {activeTab} NDV
                    </div>
                    <div style={{ fontSize: 22, fontWeight: 800, color: '#22d3ee' }}>
                        ${bestNdv.toFixed(2)}<span style={{ fontSize: 12, color: '#94a3b8' }}>/cwt</span>
                    </div>
                </div>
                <div style={{ textAlign: 'right' }}>
                    <div style={{ fontSize: 9, color: '#94a3b8' }}>Futures Anchor</div>
                    <div style={{ fontSize: 13, fontWeight: 600 }}>
                        ZL {filteredLanes[0]?.futuresAnchor.price}¢
                    </div>
                </div>
            </div>

            {/* Lane Cards */}
            {filteredLanes.map(lane => (
                <LaneCard
                    key={lane.id}
                    lane={lane}
                    isExpanded={expandedLane === lane.id}
                    onToggle={() => {
                        setExpandedLane(expandedLane === lane.id ? null : lane.id);
                        onLaneSelect?.(lane);
                    }}
                    onOfferGenerate={(offer) => onOfferGenerate?.(offer)}
                />
            ))}

            {/* Footer */}
            <div style={{
                padding: '10px 20px 14px',
                borderTop: '1px solid rgba(148,163,184,0.08)',
                fontSize: 9,
                color: '#475569',
                textAlign: 'center',
            }}>
                Crop Intel · Sunflower Lane Engine · Updated {new Date().toLocaleTimeString()}
            </div>
        </div>
    );
};

export default SunflowerLanePanel;
