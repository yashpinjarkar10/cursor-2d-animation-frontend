'use client';

import { useState, useEffect, useRef } from 'react';
import { Send, Sparkles, Loader2, ChevronDown, ChevronUp, Wand2 } from 'lucide-react';

interface ChatMessage {
    id: string;
    role: 'user' | 'assistant';
    content: string;
    timestamp: Date;
    videoUrl?: string;
    status?: 'pending' | 'generating' | 'complete' | 'error';
    progress?: number;
    progressMessage?: string;
}

interface ChatPromptProps {
    onGenerateVideo: (prompt: string) => void;
    isGenerating: boolean;
    generationProgress?: number;
    generationMessage?: string;
}

const SUGGESTION_CHIPS = [
    'Create a circle animation',
    'Show the Pythagorean theorem',
    'Animate a sine wave',
    'Sort algorithm visualization',
    'Draw a fractal tree',
    'Matrix transformation demo',
];

export default function ChatPrompt({
    onGenerateVideo,
    isGenerating,
    generationProgress = 0,
    generationMessage = '',
}: ChatPromptProps) {
    const [prompt, setPrompt] = useState('');
    const [messages, setMessages] = useState<ChatMessage[]>([]);
    const [isExpanded, setIsExpanded] = useState(true);
    const inputRef = useRef<HTMLTextAreaElement>(null);
    const messagesEndRef = useRef<HTMLDivElement>(null);

    // Scroll to bottom on new messages
    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages]);

    // Update generating message status
    useEffect(() => {
        if (isGenerating && messages.length > 0) {
            const lastMessage = messages[messages.length - 1];
            if (lastMessage.role === 'assistant' && lastMessage.status === 'generating') {
                setMessages(prev =>
                    prev.map((m, i) =>
                        i === prev.length - 1
                            ? { ...m, progress: generationProgress, progressMessage: generationMessage }
                            : m
                    )
                );
            }
        }
    }, [generationProgress, generationMessage, isGenerating, messages]);

    const handleSubmit = () => {
        const trimmedPrompt = prompt.trim();
        if (!trimmedPrompt || isGenerating) return;

        // Add user message
        const userMsg: ChatMessage = {
            id: Date.now().toString() + '-user',
            role: 'user',
            content: trimmedPrompt,
            timestamp: new Date(),
        };

        // Add assistant generating message
        const assistantMsg: ChatMessage = {
            id: Date.now().toString() + '-assistant',
            role: 'assistant',
            content: 'Generating your animation...',
            timestamp: new Date(),
            status: 'generating',
            progress: 0,
            progressMessage: 'Starting...',
        };

        setMessages(prev => [...prev, userMsg, assistantMsg]);
        onGenerateVideo(trimmedPrompt);
        setPrompt('');
    };

    // Update on completion
    useEffect(() => {
        if (!isGenerating && messages.length > 0) {
            const lastMsg = messages[messages.length - 1];
            if (lastMsg.role === 'assistant' && lastMsg.status === 'generating') {
                setMessages(prev =>
                    prev.map((m, i) =>
                        i === prev.length - 1
                            ? { ...m, status: 'complete', content: 'Animation generated successfully! ✓', progress: 100, progressMessage: 'Done!' }
                            : m
                    )
                );
            }
        }
    }, [isGenerating]);

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            handleSubmit();
        }
    };

    const handleSuggestionClick = (suggestion: string) => {
        setPrompt(suggestion);
        inputRef.current?.focus();
    };

    return (
        <div className="flex flex-col h-full bg-dark-800 border-r border-dark-700">
            {/* Header */}
            <div
                className="flex items-center justify-between px-4 py-3 border-b border-dark-700 cursor-pointer hover:bg-dark-700/30 transition-colors"
                onClick={() => setIsExpanded(!isExpanded)}
            >
                <div className="flex items-center gap-2">
                    <Sparkles className="w-4 h-4 text-primary-400" />
                    <h3 className="text-sm font-semibold text-white">AI Prompt</h3>
                </div>
                {isExpanded ? (
                    <ChevronUp className="w-4 h-4 text-white/40" />
                ) : (
                    <ChevronDown className="w-4 h-4 text-white/40" />
                )}
            </div>

            {isExpanded && (
                <>
                    {/* Messages */}
                    <div className="flex-1 overflow-y-auto px-3 py-3 space-y-3 min-h-0">
                        {messages.length === 0 && (
                            <div className="text-center py-6">
                                <Wand2 className="w-8 h-8 text-white/15 mx-auto mb-3" />
                                <p className="text-xs text-white/30 mb-4">
                                    Describe the animation you want to create
                                </p>
                                <div className="flex flex-wrap gap-1.5 justify-center">
                                    {SUGGESTION_CHIPS.map(chip => (
                                        <button
                                            key={chip}
                                            onClick={() => handleSuggestionClick(chip)}
                                            className="text-[10px] px-2.5 py-1 rounded-full bg-dark-700 text-white/50 hover:text-white/80 hover:bg-dark-600 transition-all"
                                        >
                                            {chip}
                                        </button>
                                    ))}
                                </div>
                            </div>
                        )}

                        {messages.map(msg => (
                            <div
                                key={msg.id}
                                className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
                            >
                                <div
                                    className={`max-w-[85%] rounded-xl px-3 py-2 text-xs ${msg.role === 'user'
                                            ? 'bg-primary-600/80 text-white'
                                            : 'bg-dark-700 text-white/80'
                                        }`}
                                >
                                    <p>{msg.content}</p>
                                    {msg.role === 'assistant' && msg.status === 'generating' && (
                                        <div className="mt-2">
                                            <div className="flex items-center gap-2 mb-1">
                                                <Loader2 className="w-3 h-3 animate-spin text-primary-400" />
                                                <span className="text-[10px] text-white/50">{msg.progressMessage}</span>
                                            </div>
                                            <div className="w-full h-1 bg-dark-600 rounded-full overflow-hidden">
                                                <div
                                                    className="h-full bg-primary-500 rounded-full transition-all duration-300"
                                                    style={{ width: `${msg.progress || 0}%` }}
                                                />
                                            </div>
                                        </div>
                                    )}
                                </div>
                            </div>
                        ))}
                        <div ref={messagesEndRef} />
                    </div>

                    {/* Input */}
                    <div className="p-3 border-t border-dark-700">
                        <div className="flex gap-2 items-end">
                            <textarea
                                ref={inputRef}
                                value={prompt}
                                onChange={e => setPrompt(e.target.value)}
                                onKeyDown={handleKeyDown}
                                placeholder="Describe your animation..."
                                rows={2}
                                className="input flex-1 resize-none text-xs !py-2"
                                disabled={isGenerating}
                            />
                            <button
                                onClick={handleSubmit}
                                disabled={!prompt.trim() || isGenerating}
                                className="btn btn-primary !p-2.5 rounded-xl shrink-0"
                                title="Generate (Enter)"
                            >
                                {isGenerating ? (
                                    <Loader2 className="w-4 h-4 animate-spin" />
                                ) : (
                                    <Send className="w-4 h-4" />
                                )}
                            </button>
                        </div>
                    </div>
                </>
            )}
        </div>
    );
}
