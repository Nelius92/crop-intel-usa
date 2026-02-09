import { useState } from 'react';
import { HeatMapPage } from './pages/HeatMapPage';
import { BuyersPage } from './pages/BuyersPage';
import { SettingsPage } from './pages/SettingsPage';
import { UnderConstructionPage } from './pages/UnderConstructionPage';
import { BottomNav } from './components/BottomNav';
import { CloudHealthCheck } from './components/CloudHealthCheck';
import { CropSelector } from './components/CropSelector';
import { Sprout } from 'lucide-react';
import { CropType } from './types';

// Toggle this to show/hide the under construction page
const SHOW_UNDER_CONSTRUCTION = false;

function App() {
    const [activeTab, setActiveTab] = useState<'map' | 'buyers' | 'settings'>('map');
    const [selectedCrop, setSelectedCrop] = useState<CropType>('Yellow Corn');

    // Developer Mode Bypass Logic
    const [isDevMode] = useState(() => {
        // Check URL parameter: ?dev=true
        const params = new URLSearchParams(window.location.search);
        if (params.get('dev') === 'true') {
            localStorage.setItem('corn_intel_dev_mode', 'true');
            return true;
        }
        // Check localStorage
        return localStorage.getItem('corn_intel_dev_mode') === 'true';
    });

    if (SHOW_UNDER_CONSTRUCTION && !isDevMode) {
        return <UnderConstructionPage />;
    }

    return (
        <div className="w-screen h-screen bg-corn-base overflow-hidden relative">
            {/* Top Bar */}
            <div className="absolute top-0 left-0 right-0 h-16 bg-gradient-to-b from-corn-base/90 to-transparent z-40 px-6 flex items-center justify-between pointer-events-none">
                <div className="flex items-center gap-2 pointer-events-auto">
                    <div className="bg-corn-accent/20 p-2 rounded-lg">
                        <Sprout className="text-corn-accent" size={24} />
                    </div>
                    <h1 className="text-2xl font-bold text-white tracking-tight hidden sm:block">
                        Corn<span className="text-corn-accent">Intel</span> USA
                    </h1>
                </div>

                <div className="pointer-events-auto">
                    <CropSelector selectedCrop={selectedCrop} onSelect={setSelectedCrop} />
                </div>
            </div>

            {/* Main Content */}
            <main className="w-full h-full">
                {activeTab === 'map' && <HeatMapPage selectedCrop={selectedCrop} />}
                {activeTab === 'buyers' && <BuyersPage selectedCrop={selectedCrop} />}
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
