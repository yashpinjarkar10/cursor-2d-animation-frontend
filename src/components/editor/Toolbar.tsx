'use client';

import { useState, useEffect } from 'react';
import { Film, Download, Settings, ArrowLeft, Keyboard } from 'lucide-react';
import Link from 'next/link';
import type { ExportSettings } from '@/lib/api';

interface ToolbarProps {
    onExport: (settings: ExportSettings) => void;
    isRendering: boolean;
}

export default function Toolbar({ onExport, isRendering }: ToolbarProps) {
    const [showExportModal, setShowExportModal] = useState(false);
    const [exportSettings, setExportSettings] = useState<ExportSettings>({
        quality: 'high',
        aspectRatio: '16:9',
        resolution: '1920x1080',
    });

    // Keyboard shortcuts
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if ((e.ctrlKey || e.metaKey) && e.key === 'e' && !isRendering) {
                e.preventDefault();
                setShowExportModal(true);
            }
            if (e.key === 'Escape') {
                setShowExportModal(false);
            }
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [isRendering]);

    const handleExport = () => {
        onExport(exportSettings);
        setShowExportModal(false);
    };

    return (
        <>
            <div className="h-14 bg-dark-800 border-b border-dark-700 flex items-center px-4 gap-4 shrink-0">
                {/* Back to Landing */}
                <Link
                    href="/"
                    className="btn-ghost p-2 rounded-lg hover:bg-dark-700 transition-colors"
                    title="Back to Home"
                >
                    <ArrowLeft className="w-4 h-4" />
                </Link>

                <div className="w-px h-6 bg-dark-600" />

                {/* Logo */}
                <div className="flex items-center gap-2">
                    <Film className="w-5 h-5 text-primary-500" />
                    <h1 className="text-base font-bold tracking-tight">
                        <span className="text-white">Manim</span>
                        <span className="text-primary-400 ml-1">Studio</span>
                    </h1>
                </div>

                <div className="flex-1" />

                {/* Keyboard Shortcuts Hint */}
                <div className="hidden md:flex items-center gap-1.5 text-[10px] text-white/25">
                    <Keyboard className="w-3 h-3" />
                    <span>Ctrl+E Export</span>
                </div>

                {/* Export Button */}
                <button
                    className="btn btn-secondary flex items-center gap-2"
                    onClick={() => setShowExportModal(true)}
                    disabled={isRendering}
                    title="Export (Ctrl+E)"
                >
                    <Download className="w-4 h-4" />
                    <span className="hidden sm:inline">Export</span>
                </button>
            </div>

            {/* Export Modal */}
            {showExportModal && (
                <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 animate-fade-in">
                    <div className="panel-glass p-6 w-[460px] shadow-2xl animate-slide-up">
                        <h2 className="text-lg font-bold mb-5 flex items-center gap-2">
                            <Settings className="w-5 h-5 text-primary-400" />
                            Export Settings
                        </h2>

                        <div className="space-y-4">
                            <div>
                                <label className="block text-xs font-medium mb-1.5 text-white/60 uppercase tracking-wider">Quality</label>
                                <select
                                    className="input"
                                    value={exportSettings.quality}
                                    onChange={e => setExportSettings({ ...exportSettings, quality: e.target.value })}
                                >
                                    <option value="high">High (5000 kbps)</option>
                                    <option value="medium">Medium (2500 kbps)</option>
                                    <option value="low">Low (1000 kbps)</option>
                                </select>
                            </div>

                            <div>
                                <label className="block text-xs font-medium mb-1.5 text-white/60 uppercase tracking-wider">Aspect Ratio</label>
                                <select
                                    className="input"
                                    value={exportSettings.aspectRatio}
                                    onChange={e => setExportSettings({ ...exportSettings, aspectRatio: e.target.value })}
                                >
                                    <option value="16:9">16:9 (Landscape)</option>
                                    <option value="9:16">9:16 (Portrait)</option>
                                    <option value="1:1">1:1 (Square)</option>
                                    <option value="4:3">4:3 (Standard)</option>
                                </select>
                            </div>

                            <div>
                                <label className="block text-xs font-medium mb-1.5 text-white/60 uppercase tracking-wider">Resolution</label>
                                <select
                                    className="input"
                                    value={exportSettings.resolution}
                                    onChange={e => setExportSettings({ ...exportSettings, resolution: e.target.value })}
                                >
                                    <option value="3840x2160">3840×2160 (4K UHD)</option>
                                    <option value="1920x1080">1920×1080 (1080p Full HD)</option>
                                    <option value="1280x720">1280×720 (720p HD)</option>
                                    <option value="854x480">854×480 (480p SD)</option>
                                </select>
                            </div>
                        </div>

                        <p className="text-[10px] text-white/30 mt-4">
                            ⓘ Web export downloads the video file. For advanced FFmpeg export, use the desktop app.
                        </p>

                        <div className="flex gap-2 mt-5">
                            <button className="btn btn-primary flex-1" onClick={handleExport}>
                                <Download className="w-4 h-4" />
                                Download Video
                            </button>
                            <button className="btn btn-secondary" onClick={() => setShowExportModal(false)}>
                                Cancel
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </>
    );
}
