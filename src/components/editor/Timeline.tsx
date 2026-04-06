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
  onMoveAudio?: (audioId: string, startTime: number) => void;
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
  onMoveAudio,
  onRemoveText,
  onSelectText,
  currentTime,
  onSeek,
}: TimelineProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; clipId: string } | null>(null);
  const [pixelsPerSecond, setPixelsPerSecond] = useState(80);

  const draggingAudioRef = useRef<{
    id: string;
    startClientX: number;
    initialStartTime: number;
  } | null>(null);
  const [draggingAudioId, setDraggingAudioId] = useState<string | null>(null);

  const draggingVideoRef = useRef<{
    clipId: string;
    sourceIndex: number;
    insertionIndex: number;
    videoClipIds: string[];
    durations: number[];
  } | null>(null);
  const [draggingVideoId, setDraggingVideoId] = useState<string | null>(null);
  const [videoInsertionIndex, setVideoInsertionIndex] = useState<number | null>(null);

  const videoClips = useMemo(() => clips.filter(c => c.type === 'video'), [clips]);

  const audioLanes = useMemo(() => {
    if (!audioClips.length) return [] as Clip[][];

    const sorted = [...audioClips].sort((a, b) => (a.startTime || 0) - (b.startTime || 0));
    const lanes: { end: number; clips: Clip[] }[] = [];

    for (const clip of sorted) {
      const start = clip.startTime || 0;
      const dur = (clip.trimEnd || clip.duration || 10) - (clip.trimStart || 0);
      const safeDur = Math.max(0.1, dur || 0);
      const end = start + safeDur;

      let placed = false;
      for (const lane of lanes) {
        if (lane.end <= start) {
          lane.clips.push(clip);
          lane.end = end;
          placed = true;
          break;
        }
      }
      if (!placed) lanes.push({ end, clips: [clip] });
    }

    return lanes.map(l => l.clips);
  }, [audioClips]);

  // Total timeline duration
  const totalDuration = useMemo(() => {
    const videoTotal = videoClips.reduce((sum, clip) => {
      const clipDuration = (clip.trimEnd || clip.duration || 0) - (clip.trimStart || 0);
      return sum + Math.max(0, clipDuration);
    }, 0);

    const audioEnd = audioClips.reduce((max, clip) => {
      const start = clip.startTime || 0;
      const dur = (clip.trimEnd || clip.duration || 0) - (clip.trimStart || 0);
      const end = start + Math.max(0, dur);
      return Math.max(max, end);
    }, 0);

    const textEnd = textOverlays.reduce((max, t) => {
      const start = t.startTime || 0;
      const end = start + Math.max(0, t.duration || 0);
      return Math.max(max, end);
    }, 0);

    return Math.max(videoTotal, audioEnd, textEnd);
  }, [videoClips, audioClips, textOverlays]);

  const timelineWidth = Math.max(totalDuration * pixelsPerSecond, 600);

  // Handle seek click on timeline
  const handleTimelineClick = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    if (!scrollRef.current) return;
    const rect = scrollRef.current.getBoundingClientRect();
    const scrollLeft = scrollRef.current.scrollLeft;
    const x = e.clientX - rect.left + scrollLeft - LABEL_WIDTH;
    const time = x / pixelsPerSecond;
    onSeek(Math.max(0, Math.min(time, totalDuration)));
  }, [onSeek, totalDuration, pixelsPerSecond]);

  // Video dragging (ripple reorder)
  useEffect(() => {
    const onMove = (e: MouseEvent) => {
      if (!draggingVideoRef.current) return;
      if (!scrollRef.current) return;

      const rect = scrollRef.current.getBoundingClientRect();
      const scrollLeft = scrollRef.current.scrollLeft;
      const x = e.clientX - rect.left + scrollLeft - LABEL_WIDTH;
      const time = x / pixelsPerSecond;

      const { durations } = draggingVideoRef.current;
      const n = durations.length;
      if (n === 0) return;

      const t = Math.max(0, time);
      let accumulated = 0;
      let insertionIndex = n;
      for (let i = 0; i < n; i++) {
        const dur = Math.max(0.001, durations[i]);
        const mid = accumulated + dur / 2;
        if (t < mid) {
          insertionIndex = i;
          break;
        }
        accumulated += dur;
      }

      draggingVideoRef.current.insertionIndex = insertionIndex;
      setVideoInsertionIndex(insertionIndex);
    };

    const onUp = () => {
      if (!draggingVideoRef.current) return;

      const { clipId, sourceIndex, insertionIndex, videoClipIds } = draggingVideoRef.current;
      draggingVideoRef.current = null;
      setDraggingVideoId(null);
      setVideoInsertionIndex(null);

      const n = videoClipIds.length;
      if (n <= 1) return;
      if (insertionIndex === sourceIndex || insertionIndex === sourceIndex + 1) return;

      const sourceId = clipId;
      const nextOrder = [...videoClipIds];
      const from = nextOrder.indexOf(sourceId);
      if (from === -1) return;
      nextOrder.splice(from, 1);

      const insertAt = insertionIndex > sourceIndex ? insertionIndex - 1 : insertionIndex;
      const clamped = Math.max(0, Math.min(insertAt, nextOrder.length));
      nextOrder.splice(clamped, 0, sourceId);

      const byId = new Map(videoClips.map(v => [v.id, v] as const));
      const reorderedVideos = nextOrder.map(id => byId.get(id)).filter(Boolean) as Clip[];
      if (reorderedVideos.length !== videoClips.length) return;

      const nextClips = [...clips];
      const videoIndexes: number[] = [];
      for (let i = 0; i < nextClips.length; i++) {
        if (nextClips[i].type === 'video') videoIndexes.push(i);
      }
      for (let i = 0; i < videoIndexes.length; i++) {
        nextClips[videoIndexes[i]] = reorderedVideos[i];
      }
      onReorderClips(nextClips);
    };

    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
    return () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    };
  }, [clips, onReorderClips, pixelsPerSecond, videoClips]);

  // Audio dragging
  useEffect(() => {
    const onMove = (e: MouseEvent) => {
      if (!draggingAudioRef.current) return;
      if (!onMoveAudio) return;
      const { id, startClientX, initialStartTime } = draggingAudioRef.current;

      const deltaX = e.clientX - startClientX;
      const deltaT = deltaX / pixelsPerSecond;
      const nextStart = Math.max(0, initialStartTime + deltaT);
      const snapped = Math.round(nextStart * 10) / 10; // 0.1s snapping
      onMoveAudio(id, snapped);
    };

    const onUp = () => {
      if (draggingAudioRef.current) {
        draggingAudioRef.current = null;
        setDraggingAudioId(null);
      }
    };

    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
    return () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    };
  }, [onMoveAudio, pixelsPerSecond]);

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
  const audioTrackHeight = audioLanes.length > 0 ? audioLanes.length * (TRACK_HEIGHT - 10) : 0;
  const totalTracksHeight = TRACK_HEIGHT + audioTrackHeight + (textOverlays.length > 0 ? 32 : 0);

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
                    {/* Insertion marker while dragging */}
                    {draggingVideoId && videoInsertionIndex !== null && (
                      <div
                        className="absolute top-1 bottom-1 w-px bg-primary-400 z-30 pointer-events-none"
                        style={{
                          left: `${videoClips.slice(0, videoInsertionIndex).reduce((sum, c) => {
                            const d = (c.trimEnd || c.duration || 0) - (c.trimStart || 0);
                            return sum + Math.max(0, d);
                          }, 0) * pixelsPerSecond}px`,
                        }}
                      />
                    )}
                    <div className="absolute left-0 top-0 bottom-0 flex">
                      {videoClips.map((clip, index) => {
                        const clipDuration = (clip.trimEnd || clip.duration || 0) - (clip.trimStart || 0);
                        const width = Math.max(clipDuration * pixelsPerSecond, 40);
                        const isSelected = selectedClip?.id === clip.id;
                        const isDragging = draggingVideoId === clip.id;

                        return (
                          <div
                            key={clip.id}
                            className={`relative h-full flex items-center cursor-pointer group transition-all duration-150
                              ${isSelected
                                ? 'bg-primary-600/30 border border-primary-500/60 z-10'
                                : 'bg-dark-600/50 border border-dark-500/30 hover:bg-dark-600/80'
                              }
                              ${isDragging ? 'opacity-80 z-20' : ''}
                              rounded-md mx-0.5
                            `}
                            style={{ width: `${width}px` }}
                            onClick={e => {
                              e.stopPropagation();
                              onSelectClip(clip);
                            }}
                            onContextMenu={e => handleContextMenu(e, clip.id)}
                          >
                            {/* Drag Handle */}
                            <button
                              type="button"
                              className="mx-1 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity cursor-grab active:cursor-grabbing"
                              title="Drag to move"
                              onMouseDown={e => {
                                e.stopPropagation();

                                const ids = videoClips.map(v => v.id);
                                const durations = videoClips.map(v => {
                                  const d = (v.trimEnd || v.duration || 0) - (v.trimStart || 0);
                                  return Math.max(0.001, d);
                                });

                                draggingVideoRef.current = {
                                  clipId: clip.id,
                                  sourceIndex: index,
                                  insertionIndex: index,
                                  videoClipIds: ids,
                                  durations,
                                };
                                setDraggingVideoId(clip.id);
                                setVideoInsertionIndex(index);
                              }}
                            >
                              <GripVertical className="w-3 h-3 text-white/20" />
                            </button>

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
                {audioLanes.length > 0 && (
                  <div className="relative flex border-t border-dark-700" style={{ height: `${audioTrackHeight}px` }}>
                    {/* Track Label Column */}
                    <div
                      className="shrink-0 border-r border-dark-700"
                      style={{ width: `${LABEL_WIDTH}px` }}
                    >
                      {audioLanes.map((_, laneIndex) => (
                        <div
                          key={laneIndex}
                          className="flex items-center justify-center text-[10px] text-white/30 font-medium"
                          style={{ height: `${TRACK_HEIGHT - 10}px` }}
                        >
                          {laneIndex === 0 ? '🎵' : ''}
                        </div>
                      ))}
                    </div>
                    {/* Track Content */}
                    <div className="flex-1 relative">
                      {audioLanes.map((lane, laneIndex) => (
                        <div
                          key={laneIndex}
                          className="relative border-b border-dark-700/50"
                          style={{ height: `${TRACK_HEIGHT - 10}px` }}
                        >
                          {lane.map(clip => {
                            const id = clip.timelineId || clip.id;
                            const startX = (clip.startTime || 0) * pixelsPerSecond;
                            const clipDuration = (clip.trimEnd || clip.duration || 10) - (clip.trimStart || 0);
                            const width = Math.max(clipDuration * pixelsPerSecond, 30);
                            const isSelected = selectedClip?.id === clip.id;
                            const isDragging = draggingAudioId === id;

                            return (
                              <div
                                key={id}
                                className={`absolute h-full rounded-md flex items-center px-2 group cursor-pointer transition-colors ${
                                  isSelected
                                    ? 'bg-emerald-600/30 border border-emerald-400/70'
                                    : 'bg-emerald-600/20 border border-emerald-500/30 hover:bg-emerald-600/25'
                                } ${isDragging ? 'opacity-80' : ''}`}
                                style={{ left: `${startX}px`, width: `${width}px`, top: 0 }}
                                onClick={e => {
                                  e.stopPropagation();
                                  const asset = clips.find(c => c.id === clip.id);
                                  onSelectClip(asset || clip);
                                }}
                                onMouseDown={e => {
                                  if (!onMoveAudio) return;
                                  e.stopPropagation();
                                  draggingAudioRef.current = {
                                    id,
                                    startClientX: e.clientX,
                                    initialStartTime: clip.startTime || 0,
                                  };
                                  setDraggingAudioId(id);
                                }}
                                title="Drag to move in time"
                              >
                                <p className="text-[10px] text-emerald-400/60 truncate">{clip.name}</p>
                                {onRemoveAudio && (
                                  <button
                                    onClick={e => {
                                      e.stopPropagation();
                                      onRemoveAudio(id);
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
                      ))}
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
