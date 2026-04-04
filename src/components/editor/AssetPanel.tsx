'use client';

import { useState, useCallback } from 'react';
import { Video, Music, Upload, Trash2, Loader2, X, ChevronDown, ChevronUp } from 'lucide-react';
import type { Clip, GeneratingTask } from '@/lib/api';
import { createBlobFromFile } from '@/lib/api';

interface AssetPanelProps {
  clips: Clip[];
  selectedClip: Clip | null;
  onAddClip: (clip: Partial<Clip>) => void;
  onSelectClip: (clip: Clip) => void;
  onRemoveAsset: (assetId: string, assetType: string) => void;
  generatingTasks: GeneratingTask[];
  onCancelGeneration: (taskId: string) => void;
}

export default function AssetPanel({
  clips,
  selectedClip,
  onAddClip,
  onSelectClip,
  onRemoveAsset,
  generatingTasks,
  onCancelGeneration,
}: AssetPanelProps) {
  const [showVideos, setShowVideos] = useState(true);
  const [showAudio, setShowAudio] = useState(true);

  const videoClips = clips.filter(c => c.type === 'video');
  const audioClips = clips.filter(c => c.type === 'audio');

  const handleFileUpload = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;
    
    for (const file of Array.from(files)) {
      const url = await createBlobFromFile(file);
      const isAudio = file.type.startsWith('audio/');
      
      onAddClip({
        type: isAudio ? 'audio' : 'video',
        source: 'upload',
        videoUrl: isAudio ? undefined : url,
        audioPath: isAudio ? url : undefined,
        name: file.name,
        duration: 0,
        trimStart: 0,
        trimEnd: 0,
      });
    }
    // Reset input
    e.target.value = '';
  }, [onAddClip]);

  return (
    <div className="w-full bg-dark-800 flex flex-col overflow-hidden">
      {/* Header */}
      <div className="px-3 py-3 border-b border-dark-700">
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-xs font-semibold text-white/60 uppercase tracking-wider">Assets</h3>
          <label className="btn-ghost p-1.5 rounded cursor-pointer" title="Upload Media">
            <Upload className="w-3.5 h-3.5" />
            <input
              type="file"
              accept="video/*,audio/*"
              multiple
              onChange={handleFileUpload}
              className="hidden"
            />
          </label>
        </div>
      </div>

      {/* Generating Tasks */}
      {generatingTasks.length > 0 && (
        <div className="px-3 py-2 border-b border-dark-700 space-y-2">
          {generatingTasks.map(task => (
            <div key={task.taskId} className="bg-dark-700 rounded-lg p-2.5 animate-pulse-glow">
              <div className="flex items-center justify-between mb-1.5">
                <div className="flex items-center gap-1.5">
                  <Loader2 className="w-3 h-3 animate-spin text-primary-400" />
                  <span className="text-[10px] text-white/70 truncate max-w-[120px]">
                    {task.prompt}
                  </span>
                </div>
                <button
                  onClick={() => onCancelGeneration(task.taskId)}
                  className="text-white/30 hover:text-red-400 transition-colors"
                >
                  <X className="w-3 h-3" />
                </button>
              </div>
              <div className="w-full h-1 bg-dark-600 rounded-full overflow-hidden">
                <div
                  className="h-full bg-primary-500 rounded-full transition-all duration-300"
                  style={{ width: `${task.progress}%` }}
                />
              </div>
              <p className="text-[9px] text-white/40 mt-1">{task.message}</p>
            </div>
          ))}
        </div>
      )}

      {/* Scrollable content */}
      <div className="flex-1 overflow-y-auto">
        {/* Video Clips */}
        <div>
          <button
            onClick={() => setShowVideos(!showVideos)}
            className="w-full flex items-center justify-between px-3 py-2 hover:bg-dark-700/30 transition-colors"
          >
            <div className="flex items-center gap-1.5">
              <Video className="w-3 h-3 text-primary-400" />
              <span className="text-xs font-medium text-white/70">Videos ({videoClips.length})</span>
            </div>
            {showVideos ? <ChevronUp className="w-3 h-3 text-white/30" /> : <ChevronDown className="w-3 h-3 text-white/30" />}
          </button>

          {showVideos && (
            <div className="px-2 pb-2 space-y-1">
              {videoClips.length === 0 && (
                <p className="text-[10px] text-white/20 px-2 py-3 text-center">
                  No videos yet. Generate one using AI!
                </p>
              )}
              {videoClips.map(clip => (
                <div
                  key={clip.id}
                  onClick={() => onSelectClip(clip)}
                  className={`group flex items-center gap-2 px-2.5 py-2 rounded-lg cursor-pointer transition-colors ${
                    selectedClip?.id === clip.id
                      ? 'bg-primary-600/15 border-l-2 border-l-primary-500'
                      : 'hover:bg-dark-700/50'
                  }`}
                >
                  <div className="w-10 h-7 bg-dark-600 rounded flex items-center justify-center shrink-0">
                    <Video className="w-3.5 h-3.5 text-white/30" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-[11px] text-white/80 truncate">{clip.name}</p>
                    <p className="text-[9px] text-white/30">{clip.source}</p>
                  </div>
                  <button
                    onClick={e => {
                      e.stopPropagation();
                      onRemoveAsset(clip.id, 'video');
                    }}
                    className="opacity-0 group-hover:opacity-100 text-white/30 hover:text-red-400 transition-all"
                  >
                    <Trash2 className="w-3 h-3" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Audio Clips */}
        <div>
          <button
            onClick={() => setShowAudio(!showAudio)}
            className="w-full flex items-center justify-between px-3 py-2 hover:bg-dark-700/30 transition-colors"
          >
            <div className="flex items-center gap-1.5">
              <Music className="w-3 h-3 text-emerald-400" />
              <span className="text-xs font-medium text-white/70">Audio ({audioClips.length})</span>
            </div>
            {showAudio ? <ChevronUp className="w-3 h-3 text-white/30" /> : <ChevronDown className="w-3 h-3 text-white/30" />}
          </button>

          {showAudio && (
            <div className="px-2 pb-2 space-y-1">
              {audioClips.length === 0 && (
                <p className="text-[10px] text-white/20 px-2 py-3 text-center">
                  Upload audio files to add to timeline
                </p>
              )}
              {audioClips.map(clip => (
                <div
                  key={clip.id}
                  onClick={() => onSelectClip(clip)}
                  className={`group flex items-center gap-2 px-2.5 py-2 rounded-lg cursor-pointer transition-colors ${
                    selectedClip?.id === clip.id
                      ? 'bg-primary-600/15 border-l-2 border-l-primary-500'
                      : 'hover:bg-dark-700/50'
                  }`}
                >
                  <div className="w-10 h-7 bg-dark-600 rounded flex items-center justify-center shrink-0">
                    <Music className="w-3.5 h-3.5 text-emerald-400/30" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-[11px] text-white/80 truncate">{clip.name}</p>
                  </div>
                  <button
                    onClick={e => {
                      e.stopPropagation();
                      onRemoveAsset(clip.id, 'audio');
                    }}
                    className="opacity-0 group-hover:opacity-100 text-white/30 hover:text-red-400 transition-all"
                  >
                    <Trash2 className="w-3 h-3" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
