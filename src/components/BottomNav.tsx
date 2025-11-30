import React from 'react';
import { Map, Users, Settings } from 'lucide-react';

interface BottomNavProps {
    activeTab: 'map' | 'buyers' | 'settings';
    onTabChange: (tab: 'map' | 'buyers' | 'settings') => void;
}

export const BottomNav: React.FC<BottomNavProps> = ({ activeTab, onTabChange }) => {
    return (
        <div className="absolute bottom-6 left-1/2 -translate-x-1/2 bg-corn-surface/90 backdrop-blur-md border border-slate-700 rounded-full px-6 py-3 shadow-xl z-40 flex items-center gap-8">
            <NavButton
                icon={<Map size={20} />}
                label="Heat Map"
                active={activeTab === 'map'}
                onClick={() => onTabChange('map')}
            />
            <NavButton
                icon={<Users size={20} />}
                label="Buyers"
                active={activeTab === 'buyers'}
                onClick={() => onTabChange('buyers')}
            />
            <NavButton
                icon={<Settings size={20} />}
                label="Settings"
                active={activeTab === 'settings'}
                onClick={() => onTabChange('settings')}
            />
        </div>
    );
};

const NavButton = ({ icon, label, active, onClick }: any) => (
    <button
        onClick={onClick}
        className={`flex flex-col items-center gap-1 transition-colors ${active ? 'text-corn-accent' : 'text-slate-400 hover:text-slate-200'}`}
    >
        {icon}
        <span className="text-[10px] font-medium uppercase tracking-wider">{label}</span>
    </button>
);
