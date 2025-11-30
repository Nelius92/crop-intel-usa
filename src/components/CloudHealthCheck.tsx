import { useState } from 'react';
import { geminiService } from '../services/gemini';
import { googleMapsService } from '../services/googleMapsService';
import { Activity, CheckCircle, XCircle, Loader2, MapPin, Brain } from 'lucide-react';

interface TestResult {
    name: string;
    status: 'idle' | 'loading' | 'success' | 'error';
    message?: string;
    data?: any;
}

export const CloudHealthCheck = () => {
    const [isOpen, setIsOpen] = useState(false);
    const [results, setResults] = useState<Record<string, TestResult>>({
        geminiHeatmap: { name: 'Gemini Heatmap', status: 'idle' },
        geminiBuyers: { name: 'Gemini Buyers', status: 'idle' },
        geminiOracle: { name: 'Gemini Oracle', status: 'idle' },
        mapsSearch: { name: 'Maps Search', status: 'idle' }
    });

    const runTest = async (key: string, testFn: () => Promise<any>) => {
        setResults(prev => ({
            ...prev,
            [key]: { ...prev[key], status: 'loading', message: undefined, data: undefined }
        }));

        try {
            const data = await testFn();
            setResults(prev => ({
                ...prev,
                [key]: {
                    ...prev[key],
                    status: 'success',
                    message: 'Data received successfully',
                    data: JSON.stringify(data, null, 2).slice(0, 200) + '...'
                }
            }));
        } catch (error: any) {
            setResults(prev => ({
                ...prev,
                [key]: {
                    ...prev[key],
                    status: 'error',
                    message: error.message || 'Unknown error occurred'
                }
            }));
        }
    };

    if (!isOpen) {
        return (
            <button
                onClick={() => setIsOpen(true)}
                className="fixed bottom-20 right-6 z-50 bg-corn-accent text-corn-dark p-3 rounded-full shadow-lg hover:bg-white transition-colors"
                title="Cloud Health Check"
            >
                <Activity size={24} />
            </button>
        );
    }

    return (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
            <div className="bg-corn-card border border-corn-accent/20 rounded-xl w-full max-w-2xl max-h-[80vh] overflow-hidden flex flex-col shadow-2xl">
                <div className="p-4 border-b border-white/10 flex justify-between items-center bg-white/5">
                    <div className="flex items-center gap-2">
                        <Activity className="text-corn-accent" />
                        <h2 className="text-xl font-bold text-white">Cloud Integrations Health Check</h2>
                    </div>
                    <button
                        onClick={() => setIsOpen(false)}
                        className="text-white/50 hover:text-white transition-colors"
                    >
                        Close
                    </button>
                </div>

                <div className="p-6 overflow-y-auto space-y-6">
                    {/* Environment Check */}
                    <div className="bg-white/5 rounded-lg p-4 border border-white/10">
                        <h3 className="text-sm font-semibold text-white/70 mb-3 uppercase tracking-wider">Environment Variables</h3>
                        <div className="grid grid-cols-1 gap-2">
                            <div className="flex items-center justify-between p-2 bg-black/20 rounded">
                                <span className="text-white/80">VITE_GEMINI_API_KEY</span>
                                {import.meta.env.VITE_GEMINI_API_KEY ? (
                                    <span className="text-green-400 flex items-center gap-1 text-sm"><CheckCircle size={14} /> Present</span>
                                ) : (
                                    <span className="text-red-400 flex items-center gap-1 text-sm"><XCircle size={14} /> Missing</span>
                                )}
                            </div>
                            <div className="flex items-center justify-between p-2 bg-black/20 rounded">
                                <span className="text-white/80">VITE_GOOGLE_MAPS_API_KEY</span>
                                {import.meta.env.VITE_GOOGLE_MAPS_API_KEY ? (
                                    <span className="text-green-400 flex items-center gap-1 text-sm"><CheckCircle size={14} /> Present</span>
                                ) : (
                                    <span className="text-red-400 flex items-center gap-1 text-sm"><XCircle size={14} /> Missing</span>
                                )}
                            </div>
                        </div>
                    </div>

                    {/* Gemini Tests */}
                    <div className="space-y-3">
                        <h3 className="text-sm font-semibold text-white/70 uppercase tracking-wider flex items-center gap-2">
                            <Brain size={16} /> Gemini AI Services
                        </h3>

                        <div className="grid gap-3">
                            {/* Heatmap Test */}
                            <div className="bg-white/5 p-4 rounded-lg border border-white/10">
                                <div className="flex justify-between items-center mb-2">
                                    <span className="font-medium text-white">Live Heatmap Data</span>
                                    <button
                                        onClick={() => runTest('geminiHeatmap', () => geminiService.getLiveHeatmapData())}
                                        disabled={results.geminiHeatmap.status === 'loading'}
                                        className="px-3 py-1 bg-corn-accent/20 text-corn-accent rounded hover:bg-corn-accent/30 disabled:opacity-50 text-sm transition-colors"
                                    >
                                        {results.geminiHeatmap.status === 'loading' ? 'Testing...' : 'Run Test'}
                                    </button>
                                </div>
                                <StatusDisplay result={results.geminiHeatmap} />
                            </div>

                            {/* Buyers Test */}
                            <div className="bg-white/5 p-4 rounded-lg border border-white/10">
                                <div className="flex justify-between items-center mb-2">
                                    <span className="font-medium text-white">Live Buyer Data</span>
                                    <button
                                        onClick={() => runTest('geminiBuyers', () => geminiService.getLiveBuyerData())}
                                        disabled={results.geminiBuyers.status === 'loading'}
                                        className="px-3 py-1 bg-corn-accent/20 text-corn-accent rounded hover:bg-corn-accent/30 disabled:opacity-50 text-sm transition-colors"
                                    >
                                        {results.geminiBuyers.status === 'loading' ? 'Testing...' : 'Run Test'}
                                    </button>
                                </div>
                                <StatusDisplay result={results.geminiBuyers} />
                            </div>

                            {/* Oracle Test */}
                            <div className="bg-white/5 p-4 rounded-lg border border-white/10">
                                <div className="flex justify-between items-center mb-2">
                                    <span className="font-medium text-white">Market Oracle</span>
                                    <button
                                        onClick={() => runTest('geminiOracle', () => geminiService.getMarketOracle())}
                                        disabled={results.geminiOracle.status === 'loading'}
                                        className="px-3 py-1 bg-corn-accent/20 text-corn-accent rounded hover:bg-corn-accent/30 disabled:opacity-50 text-sm transition-colors"
                                    >
                                        {results.geminiOracle.status === 'loading' ? 'Testing...' : 'Run Test'}
                                    </button>
                                </div>
                                <StatusDisplay result={results.geminiOracle} />
                            </div>
                        </div>
                    </div>

                    {/* Maps Tests */}
                    <div className="space-y-3">
                        <h3 className="text-sm font-semibold text-white/70 uppercase tracking-wider flex items-center gap-2">
                            <MapPin size={16} /> Google Maps Services
                        </h3>

                        <div className="bg-white/5 p-4 rounded-lg border border-white/10">
                            <div className="flex justify-between items-center mb-2">
                                <span className="font-medium text-white">Place Search (Des Moines)</span>
                                <button
                                    onClick={() => runTest('mapsSearch', () => googleMapsService.searchNearbyPlaces('grain elevator near Des Moines, IA'))}
                                    disabled={results.mapsSearch.status === 'loading'}
                                    className="px-3 py-1 bg-corn-accent/20 text-corn-accent rounded hover:bg-corn-accent/30 disabled:opacity-50 text-sm transition-colors"
                                >
                                    {results.mapsSearch.status === 'loading' ? 'Testing...' : 'Run Test'}
                                </button>
                            </div>
                            <StatusDisplay result={results.mapsSearch} />
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

const StatusDisplay = ({ result }: { result: TestResult }) => {
    if (result.status === 'idle') return <div className="text-xs text-white/40 italic">Ready to test</div>;

    if (result.status === 'loading') return (
        <div className="flex items-center gap-2 text-corn-accent text-sm">
            <Loader2 size={14} className="animate-spin" /> Testing connection...
        </div>
    );

    if (result.status === 'error') return (
        <div className="mt-2 p-2 bg-red-500/10 border border-red-500/20 rounded text-red-400 text-sm">
            <div className="flex items-center gap-2 font-semibold mb-1">
                <XCircle size={14} /> Failed
            </div>
            {result.message}
        </div>
    );

    return (
        <div className="mt-2 space-y-2">
            <div className="flex items-center gap-2 text-green-400 text-sm font-semibold">
                <CheckCircle size={14} /> Success
            </div>
            {result.data && (
                <pre className="text-[10px] bg-black/30 p-2 rounded overflow-x-auto text-white/60 font-mono">
                    {result.data}
                </pre>
            )}
        </div>
    );
};
