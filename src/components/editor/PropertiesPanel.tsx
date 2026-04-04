'use client';

import { useState } from 'react';
import { Type, Plus, Trash2, ChevronDown, ChevronUp } from 'lucide-react';
import type { Clip, TextOverlay } from '@/lib/api';

interface PropertiesPanelProps {
    selectedClip: Clip | null;
    onUpdateClip: (clip: Clip) => void;
    onAddText: (textData: Partial<TextOverlay>) => void;
    currentTime: number;
    selectedTextOverlay: TextOverlay | null;
    onUpdateText: (text: TextOverlay) => void;
    onSelectText: (textId: string) => void;
    onRemoveText: (textId: string) => void;
    textOverlays: TextOverlay[];
}

export default function PropertiesPanel({
    selectedClip,
    onUpdateClip,
    onAddText,
    currentTime,
    selectedTextOverlay,
    onUpdateText,
    onSelectText,
    onRemoveText,
    textOverlays,
}: PropertiesPanelProps) {
    const [showClipProps, setShowClipProps] = useState(true);
    const [showTextOverlays, setShowTextOverlays] = useState(true);
    const [newText, setNewText] = useState('');

    const handleAddText = () => {
        if (!newText.trim()) return;
        onAddText({
            text: newText,
            startTime: currentTime,
            duration: 3,
            x: 50,
            y: 50,
            fontSize: 32,
            color: '#ffffff',
        });
        setNewText('');
    };

    return (
        <div className="w-64 bg-dark-800 border-l border-dark-700 flex flex-col overflow-hidden shrink-0">
            {/* Header */}
            <div className="px-3 py-3 border-b border-dark-700">
                <h3 className="text-xs font-semibold text-white/60 uppercase tracking-wider">Properties</h3>
            </div>

            <div className="flex-1 overflow-y-auto">
                {/* Clip Properties */}
                <div>
                    <button
                        onClick={() => setShowClipProps(!showClipProps)}
                        className="w-full flex items-center justify-between px-3 py-2 hover:bg-dark-700/30 transition-colors"
                    >
                        <span className="text-xs font-medium text-white/70">Clip Properties</span>
                        {showClipProps ? <ChevronUp className="w-3 h-3 text-white/30" /> : <ChevronDown className="w-3 h-3 text-white/30" />}
                    </button>

                    {showClipProps && (
                        <div className="px-3 pb-3 space-y-3">
                            {selectedClip ? (
                                <>
                                    <div>
                                        <label className="text-[10px] text-white/40 uppercase tracking-wider">Name</label>
                                        <input
                                            type="text"
                                            className="input !text-xs mt-1"
                                            value={selectedClip.name}
                                            onChange={e => onUpdateClip({ ...selectedClip, name: e.target.value })}
                                        />
                                    </div>
                                    <div className="grid grid-cols-2 gap-2">
                                        <div>
                                            <label className="text-[10px] text-white/40 uppercase tracking-wider">Trim Start</label>
                                            <input
                                                type="number"
                                                step="0.1"
                                                min="0"
                                                className="input !text-xs mt-1"
                                                value={selectedClip.trimStart || 0}
                                                onChange={e => onUpdateClip({ ...selectedClip, trimStart: parseFloat(e.target.value) || 0 })}
                                            />
                                        </div>
                                        <div>
                                            <label className="text-[10px] text-white/40 uppercase tracking-wider">Trim End</label>
                                            <input
                                                type="number"
                                                step="0.1"
                                                min="0"
                                                className="input !text-xs mt-1"
                                                value={selectedClip.trimEnd || selectedClip.duration || 0}
                                                onChange={e => onUpdateClip({ ...selectedClip, trimEnd: parseFloat(e.target.value) || 0 })}
                                            />
                                        </div>
                                    </div>
                                    <div>
                                        <label className="text-[10px] text-white/40 uppercase tracking-wider">Duration</label>
                                        <p className="text-xs text-white/60 mt-1">
                                            {((selectedClip.trimEnd || selectedClip.duration || 0) - (selectedClip.trimStart || 0)).toFixed(1)}s
                                        </p>
                                    </div>
                                    <div>
                                        <label className="text-[10px] text-white/40 uppercase tracking-wider">Source</label>
                                        <p className="text-xs text-white/60 mt-1 capitalize">{selectedClip.source}</p>
                                    </div>
                                </>
                            ) : (
                                <p className="text-[10px] text-white/20 py-2 text-center">
                                    Select a clip to edit properties
                                </p>
                            )}
                        </div>
                    )}
                </div>

                {/* Text Overlays */}
                <div className="border-t border-dark-700">
                    <button
                        onClick={() => setShowTextOverlays(!showTextOverlays)}
                        className="w-full flex items-center justify-between px-3 py-2 hover:bg-dark-700/30 transition-colors"
                    >
                        <div className="flex items-center gap-1.5">
                            <Type className="w-3 h-3 text-amber-400" />
                            <span className="text-xs font-medium text-white/70">Text Overlays ({textOverlays.length})</span>
                        </div>
                        {showTextOverlays ? <ChevronUp className="w-3 h-3 text-white/30" /> : <ChevronDown className="w-3 h-3 text-white/30" />}
                    </button>

                    {showTextOverlays && (
                        <div className="px-3 pb-3 space-y-3">
                            {/* Add new text */}
                            <div className="flex gap-1.5">
                                <input
                                    type="text"
                                    className="input !text-xs flex-1"
                                    placeholder="Add text overlay..."
                                    value={newText}
                                    onChange={e => setNewText(e.target.value)}
                                    onKeyDown={e => e.key === 'Enter' && handleAddText()}
                                />
                                <button onClick={handleAddText} className="btn btn-primary !p-1.5" title="Add Text">
                                    <Plus className="w-3.5 h-3.5" />
                                </button>
                            </div>

                            {/* Text overlay list */}
                            {textOverlays.map(overlay => (
                                <div
                                    key={overlay.id}
                                    onClick={() => onSelectText(overlay.id)}
                                    className={`p-2.5 rounded-lg cursor-pointer transition-all ${selectedTextOverlay?.id === overlay.id
                                            ? 'bg-amber-600/15 border border-amber-500/30'
                                            : 'bg-dark-700/30 border border-transparent hover:border-dark-600'
                                        }`}
                                >
                                    <div className="flex items-center justify-between mb-2">
                                        <p className="text-xs text-white/70 truncate flex-1">&quot;{overlay.text}&quot;</p>
                                        <button
                                            onClick={e => {
                                                e.stopPropagation();
                                                onRemoveText(overlay.id);
                                            }}
                                            className="text-white/30 hover:text-red-400 transition-colors ml-2"
                                        >
                                            <Trash2 className="w-3 h-3" />
                                        </button>
                                    </div>

                                    {selectedTextOverlay?.id === overlay.id && (
                                        <div className="space-y-2 mt-2">
                                            <input
                                                type="text"
                                                className="input !text-xs"
                                                value={overlay.text}
                                                onChange={e => onUpdateText({ ...overlay, text: e.target.value })}
                                            />
                                            <div className="grid grid-cols-2 gap-2">
                                                <div>
                                                    <label className="text-[9px] text-white/30">Start (s)</label>
                                                    <input
                                                        type="number"
                                                        step="0.1"
                                                        className="input !text-xs mt-0.5"
                                                        value={overlay.startTime}
                                                        onChange={e => onUpdateText({ ...overlay, startTime: parseFloat(e.target.value) || 0 })}
                                                    />
                                                </div>
                                                <div>
                                                    <label className="text-[9px] text-white/30">Duration (s)</label>
                                                    <input
                                                        type="number"
                                                        step="0.1"
                                                        className="input !text-xs mt-0.5"
                                                        value={overlay.duration}
                                                        onChange={e => onUpdateText({ ...overlay, duration: parseFloat(e.target.value) || 1 })}
                                                    />
                                                </div>
                                            </div>
                                            <div className="grid grid-cols-2 gap-2">
                                                <div>
                                                    <label className="text-[9px] text-white/30">Font Size</label>
                                                    <input
                                                        type="number"
                                                        min="8"
                                                        max="120"
                                                        className="input !text-xs mt-0.5"
                                                        value={overlay.fontSize}
                                                        onChange={e => onUpdateText({ ...overlay, fontSize: parseInt(e.target.value) || 32 })}
                                                    />
                                                </div>
                                                <div>
                                                    <label className="text-[9px] text-white/30">Color</label>
                                                    <input
                                                        type="color"
                                                        className="w-full h-8 mt-0.5 rounded cursor-pointer bg-transparent border-0"
                                                        value={overlay.color}
                                                        onChange={e => onUpdateText({ ...overlay, color: e.target.value })}
                                                    />
                                                </div>
                                            </div>
                                            <div className="grid grid-cols-2 gap-2">
                                                <div>
                                                    <label className="text-[9px] text-white/30">X Position (%)</label>
                                                    <input
                                                        type="range"
                                                        min="0"
                                                        max="100"
                                                        className="w-full mt-0.5"
                                                        value={overlay.x}
                                                        onChange={e => onUpdateText({ ...overlay, x: parseInt(e.target.value) })}
                                                    />
                                                </div>
                                                <div>
                                                    <label className="text-[9px] text-white/30">Y Position (%)</label>
                                                    <input
                                                        type="range"
                                                        min="0"
                                                        max="100"
                                                        className="w-full mt-0.5"
                                                        value={overlay.y}
                                                        onChange={e => onUpdateText({ ...overlay, y: parseInt(e.target.value) })}
                                                    />
                                                </div>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
