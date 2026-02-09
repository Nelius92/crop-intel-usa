
import React from 'react';
import { Save, RotateCcw } from 'lucide-react';

export const SettingsPage: React.FC = () => {
    const [origin, setOrigin] = React.useState({
        city: 'Campbell',
        state: 'MN',
        zip: '56522'
    });

    React.useEffect(() => {
        const savedOrigin = localStorage.getItem('farmOrigin');
        if (savedOrigin) {
            setOrigin(JSON.parse(savedOrigin));
        }
    }, []);

    const handleSave = () => {
        localStorage.setItem('farmOrigin', JSON.stringify(origin));
        // Force reload to update services (simple way for now)
        window.location.reload();
    };

    return (
        <div className="w-full h-full bg-corn-base p-4 sm:p-8 pt-20 sm:pt-24 overflow-y-auto pb-32">
            <div className="max-w-md mx-auto">
                <h2 className="text-2xl sm:text-3xl font-bold text-white mb-6 sm:mb-8">Settings</h2>

                <div className="space-y-4 sm:space-y-6">
                    <div className="bg-corn-surface p-4 sm:p-6 rounded-xl border border-slate-700">
                        <label className="block text-sm font-medium text-slate-400 mb-2">Mapbox API Key</label>
                        <input
                            type="text"
                            value="MAPBOX_TOKEN_REMOVED"
                            disabled
                            className="w-full bg-slate-900 border border-slate-700 rounded-lg px-4 py-3 text-slate-300 font-mono text-sm opacity-50 cursor-not-allowed"
                        />
                        <p className="text-xs text-slate-500 mt-2">API key is managed by system administrator.</p>
                    </div>

                    <div className="bg-corn-surface p-4 sm:p-6 rounded-xl border border-slate-700">
                        <h3 className="text-lg font-semibold text-white mb-4">Farm Origin</h3>
                        <p className="text-sm text-slate-400 mb-4">Set your farm location to calculate accurate freight costs.</p>

                        <div className="space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-slate-400 mb-1">City</label>
                                <input
                                    type="text"
                                    value={origin.city}
                                    onChange={(e) => setOrigin({ ...origin, city: e.target.value })}
                                    placeholder="e.g. Campbell"
                                    className="w-full bg-slate-900 border border-slate-700 rounded-lg px-4 py-3 text-white focus:outline-none focus:border-corn-accent"
                                />
                            </div>
                            <div className="grid grid-cols-2 gap-3 sm:gap-4">
                                <div>
                                    <label className="block text-sm font-medium text-slate-400 mb-1">State</label>
                                    <input
                                        type="text"
                                        value={origin.state}
                                        onChange={(e) => setOrigin({ ...origin, state: e.target.value })}
                                        placeholder="e.g. MN"
                                        className="w-full bg-slate-900 border border-slate-700 rounded-lg px-4 py-3 text-white focus:outline-none focus:border-corn-accent"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-slate-400 mb-1">Zip</label>
                                    <input
                                        type="text"
                                        value={origin.zip}
                                        onChange={(e) => setOrigin({ ...origin, zip: e.target.value })}
                                        placeholder="e.g. 56522"
                                        className="w-full bg-slate-900 border border-slate-700 rounded-lg px-4 py-3 text-white focus:outline-none focus:border-corn-accent"
                                    />
                                </div>
                            </div>
                        </div>
                    </div>

                    <div className="bg-corn-surface p-4 sm:p-6 rounded-xl border border-slate-700">
                        <h3 className="text-lg font-semibold text-white mb-4">Preferences</h3>

                        <div className="flex items-center justify-between mb-4">
                            <span className="text-slate-300">Enable Animations</span>
                            <div className="w-12 h-6 bg-corn-accent rounded-full relative cursor-pointer">
                                <div className="absolute right-1 top-1 w-4 h-4 bg-white rounded-full shadow-sm" />
                            </div>
                        </div>

                        <div className="flex items-center justify-between">
                            <span className="text-slate-300">High Contrast Mode</span>
                            <div className="w-12 h-6 bg-slate-700 rounded-full relative cursor-pointer">
                                <div className="absolute left-1 top-1 w-4 h-4 bg-slate-400 rounded-full shadow-sm" />
                            </div>
                        </div>
                    </div>

                    <div className="flex flex-col sm:flex-row gap-3 sm:gap-4">
                        <button
                            onClick={handleSave}
                            className="flex-1 bg-corn-accent hover:bg-cyan-400 text-corn-base font-bold py-3.5 px-4 rounded-lg flex items-center justify-center gap-2 transition-colors min-h-[50px]"
                        >
                            <Save size={18} />
                            Save Changes
                        </button>
                        <button className="flex-1 bg-slate-700 hover:bg-slate-600 text-white font-bold py-3.5 px-4 rounded-lg flex items-center justify-center gap-2 transition-colors min-h-[50px]">
                            <RotateCcw size={18} />
                            Reset Data
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};
