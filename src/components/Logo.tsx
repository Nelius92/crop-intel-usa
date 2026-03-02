import React from 'react';

interface LogoProps {
    className?: string;
    size?: 'sm' | 'md' | 'lg' | 'xl';
}

export const Logo: React.FC<LogoProps> = ({ className = '', size = 'md' }) => {
    const sizeClasses = {
        sm: 'h-6',
        md: 'h-10 sm:h-12',
        lg: 'h-16 sm:h-20',
        xl: 'h-24 sm:h-32'
    };

    return (
        <div className={`flex flex-col items-center select-none ${sizeClasses[size]} ${className}`}>
            <div className="flex items-center">
                <span className="text-white font-black tracking-tighter leading-none flex items-center"
                    style={{ fontSize: '1.2em' }}>
                    CR
                    <div className="relative mx-[0.05em] flex items-center justify-center">
                        {/* The O replacement: A circular R badge */}
                        <div className="rounded-full border-[0.15em] border-black bg-zinc-900 flex items-center justify-center w-[1em] h-[1em] shadow-[0_0_15px_rgba(239,68,68,0.4)]">
                            <span className="text-[#ef4444] font-black italic" style={{ fontSize: '0.7em', textShadow: '0 0 8px rgba(239, 68, 68, 0.8)' }}>
                                R
                            </span>
                        </div>
                        {/* Glow effect */}
                        <div className="absolute inset-0 bg-red-600/20 rounded-full blur-md -z-10 animate-pulse-slow transition-opacity duration-1000"></div>
                    </div>
                    P
                </span>
            </div>
            <div className="text-[#ef4444] font-black tracking-[0.2em] leading-none mt-[-0.1em] uppercase"
                style={{ fontSize: '0.8em' }}>
                INTEL
            </div>
        </div>
    );
};
