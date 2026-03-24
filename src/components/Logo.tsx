import React from 'react';

interface LogoProps {
    className?: string;
    size?: 'sm' | 'md' | 'lg' | 'xl';
}

export const Logo: React.FC<LogoProps> = ({ className = '', size = 'md' }) => {
    const sizeClasses = {
        sm: 'h-8 sm:h-12', // Base nav size
        md: 'h-16 sm:h-20', // Standard size, slightly bumped up
        lg: 'h-24 sm:h-32', // Large size (splash screens, sidebars)
        xl: 'h-32 sm:h-48' // Extra large hero
    };

    return (
        <img
            src="/logo.png"
            alt="Crop Intel Logo"
            className={`object-contain select-none filter drop-shadow-[0_0_10px_rgba(239,68,68,0.2)] ${sizeClasses[size]} ${className}`}
        />
    );
};
