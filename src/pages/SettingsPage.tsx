import React from 'react';
import { Save, RotateCcw } from 'lucide-react';

export const SettingsPage: React.FC = () => {
    return (
        <div className="w-full h-full bg-corn-base p-8 pt-24">
            <div className="max-w-md mx-auto">
                <h2 className="text-3xl font-bold text-white mb-8">Settings</h2>

                <div className="space-y-6">
                    <div className="bg-corn-surface p-6 rounded-xl border border-slate-700">
                        <label className="block text-sm font-medium text-slate-400 mb-2">Mapbox API Key</label>
                        <input
                            type="text"
                            value="MAPBOX_TOKEN_REMOVED"
                            disabled
                            className="w-full bg-slate-900 border border-slate-700 rounded-lg px-4 py-2 text-slate-300 font-mono text-sm opacity-50 cursor-not-allowed"
                        />
                        <p className="text-xs text-slate-500 mt-2">API key is managed by system administrator.</p>
                    </div>

                    <div className="bg-corn-surface p-6 rounded-xl border border-slate-700">
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

                    <div className="flex gap-4">
                        <button className="flex-1 bg-corn-accent hover:bg-cyan-400 text-corn-base font-bold py-3 px-4 rounded-lg flex items-center justify-center gap-2 transition-colors">
                            <Save size={18} />
                            Save Changes
                        </button>
                        <button className="flex-1 bg-slate-700 hover:bg-slate-600 text-white font-bold py-3 px-4 rounded-lg flex items-center justify-center gap-2 transition-colors">
                            <RotateCcw size={18} />
                            Reset Data
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};
