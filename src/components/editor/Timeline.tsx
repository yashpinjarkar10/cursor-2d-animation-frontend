'use client';

import { useState, useRef, useCallback, useEffect, useMemo } from 'react';
import { Scissors, Trash2, ChevronDown, ChevronUp, GripVertical, Film, ZoomIn, ZoomOut } from 'lucide-react';
import type { Clip, TextOverlay } from '@/lib/api';

interface TimelineProps {
  clips: Clip[];
  selectedClip: Clip | null;
  onSelectClip: (clip: Clip | null) => void;
  onRemoveClip: (clipId: string) => void;
  onReorderClips: (clips: Clip[]) => void;
  audioClips?: Clip[];
  textOverlays?: TextOverlay[];
  onTrimClip: (clipId: string, trimStart: number, trimEnd: number) => void;
  onSplitClip: (clipId: string, splitTime: number) => void;
  onRemoveAudio?: (audioId: string) => void;
  onRemoveText?: (textId: string) => void;
  onSelectText?: (textId: string) => void;
  currentTime: number;
  onSeek: (globalTime: number) => void;
}

const TRACK_HEIGHT = 48;
const LABEL_WIDTH = 48; // px for track labels

export default function Timeline({
  clips,
  selectedClip,
  onSelectClip,
  onRemoveClip,
  onReorderClips,
  audioClips = [],
  textOverlays = [],
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  onTrimClip,
  onSplitClip,
  onRemoveAudio,
  onRemoveText,
  onSelectText,
  currentTime,
  onSeek,
}: TimelineProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; clipId: string } | null>(null);
  const [pixelsPerSecond, setPixelsPerSecond] = useState(80);

  const videoClips = useMemo(() => clips.filter(c => c.type === 'video'), [clips]);

  // Total timeline duration
  const totalDuration = useMemo(() =>
    videoClips.reduce((sum, clip) => {
      const clipDuration = (clip.trimEnd || clip.duration || 0) - (clip.trimStart || 0);
      return sum + clipDuration;
    }, 0),
    [videoClips]
  );

  const timelineWidth = Math.max(totalDuration * pixelsPerSecond, 600);

  // Handle seek click on timeline
  const handleTimelineClick = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    if (!scrollRef.current) return;
    const rect = scrollRef.current.getBoundingClientRect();
    const scrollLeft = scrollRef.current.scrollLeft;
    const x = e.clientX - rect.left + scrollLeft;
    const time = x / pixelsPerSecond;
    onSeek(Math.max(0, Math.min(time, totalDuration)));
  }, [onSeek, totalDuration, pixelsPerSecond]);

  // Playhead position
  const playheadPosition = currentTime * pixelsPerSecond;

  // Time markers
  const timeMarkers = useMemo(() => {
    const markers = [];
    const interval = totalDuration > 60 ? 10 : totalDuration > 20 ? 5 : 1;
    for (let t = 0; t <= totalDuration + interval; t += interval) {
      markers.push(t);
    }
    return markers;
  }, [totalDuration]);

  const formatTime = (seconds: number): string => {
    const m = Math.floor(seconds / 60);
    const s = Math.floor(seconds % 60);
    return `${m}:${s.toString().padStart(2, '0')}`;
  };

  // Right-click context menu
  const handleContextMenu = useCallback((e: React.MouseEvent, clipId: string) => {
    e.preventDefault();
    setContextMenu({ x: e.clientX, y: e.clientY, clipId });
  }, []);

  // Close context menu
  useEffect(() => {
    const close = () => setContextMenu(null);
    window.addEventListener('click', close);
    return () => window.removeEventListener('click', close);
  }, []);

  // Drag and drop for reordering
  const handleDragStart = useCallback((e: React.DragEvent, index: number) => {
    e.dataTransfer.setData('clip-index', index.toString());
    e.dataTransfer.effectAllowed = 'move';
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent, index: number) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    setDragOverIndex(index);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent, targetIndex: number) => {
    e.preventDefault();
    const sourceIndex = parseInt(e.dataTransfer.getData('clip-index'));
    if (isNaN(sourceIndex) || sourceIndex === targetIndex) {
      setDragOverIndex(null);
      return;
    }

    const newClips = [...clips];
    const videoClipIds = videoClips.map(c => c.id);
    const sourceClipId = videoClipIds[sourceIndex];
    const targetClipId = videoClipIds[targetIndex];

    const sourceActualIndex = newClips.findIndex(c => c.id === sourceClipId);
    const targetActualIndex = newClips.findIndex(c => c.id === targetClipId);

    if (sourceActualIndex >= 0 && targetActualIndex >= 0) {
      const [removed] = newClips.splice(sourceActualIndex, 1);
      newClips.splice(targetActualIndex, 0, removed);
      onReorderClips(newClips);
    }
    setDragOverIndex(null);
  }, [clips, videoClips, onReorderClips]);

  const handleSplitAtPlayhead = useCallback((clipId: string) => {
    let accumulatedTime = 0;
    for (const clip of videoClips) {
      const clipDuration = (clip.trimEnd || clip.duration || 0) - (clip.trimStart || 0);
      if (clip.id === clipId) {
        const localSplitTime = (clip.trimStart || 0) + (currentTime - accumulatedTime);
        if (localSplitTime > (clip.trimStart || 0) && localSplitTime < (clip.trimEnd || clip.duration || 0)) {
          onSplitClip(clipId, localSplitTime);
        }
        break;
      }
      accumulatedTime += clipDuration;
    }
  }, [videoClips, currentTime, onSplitClip]);

  // Zoom controls
  const handleZoomIn = useCallback(() => {
    setPixelsPerSecond(prev => Math.min(200, prev + 20));
  }, []);

  const handleZoomOut = useCallback(() => {
    setPixelsPerSecond(prev => Math.max(20, prev - 20));
  }, []);

  // Total tracks height for dynamic sizing
  const totalTracksHeight = TRACK_HEIGHT + (audioClips.length > 0 ? TRACK_HEIGHT - 10 : 0) + (textOverlays.length > 0 ? 32 : 0);

  return (
    <div className={`bg-dark-800 border-t border-dark-700 flex flex-col shrink-0 ${isCollapsed ? 'h-10' : ''}`}>
      {/* Timeline Header */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-dark-700">
        <div
          className="flex items-center gap-2 cursor-pointer hover:bg-dark-700/30 rounded px-1.5 py-0.5 transition-colors"
          onClick={() => setIsCollapsed(!isCollapsed)}
        >
          <span className="text-xs font-semibold text-white/60 uppercase tracking-wider">Timeline</span>
          <span className="text-[10px] text-white/30">
            {videoClips.length} clip{videoClips.length !== 1 ? 's' : ''} · {formatTime(totalDuration)}
          </span>
          {isCollapsed ? <ChevronUp className="w-3.5 h-3.5 text-white/30" /> : <ChevronDown className="w-3.5 h-3.5 text-white/30" />}
        </div>

        {/* Zoom Controls */}
        {!isCollapsed && (
          <div className="flex items-center gap-1.5">
            <button onClick={handleZoomOut} className="btn-ghost p-1 rounded" title="Zoom Out">
              <ZoomOut className="w-3.5 h-3.5 text-white/40 hover:text-white/70" />
            </button>
            <input
              type="range"
              min="20"
              max="200"
              step="10"
              value={pixelsPerSecond}
              onChange={e => setPixelsPerSecond(parseInt(e.target.value))}
              className="w-20 h-1 accent-primary-500"
              title={`Zoom: ${pixelsPerSecond}px/s`}
            />
            <button onClick={handleZoomIn} className="btn-ghost p-1 rounded" title="Zoom In">
              <ZoomIn className="w-3.5 h-3.5 text-white/40 hover:text-white/70" />
            </button>
          </div>
        )}
      </div>

      {!isCollapsed && (
        <>
          {/* Empty State */}
          {videoClips.length === 0 && audioClips.length === 0 && textOverlays.length === 0 ? (
            <div className="flex items-center justify-center py-10 text-center" style={{ minHeight: '120px' }}>
              <div>
                <Film className="w-8 h-8 text-white/10 mx-auto mb-2" />
                <p className="text-xs text-white/25">Generate or upload a video to get started</p>
                <p className="text-[10px] text-white/15 mt-1">Clips will appear here on the timeline</p>
              </div>
            </div>
          ) : (
            <div
              ref={scrollRef}
              className="flex-1 overflow-x-auto overflow-y-hidden relative"
              style={{ minHeight: `${Math.max(totalTracksHeight + 40, 160)}px` }}
              onClick={handleTimelineClick}
            >
              <div className="relative" style={{ width: `${timelineWidth + LABEL_WIDTH}px`, minWidth: '100%' }}>
                {/* Time Ruler */}
                <div className="h-6 border-b border-dark-700 relative" style={{ marginLeft: `${LABEL_WIDTH}px` }}>
                  {timeMarkers.map(t => (
                    <div
                      key={t}
                      className="absolute top-0 h-full flex flex-col items-center"
                      style={{ left: `${t * pixelsPerSecond}px` }}
                    >
                      <div className="w-px h-2 bg-white/20" />
                      <span className="text-[10px] text-white/30 mt-0.5">{formatTime(t)}</span>
                    </div>
                  ))}
                </div>

                {/* Video Track */}
                <div className="relative flex" style={{ height: `${TRACK_HEIGHT}px` }}>
                  {/* Track Label */}
                  <div
                    className="shrink-0 flex items-center justify-center border-r border-dark-700 text-[10px] text-white/30 font-medium"
                    style={{ width: `${LABEL_WIDTH}px` }}
                  >
                    🎬
                  </div>
                  {/* Track Content */}
                  <div className="flex-1 relative">
                    <div className="absolute left-0 top-0 bottom-0 flex">
                      {videoClips.map((clip, index) => {
                        const clipDuration = (clip.trimEnd || clip.duration || 0) - (clip.trimStart || 0);
                        const width = Math.max(clipDuration * pixelsPerSecond, 40);
                        const isSelected = selectedClip?.id === clip.id;
                        const isDragTarget = dragOverIndex === index;

                        return (
                          <div
                            key={clip.id}
                            className={`relative h-full flex items-center cursor-pointer group transition-all duration-150
                              ${isSelected
                                ? 'bg-primary-600/30 border border-primary-500/60 z-10'
                                : 'bg-dark-600/50 border border-dark-500/30 hover:bg-dark-600/80'
                              }
                              ${isDragTarget ? 'border-l-2 border-l-primary-400' : ''}
                              rounded-md mx-0.5
                            `}
                            style={{ width: `${width}px` }}
                            onClick={e => {
                              e.stopPropagation();
                              onSelectClip(clip);
                            }}
                            onContextMenu={e => handleContextMenu(e, clip.id)}
                            draggable
                            onDragStart={e => handleDragStart(e, index)}
                            onDragOver={e => handleDragOver(e, index)}
                            onDrop={e => handleDrop(e, index)}
                            onDragLeave={() => setDragOverIndex(null)}
                          >
                            {/* Drag Handle */}
                            <GripVertical className="w-3 h-3 text-white/20 mx-1 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity" />

                            {/* Clip Label */}
                            <div className="flex-1 min-w-0 px-1">
                              <p className="text-[10px] text-white/70 truncate">{clip.name}</p>
                              <p className="text-[10px] text-white/30">{formatTime(clipDuration)}</p>
                            </div>

                            {/* Delete */}
                            <button
                              onClick={e => {
                                e.stopPropagation();
                                onRemoveClip(clip.id);
                              }}
                              className="opacity-0 group-hover:opacity-100 p-1 text-white/30 hover:text-red-400 transition-all"
                            >
                              <Trash2 className="w-3 h-3" />
                            </button>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>

                {/* Audio Track */}
                {audioClips.length > 0 && (
                  <div className="relative flex border-t border-dark-700" style={{ height: `${TRACK_HEIGHT - 10}px` }}>
                    {/* Track Label */}
                    <div
                      className="shrink-0 flex items-center justify-center border-r border-dark-700 text-[10px] text-white/30 font-medium"
                      style={{ width: `${LABEL_WIDTH}px` }}
                    >
                      🎵
                    </div>
                    {/* Track Content */}
                    <div className="flex-1 relative">
                      {audioClips.map(clip => {
                        const startX = (clip.startTime || 0) * pixelsPerSecond;
                        const clipDuration = (clip.trimEnd || clip.duration || 10) - (clip.trimStart || 0);
                        const width = Math.max(clipDuration * pixelsPerSecond, 30);

                        return (
                          <div
                            key={clip.timelineId || clip.id}
                            className="absolute h-full bg-emerald-600/20 border border-emerald-500/30 rounded-md flex items-center px-2 group"
                            style={{ left: `${startX}px`, width: `${width}px`, top: 0 }}
                          >
                            <p className="text-[10px] text-emerald-400/60 truncate">{clip.name}</p>
                            {onRemoveAudio && (
                              <button
                                onClick={() => onRemoveAudio(clip.timelineId || clip.id)}
                                className="opacity-0 group-hover:opacity-100 ml-auto text-white/30 hover:text-red-400"
                              >
                                <Trash2 className="w-2.5 h-2.5" />
                              </button>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* Text Overlay Track */}
                {textOverlays.length > 0 && (
                  <div className="relative flex border-t border-dark-700" style={{ height: '36px' }}>
                    {/* Track Label */}
                    <div
                      className="shrink-0 flex items-center justify-center border-r border-dark-700 text-[10px] text-white/30 font-medium"
                      style={{ width: `${LABEL_WIDTH}px` }}
                    >
                      📝
                    </div>
                    {/* Track Content */}
                    <div className="flex-1 relative">
                      {textOverlays.map(overlay => {
                        const startX = (overlay.startTime || 0) * pixelsPerSecond;
                        const width = Math.max((overlay.duration || 3) * pixelsPerSecond, 30);

                        return (
                          <div
                            key={overlay.id}
                            className="absolute h-full bg-amber-600/15 border border-amber-500/30 rounded-md flex items-center px-2 cursor-pointer group"
                            style={{ left: `${startX}px`, width: `${width}px`, top: 0 }}
                            onClick={e => {
                              e.stopPropagation();
                              onSelectText?.(overlay.id);
                            }}
                          >
                            <p className="text-[10px] text-amber-400/60 truncate">{overlay.text}</p>
                            {onRemoveText && (
                              <button
                                onClick={e => {
                                  e.stopPropagation();
                                  onRemoveText(overlay.id);
                                }}
                                className="opacity-0 group-hover:opacity-100 ml-auto text-white/30 hover:text-red-400"
                              >
                                <Trash2 className="w-2.5 h-2.5" />
                              </button>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* Playhead */}
                <div
                  className="absolute top-0 bottom-0 w-0.5 bg-red-500 z-20 pointer-events-none"
                  style={{ left: `${playheadPosition + LABEL_WIDTH}px` }}
                >
                  <div className="absolute -top-0.5 left-1/2 -translate-x-1/2 w-2.5 h-2.5 bg-red-500 rounded-full shadow-lg" />
                </div>
              </div>
            </div>
          )}
        </>
      )}

      {/* Context Menu */}
      {contextMenu && (
        <div
          className="fixed bg-dark-700 border border-dark-600 rounded-lg shadow-xl z-50 py-1 min-w-[140px] animate-fade-in"
          style={{ left: `${contextMenu.x}px`, top: `${contextMenu.y}px` }}
        >
          <button
            onClick={() => {
              handleSplitAtPlayhead(contextMenu.clipId);
              setContextMenu(null);
            }}
            className="w-full flex items-center gap-2 px-3 py-1.5 text-xs text-white/70 hover:bg-dark-600 hover:text-white transition-colors"
          >
            <Scissors className="w-3 h-3" />
            Split at Playhead
          </button>
          <button
            onClick={() => {
              onRemoveClip(contextMenu.clipId);
              setContextMenu(null);
            }}
            className="w-full flex items-center gap-2 px-3 py-1.5 text-xs text-red-400/70 hover:bg-dark-600 hover:text-red-400 transition-colors"
          >
            <Trash2 className="w-3 h-3" />
            Remove
          </button>
        </div>
      )}
    </div>
  );
}
