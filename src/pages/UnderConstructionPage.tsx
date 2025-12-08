import React, { useState, useEffect } from 'react';
import { Sprout, Hammer, Timer, Activity } from 'lucide-react';

export const UnderConstructionPage: React.FC = () => {
    const [progress, setProgress] = useState(0);
    const [currentTime, setCurrentTime] = useState(new Date());

    useEffect(() => {
        const updateProgress = () => {
            const now = new Date();
            setCurrentTime(now);

            // Calculate seconds passed in the current day
            const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());
            const secondsPassed = (now.getTime() - startOfDay.getTime()) / 1000;
            const totalSecondsInDay = 24 * 60 * 60;

            const percentage = (secondsPassed / totalSecondsInDay) * 100;
            setProgress(percentage);
        };

        // Update immediately
        updateProgress();

        // Update every second
        const interval = setInterval(updateProgress, 1000);

        return () => clearInterval(interval);
    }, []);

    const formatTime = (date: Date) => {
        return date.toLocaleTimeString('en-US', {
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit',
            hour12: false
        });
    };

    return (
        <div className="w-screen h-screen bg-corn-base flex flex-col items-center justify-center relative overflow-hidden">
            {/* Background Effects */}
            {/* Background Effects */}
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,_var(--tw-gradient-stops))] from-corn-surface via-corn-base to-black opacity-80"></div>
            <div className="absolute inset-0 bg-[radial-gradient(#ffffff_1px,transparent_1px)] [background-size:16px_16px] opacity-[0.03]"></div>

            {/* Animated Glow Orbs */}
            <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-corn-accent/10 rounded-full blur-[100px] animate-pulse"></div>
            <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-corn-high/5 rounded-full blur-[100px] animate-pulse delay-1000"></div>

            <div className="z-10 w-full max-w-2xl px-6">
                {/* Branding */}
                <div className="flex items-center justify-center gap-3 mb-12">
                    <div className="bg-corn-accent/20 p-3 rounded-xl backdrop-blur-sm border border-corn-accent/30 shadow-[0_0_15px_rgba(239,68,68,0.3)]">
                        <Sprout className="text-corn-accent" size={32} />
                    </div>
                    <h1 className="text-4xl md:text-5xl font-bold text-white tracking-tight">
                        Corn<span className="text-corn-accent">Intel</span> USA
                    </h1>
                </div>

                {/* Main Card */}
                <div className="bg-corn-surface/50 backdrop-blur-xl border border-white/10 rounded-3xl p-8 md:p-12 shadow-2xl relative overflow-hidden group">
                    <div className="absolute inset-0 bg-gradient-to-br from-white/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500"></div>

                    <div className="flex flex-col items-center text-center space-y-6 relative z-10">
                        <div className="relative">
                            <div className="absolute inset-0 bg-corn-accent/20 blur-xl rounded-full"></div>
                            <Hammer className="text-corn-accent relative z-10 animate-bounce" size={48} />
                        </div>

                        <h2 className="text-3xl font-bold text-white">System Upgrade in Progress</h2>
                        <p className="text-gray-400 max-w-md text-lg">
                            We are currently implementing major updates to our intelligence platform.
                            Services will resume shortly.
                        </p>

                        {/* Progress Section */}
                        <div className="w-full space-y-4 mt-8">
                            <div className="flex justify-between text-sm font-medium text-gray-400">
                                <span className="flex items-center gap-2">
                                    <Activity size={16} className="text-corn-accent" />
                                    System Synchronization
                                </span>
                                <span className="font-mono text-corn-accent">{progress.toFixed(2)}%</span>
                            </div>

                            <div className="h-4 bg-black/50 rounded-full overflow-hidden border border-white/5 relative">
                                <div
                                    className="h-full bg-gradient-to-r from-corn-accent to-corn-glow relative transition-all duration-1000 ease-linear"
                                    style={{ width: `${progress}%` }}
                                >
                                    <div className="absolute inset-0 bg-white/20 animate-[shimmer_2s_infinite] skew-x-12"></div>
                                </div>
                            </div>

                            <div className="flex justify-between text-xs text-gray-500 font-mono">
                                <span className="flex items-center gap-1">
                                    <Timer size={12} />
                                    CYCLE: 24H
                                </span>
                                <span>SERVER TIME: {formatTime(currentTime)}</span>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Footer */}
                <div className="mt-12 text-center text-gray-500 text-sm">
                    <p>&copy; {new Date().getFullYear()} Corn Intel USA. All rights reserved.</p>
                </div>
            </div>
        </div>
    );
};
