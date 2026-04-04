'use client';

import { useEffect } from 'react';

interface ToastProps {
    message: string;
    type: 'info' | 'success' | 'error' | 'warning';
    onClose: () => void;
}

export default function Toast({ message, type, onClose }: ToastProps) {
    useEffect(() => {
        const timer = setTimeout(onClose, 5000);
        return () => clearTimeout(timer);
    }, [onClose]);

    const colors = {
        error: 'bg-red-600/90 border-red-500/50',
        success: 'bg-emerald-600/90 border-emerald-500/50',
        warning: 'bg-amber-600/90 border-amber-500/50',
        info: 'bg-primary-600/90 border-primary-500/50',
    };

    const icons = {
        error: '✗',
        success: '✓',
        warning: '⚠',
        info: 'ℹ',
    };

    return (
        <div
            className={`fixed top-4 right-4 ${colors[type]} text-white px-5 py-3 rounded-xl shadow-2xl z-[100] flex items-center gap-3 animate-slide-in backdrop-blur-md border`}
        >
            <span className="text-lg">{icons[type]}</span>
            <span className="text-sm font-medium">{message}</span>
            <button
                onClick={onClose}
                className="ml-2 text-white/60 hover:text-white transition-colors text-lg leading-none"
            >
                ×
            </button>
        </div>
    );
}
