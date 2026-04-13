import { useState } from 'react';
import { HeatMapPage } from './pages/HeatMapPage';
import { BuyersPage } from './pages/BuyersPage';
import { SettingsPage } from './pages/SettingsPage';
import { UnderConstructionPage } from './pages/UnderConstructionPage';
import { BottomNav } from './components/BottomNav';
import { CloudHealthCheck } from './components/CloudHealthCheck';
import { CropSelector } from './components/CropSelector';
import { Logo } from './components/Logo';
import { CropType } from './types';

// Toggle this to show/hide the under construction page
const SHOW_UNDER_CONSTRUCTION = false;
const SHOW_DEV_TOOLS = import.meta.env.DEV || import.meta.env.VITE_ENABLE_DEV_TOOLS === 'true';

function App() {
    const [activeTab, setActiveTab] = useState<'map' | 'buyers' | 'settings'>('map');
    const [selectedCrop, setSelectedCrop] = useState<CropType>('Yellow Corn');

    // Developer Mode Bypass Logic
    const [isDevMode] = useState(() => {
        // Check URL parameter: ?dev=true
        const params = new URLSearchParams(window.location.search);
        if (params.get('dev') === 'true') {
            localStorage.setItem('crop_intel_dev_mode', 'true');
            return true;
        }
        // Check localStorage
        return localStorage.getItem('crop_intel_dev_mode') === 'true';
    });

    if (SHOW_UNDER_CONSTRUCTION && !isDevMode) {
        return <UnderConstructionPage />;
    }

    return (
        <div className="w-screen h-screen bg-corn-base overflow-hidden relative">
            {/* Top Bar */}
            <div className="absolute top-0 left-0 right-0 h-16 sm:h-20 bg-gradient-to-b from-black to-transparent z-40 px-4 sm:px-6 flex items-center justify-between pointer-events-none">
                <div className="flex items-center gap-2 pointer-events-auto">
                    <Logo size="md" className="sm:scale-110 origin-left" />
                </div>

                <div className="pointer-events-auto">
                    <CropSelector selectedCrop={selectedCrop} onSelect={setSelectedCrop} />
                </div>
            </div>

            {/* Main Content — keep-alive: all pages stay mounted, visibility mapped to opacity/z-index to preserve WebGL Context */}
            <main className="w-full h-full relative">
                <div className="absolute inset-0 transition-opacity bg-corn-base" style={{ opacity: activeTab === 'map' ? 1 : 0, pointerEvents: activeTab === 'map' ? 'auto' : 'none', zIndex: activeTab === 'map' ? 10 : 0 }}>
                    <HeatMapPage selectedCrop={selectedCrop} isVisible={activeTab === 'map'} />
                </div>
                <div className="absolute inset-0 transition-opacity bg-corn-base" style={{ opacity: activeTab === 'buyers' ? 1 : 0, pointerEvents: activeTab === 'buyers' ? 'auto' : 'none', zIndex: activeTab === 'buyers' ? 10 : 0 }}>
                    <BuyersPage selectedCrop={selectedCrop} />
                </div>
                <div className="absolute inset-0 transition-opacity bg-corn-base" style={{ opacity: activeTab === 'settings' ? 1 : 0, pointerEvents: activeTab === 'settings' ? 'auto' : 'none', zIndex: activeTab === 'settings' ? 10 : 0 }}>
                    <SettingsPage />
                </div>
            </main>

            {/* Bottom Navigation */}
            <BottomNav activeTab={activeTab} onTabChange={setActiveTab} />

            {/* Cloud Integrations Health Check */}
            {SHOW_DEV_TOOLS ? <CloudHealthCheck /> : null}
        </div>
    );
}

export default App;
