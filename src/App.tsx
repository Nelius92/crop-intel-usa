import { useState } from 'react';
import { HeatMapPage } from './pages/HeatMapPage';
import { BuyersPage } from './pages/BuyersPage';
import { SettingsPage } from './pages/SettingsPage';
import { UnderConstructionPage } from './pages/UnderConstructionPage';
import { BottomNav } from './components/BottomNav';
import { CloudHealthCheck } from './components/CloudHealthCheck';
import { Sprout } from 'lucide-react';

// Toggle this to show/hide the under construction page
const SHOW_UNDER_CONSTRUCTION = true;

function App() {
    const [activeTab, setActiveTab] = useState<'map' | 'buyers' | 'settings'>('map');

    if (SHOW_UNDER_CONSTRUCTION) {
        return <UnderConstructionPage />;
    }

    return (
        <div className="w-screen h-screen bg-corn-base overflow-hidden relative">
            {/* Top Bar */}
            <div className="absolute top-0 left-0 right-0 h-16 bg-gradient-to-b from-corn-base/90 to-transparent z-40 px-6 flex items-center pointer-events-none">
                <div className="flex items-center gap-2 pointer-events-auto">
                    <div className="bg-corn-accent/20 p-2 rounded-lg">
                        <Sprout className="text-corn-accent" size={24} />
                    </div>
                    <h1 className="text-2xl font-bold text-white tracking-tight">
                        Corn<span className="text-corn-accent">Intel</span> USA
                    </h1>
                </div>
            </div>

            {/* Main Content */}
            <main className="w-full h-full">
                {activeTab === 'map' && <HeatMapPage />}
                {activeTab === 'buyers' && <BuyersPage />}
                {activeTab === 'settings' && <SettingsPage />}
            </main>

            {/* Bottom Navigation */}
            <BottomNav activeTab={activeTab} onTabChange={setActiveTab} />

            {/* Cloud Integrations Health Check */}
            <CloudHealthCheck />
        </div>
    );
}

export default App;
