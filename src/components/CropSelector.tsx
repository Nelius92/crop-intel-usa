import React, { useState } from 'react';
import { CropType } from '../types';
import { ChevronDown, Bean, Flower2, Wheat, Sprout } from 'lucide-react';

interface CropSelectorProps {
    selectedCrop: CropType;
    onSelect: (crop: CropType) => void;
}

const CROPS: { type: CropType; icon: React.ReactNode; color: string }[] = [
    { type: 'Yellow Corn', icon: <Sprout size={16} />, color: 'text-yellow-400' },
    { type: 'White Corn', icon: <Sprout size={16} />, color: 'text-slate-200' },
    { type: 'Soybeans', icon: <Bean size={16} />, color: 'text-green-400' },
    { type: 'Wheat', icon: <Wheat size={16} />, color: 'text-amber-300' },
    { type: 'Sunflowers', icon: <Flower2 size={16} />, color: 'text-yellow-500' },
];

export const CropSelector: React.FC<CropSelectorProps> = ({ selectedCrop, onSelect }) => {
    const [isOpen, setIsOpen] = useState(false);

    const activeCrop = CROPS.find(c => c.type === selectedCrop) || CROPS[0];

    return (
        <div className="relative z-50">
            <button
                onClick={() => setIsOpen(!isOpen)}
                className="flex items-center gap-2 bg-black/40 backdrop-blur-md border border-white/10 px-3 py-1.5 rounded-lg hover:bg-white/5 transition-all group"
            >
                <span className={`${activeCrop.color} group-hover:scale-110 transition-transform`}>
                    {activeCrop.icon}
                </span>
                <span className="text-sm font-medium text-white">{selectedCrop}</span>
                <ChevronDown size={14} className={`text-zinc-500 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
            </button>

            {isOpen && (
                <>
                    <div className="fixed inset-0 z-40" onClick={() => setIsOpen(false)} />
                    <div className="absolute top-full right-0 mt-2 w-48 bg-black/90 backdrop-blur-xl border border-white/10 rounded-xl shadow-2xl overflow-hidden z-50 flex flex-col py-1">
                        {CROPS.map((crop) => (
                            <button
                                key={crop.type}
                                onClick={() => {
                                    onSelect(crop.type);
                                    setIsOpen(false);
                                }}
                                className={`flex items-center gap-3 px-4 py-3 text-sm transition-colors ${selectedCrop === crop.type
                                        ? 'bg-white/10 text-white'
                                        : 'text-zinc-400 hover:bg-white/5 hover:text-white'
                                    }`}
                            >
                                <span className={crop.color}>{crop.icon}</span>
                                {crop.type}
                            </button>
                        ))}
                    </div>
                </>
            )}
        </div>
    );
};
