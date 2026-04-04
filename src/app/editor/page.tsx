'use client';

import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { v4 as uuidv4 } from 'uuid';
import Toast from '@/components/editor/Toast';
import Toolbar from '@/components/editor/Toolbar';
import VideoPlayer from '@/components/editor/VideoPlayer';
import CodeEditor from '@/components/editor/CodeEditor';
import AssetPanel from '@/components/editor/AssetPanel';
import PropertiesPanel from '@/components/editor/PropertiesPanel';
import Timeline from '@/components/editor/Timeline';
import ChatPrompt from '@/components/editor/ChatPrompt';
import {
  generateVideo,
  getCodeFile,
  renderManim,
  downloadVideo,
  getOrCreateSessionId,
  type Clip,
  type TextOverlay,
  type GeneratingTask,
  type ExportSettings,
} from '@/lib/api';

export default function EditorPage() {
  const [sessionId] = useState(() => getOrCreateSessionId());
  const [currentVideo, setCurrentVideo] = useState<string | null>(null);
  const [currentCode, setCurrentCode] = useState('');
  const [clips, setClips] = useState<Clip[]>([]);
  const [audioClips, setAudioClips] = useState<Clip[]>([]);
  const [textOverlays, setTextOverlays] = useState<TextOverlay[]>([]);
  const [selectedClip, setSelectedClip] = useState<Clip | null>(null);
  const [selectedTextOverlay, setSelectedTextOverlay] = useState<TextOverlay | null>(null);
  const [isRendering, setIsRendering] = useState(false);
  const [toast, setToast] = useState<{ message: string; type: 'info' | 'success' | 'error' | 'warning' } | null>(null);
  const [currentTime, setCurrentTime] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [seekToTime, setSeekToTime] = useState<number | null>(null);

  // Generation tracking
  const [generatingTasks, setGeneratingTasks] = useState<GeneratingTask[]>([]);
  const [isGenerating, setIsGenerating] = useState(false);
  const [generationProgress, setGenerationProgress] = useState(0);
  const [generationMessage, setGenerationMessage] = useState('');

  // Layout state
  const [playerHeight, setPlayerHeight] = useState(350);
  const [showCodeEditor, setShowCodeEditor] = useState(true);
  const [showRightPanel, setShowRightPanel] = useState(true);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isCodeEditorFullscreen, setIsCodeEditorFullscreen] = useState(false);
  const [leftPanelSplit, setLeftPanelSplit] = useState(55); // percentage for ChatPrompt
  const leftPanelDragging = useRef(false);
  const leftPanelRef = useRef<HTMLDivElement>(null);

  // Check if selected clip is trimmed
  const isSelectedClipTrimmed = useMemo(() => {
    if (!selectedClip || selectedClip.type !== 'video') return false;
    const hasTrimStart = selectedClip.trimStart > 0;
    const hasTrimEnd = selectedClip.duration > 0 && selectedClip.trimEnd > 0 && selectedClip.trimEnd < selectedClip.duration;
    return hasTrimStart || hasTrimEnd;
  }, [selectedClip]);

  const displayCode = useMemo(() => {
    if (isSelectedClipTrimmed) return '';
    return currentCode;
  }, [currentCode, isSelectedClipTrimmed]);

  const showToast = useCallback((message: string, type: 'info' | 'success' | 'error' | 'warning' = 'info') => {
    setToast({ message, type });
  }, []);

  const hideToast = useCallback(() => {
    setToast(null);
  }, []);

  const selectedClipId = selectedClip?.id;

  const handleCodeChange = useCallback((code: string) => {
    setCurrentCode(code);
    if (!selectedClipId) return;
    setClips(prev => prev.map(c => (c.id === selectedClipId ? { ...c, code } : c)));
  }, [selectedClipId]);

  // Keep selectedClip reference up-to-date when clips are updated (trim/duration/name/code, etc.)
  useEffect(() => {
    if (!selectedClip) return;
    const updated = clips.find(c => c.id === selectedClip.id);
    if (!updated) {
      setSelectedClip(null);
      return;
    }
    if (updated !== selectedClip) setSelectedClip(updated);
  }, [clips, selectedClip]);

  const clipsRef = useRef<Clip[]>([]);
  const audioClipsRef = useRef<Clip[]>([]);

  useEffect(() => {
    clipsRef.current = clips;
  }, [clips]);

  useEffect(() => {
    audioClipsRef.current = audioClips;
  }, [audioClips]);

  const revokeBlobUrl = useCallback((url?: string) => {
    if (!url || !url.startsWith('blob:')) return;
    try {
      URL.revokeObjectURL(url);
    } catch {
      // ignore
    }
  }, []);

  const maybeRevokeClipBlobUrls = useCallback((
    clip: Clip | undefined,
    remainingClips: Clip[],
    remainingAudio: Clip[]
  ) => {
    if (!clip) return;

    const videoUrl = clip.videoUrl;
    if (videoUrl && videoUrl.startsWith('blob:')) {
      const stillUsed =
        remainingClips.some(c => c.videoUrl === videoUrl) ||
        remainingAudio.some(c => c.videoUrl === videoUrl);
      if (!stillUsed) revokeBlobUrl(videoUrl);
    }

    const audioUrl = clip.audioPath;
    if (audioUrl && audioUrl.startsWith('blob:')) {
      const stillUsed =
        remainingClips.some(c => c.audioPath === audioUrl) ||
        remainingAudio.some(c => c.audioPath === audioUrl);
      if (!stillUsed) revokeBlobUrl(audioUrl);
    }
  }, [revokeBlobUrl]);

  useEffect(() => {
    return () => {
      const urlsToRevoke = new Set<string>();
      for (const clip of [...clipsRef.current, ...audioClipsRef.current]) {
        if (clip.videoUrl?.startsWith('blob:')) urlsToRevoke.add(clip.videoUrl);
        if (clip.audioPath?.startsWith('blob:')) urlsToRevoke.add(clip.audioPath);
      }
      urlsToRevoke.forEach(url => revokeBlobUrl(url));
    };
  }, [revokeBlobUrl]);

  // Handle keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (isFullscreen) setIsFullscreen(false);
        if (isCodeEditorFullscreen) setIsCodeEditorFullscreen(false);
      }
      // Space bar → play/pause
      if (e.key === ' ' && !['INPUT', 'TEXTAREA', 'SELECT'].includes((document.activeElement?.tagName || ''))) {
        e.preventDefault();
        if (currentVideo) {
          setIsPlaying(prev => !prev);
        }
      }
      if (e.key === 'Delete' && !['INPUT', 'TEXTAREA', 'SELECT'].includes((document.activeElement?.tagName || ''))) {
        if (selectedClip) {
          handleRemoveClip(selectedClip.id);
          setSelectedClip(null);
          if (selectedClip.type === 'video') setCurrentVideo(null);
        }
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isFullscreen, isCodeEditorFullscreen, selectedClip, currentVideo]);

  // AI video generation
  const handleGenerateVideo = useCallback(async (prompt: string) => {
    setIsGenerating(true);
    setGenerationProgress(0);
    setGenerationMessage('Starting...');

    const taskId = uuidv4();
    setGeneratingTasks(prev => [
      ...prev,
      {
        taskId,
        prompt,
        status: 'generating',
        message: 'Sending to AI...',
        progress: 0,
      },
    ]);

    try {
      const result = await generateVideo(prompt, sessionId, (progress, message) => {
        setGenerationProgress(progress);
        setGenerationMessage(message);
        setGeneratingTasks(prev =>
          prev.map(t =>
            t.taskId === taskId ? { ...t, progress, message, status: 'generating' } : t
          )
        );
      });

      // Remove from generating tasks
      setGeneratingTasks(prev => prev.filter(t => t.taskId !== taskId));

      if (result.success && result.videoUrl) {
        let clipCode = '';
        const codeFilename = result.codeFilename || '';

        // Fetch code if available
        if (codeFilename) {
          try {
            const codeResult = await getCodeFile(codeFilename);
            if (codeResult.success && codeResult.code) {
              clipCode = codeResult.code;
            }
          } catch {
            // Code fetch is optional
          }
        }

        // Add to clips
        const newClip: Clip = {
          id: uuidv4(),
          type: 'video',
          source: 'backend',
          videoUrl: result.videoUrl,
          code: clipCode || undefined,
          codeFilename: codeFilename || undefined,
          name: `Generated: ${prompt.substring(0, 30)}...`,
          duration: 0,
          trimStart: 0,
          trimEnd: 0,
        };

        setClips(prev => [...prev, newClip]);
        setSelectedClip(newClip);
        setCurrentVideo(result.videoUrl);
        setCurrentCode(clipCode);
        showToast('Video generated successfully!', 'success');
      } else {
        showToast(`Failed to generate video: ${result.error}`, 'error');
      }
    } catch (error: unknown) {
      setGeneratingTasks(prev => prev.filter(t => t.taskId !== taskId));
      showToast(`Error: ${(error as Error).message}`, 'error');
    } finally {
      setIsGenerating(false);
    }
  }, [sessionId, showToast]);

  // Cancel generation
  const handleCancelGeneration = useCallback((taskId: string) => {
    setGeneratingTasks(prev => prev.filter(t => t.taskId !== taskId));
    showToast('Generation cancelled', 'info');
  }, [showToast]);

  // Render code
  const handleRenderCode = useCallback(async (code: string, sceneName: string = 'Scene1') => {
    setIsRendering(true);
    const taskId = uuidv4();
    setGeneratingTasks(prev => [
      ...prev,
      {
        taskId,
        prompt: `Render: ${sceneName}`,
        status: 'rendering',
        message: 'Starting render...',
        progress: 0,
        isRender: true,
      },
    ]);

    try {
      const result = await renderManim(code, sceneName, (progress, message) => {
        setGeneratingTasks(prev =>
          prev.map(t =>
            t.taskId === taskId ? { ...t, progress, message } : t
          )
        );
      });

      setGeneratingTasks(prev => prev.filter(t => t.taskId !== taskId));

      if (result.success && result.videoUrl) {
        const newClip: Clip = {
          id: uuidv4(),
          type: 'video',
          source: 'backend',
          videoUrl: result.videoUrl,
          code,
          name: `Rendered: ${sceneName}`,
          duration: 0,
          trimStart: 0,
          trimEnd: 0,
        };

        setClips(prev => [...prev, newClip]);
        setSelectedClip(newClip);
        setCurrentVideo(result.videoUrl);
        setCurrentCode(code);
        showToast(`Rendered scene: ${sceneName}`, 'success');
      } else {
        showToast(`Render failed: ${result.error}`, 'error');
      }
    } catch (error: unknown) {
      setGeneratingTasks(prev => prev.filter(t => t.taskId !== taskId));
      showToast(`Render error: ${(error as Error).message}`, 'error');
    } finally {
      setIsRendering(false);
    }
  }, [showToast]);

  // Clip management
  const handleAddClip = useCallback((clip: Partial<Clip>) => {
    const newClip: Clip = {
      id: uuidv4(),
      type: clip.type || 'video',
      source: clip.source || 'upload',
      videoUrl: clip.videoUrl,
      audioPath: clip.audioPath,
      name: clip.name || 'Untitled',
      duration: clip.duration || 0,
      trimStart: clip.trimStart || 0,
      trimEnd: clip.trimEnd || 0,
    };
    setClips(prev => [...prev, newClip]);
    showToast(`Added: ${newClip.name}`, 'success');
  }, [showToast]);

  const handleRemoveClip = useCallback((clipId: string) => {
    const removedClip = clips.find(c => c.id === clipId);
    const remainingClips = clips.filter(c => c.id !== clipId);
    setClips(remainingClips);

    maybeRevokeClipBlobUrls(removedClip, remainingClips, audioClips);

    if (selectedClip?.id === clipId) {
      setSelectedClip(null);
      setCurrentVideo(null);
      setCurrentCode('');
    }
    if (removedClip) showToast(`Removed: ${removedClip.name}`, 'info');
  }, [audioClips, clips, maybeRevokeClipBlobUrls, selectedClip, showToast]);

  const handleSelectClip = useCallback((clip: Clip | null) => {
    if (clip) {
      setSelectedClip(clip);
      if (clip.type === 'video') {
        setCurrentVideo(clip.videoUrl || clip.videoPath || null);
      }
      setCurrentCode(clip.code || '');
    } else {
      setSelectedClip(null);
      setCurrentCode('');
    }
  }, []);

  const handleRemoveAsset = useCallback((assetId: string, assetType: string) => {
    const removedClip = clips.find(c => c.id === assetId);
    const remainingClips = clips.filter(c => c.id !== assetId);
    setClips(remainingClips);

    const remainingAudio =
      assetType === 'audio'
        ? audioClips.filter(a => a.id !== assetId && a.timelineId !== assetId)
        : audioClips;

    if (assetType === 'audio') setAudioClips(remainingAudio);

    maybeRevokeClipBlobUrls(removedClip, remainingClips, remainingAudio);

    if (selectedClip?.id === assetId) {
      setSelectedClip(null);
      if (assetType === 'video') setCurrentVideo(null);
      setCurrentCode('');
    }
    if (removedClip) showToast(`Removed: ${removedClip.name}`, 'info');
  }, [audioClips, clips, maybeRevokeClipBlobUrls, selectedClip, showToast]);

  // Duration change from player
  const handleDurationChange = useCallback((clipId: string, duration: number) => {
    setClips(prev =>
      prev.map(c => {
        if (c.id === clipId) {
          const newClip = { ...c, duration };
          if (!c.trimEnd || c.trimEnd === 0) newClip.trimEnd = duration;
          if (c.trimStart === undefined) newClip.trimStart = 0;
          return newClip;
        }
        return c;
      })
    );
  }, []);

  // Trim/split
  const handleTrimClip = useCallback((clipId: string, trimStart: number, trimEnd: number) => {
    setClips(prev => prev.map(c => (c.id === clipId ? { ...c, trimStart, trimEnd } : c)));
  }, []);

  const handleSplitClip = useCallback((clipId: string, splitTime: number) => {
    setClips(prev => {
      const clipIndex = prev.findIndex(c => c.id === clipId);
      if (clipIndex === -1) return prev;
      const clip = prev[clipIndex];
      const firstPart: Clip = {
        ...clip,
        id: uuidv4(),
        name: clip.name.replace(/ \(part \d+\)$/, '') + ' (part 1)',
        trimEnd: splitTime,
      };
      const secondPart: Clip = {
        ...clip,
        id: uuidv4(),
        name: clip.name.replace(/ \(part \d+\)$/, '') + ' (part 2)',
        trimStart: splitTime,
      };
      const newClips = [...prev];
      newClips.splice(clipIndex, 1, firstPart, secondPart);
      return newClips;
    });
    showToast('Clip split into two parts', 'success');
  }, [showToast]);

  // Text overlays
  const handleAddText = useCallback((textData: Partial<TextOverlay>) => {
    const newText: TextOverlay = {
      id: uuidv4(),
      text: textData.text || 'Text',
      startTime: textData.startTime || 0,
      duration: textData.duration || 3,
      x: textData.x ?? 50,
      y: textData.y ?? 50,
      fontSize: textData.fontSize || 32,
      color: textData.color || '#ffffff',
    };
    setTextOverlays(prev => [...prev, newText]);
    showToast(`Added text: "${newText.text.substring(0, 20)}"`, 'success');
  }, [showToast]);

  const handleUpdateTextOverlay = useCallback((textId: string, updates: Partial<TextOverlay>) => {
    setTextOverlays(prev => prev.map(t => (t.id === textId ? { ...t, ...updates } : t)));
    setSelectedTextOverlay(prev => (prev?.id === textId ? { ...prev, ...updates } : prev));
  }, []);

  const handleRemoveText = useCallback((textId: string) => {
    setTextOverlays(prev => prev.filter(t => t.id !== textId));
    if (selectedTextOverlay?.id === textId) setSelectedTextOverlay(null);
    showToast('Text overlay removed', 'info');
  }, [selectedTextOverlay, showToast]);

  const handleSelectText = useCallback((textId: string) => {
    const text = textOverlays.find(t => t.id === textId);
    setSelectedTextOverlay(text || null);
  }, [textOverlays]);

  // Timeline
  const handleSeek = useCallback((globalTime: number) => {
    setCurrentTime(globalTime);
    const videoClips = clips.filter(c => c.type === 'video');
    let accumulatedTime = 0;
    for (const clip of videoClips) {
      const clipDuration = (clip.trimEnd || clip.duration || 0) - (clip.trimStart || 0);
      if (globalTime < accumulatedTime + clipDuration) {
        const localTime = (clip.trimStart || 0) + (globalTime - accumulatedTime);
        if (selectedClip?.id !== clip.id) {
          setSelectedClip(clip);
          setCurrentVideo(clip.videoUrl || clip.videoPath || null);
          setCurrentCode(clip.code || '');
        }
        setSeekToTime(localTime);
        return;
      }
      accumulatedTime += clipDuration;
    }
  }, [clips, selectedClip]);

  const getClipTimelineStart = useCallback((clipId: string): number => {
    const videoClips = clips.filter(c => c.type === 'video');
    let accumulatedTime = 0;
    for (const clip of videoClips) {
      if (clip.id === clipId) return accumulatedTime;
      accumulatedTime += (clip.trimEnd || clip.duration || 0) - (clip.trimStart || 0);
    }
    return 0;
  }, [clips]);

  const handleTimeUpdate = useCallback((localTime: number, clipId?: string) => {
    if (!clipId) {
      setCurrentTime(localTime);
      return;
    }
    const timelineStart = getClipTimelineStart(clipId);
    const clip = clips.find(c => c.id === clipId);
    if (clip) {
      const relativeTime = localTime - (clip.trimStart || 0);
      setCurrentTime(timelineStart + relativeTime);
    }
  }, [getClipTimelineStart, clips]);

  const handlePlayStateChange = useCallback((playing: boolean) => {
    setIsPlaying(playing);
  }, []);

  const handleClipEnded = useCallback((nextClip: Clip) => {
    setSelectedClip(nextClip);
    setCurrentVideo(nextClip.videoUrl || nextClip.videoPath || null);
    setCurrentCode(nextClip.code || '');
  }, []);

  // Export
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const handleExport = useCallback((_settings: ExportSettings) => {
    if (!currentVideo) {
      showToast('No video to export', 'error');
      return;
    }
    downloadVideo(currentVideo, `manim_export_${Date.now()}.mp4`);
    showToast('Video download started!', 'success');
  }, [currentVideo, showToast]);

  // Player resize
  const handlePlayerResize = useCallback((deltaY: number) => {
    setPlayerHeight(prev => {
      const maxH = window.innerHeight - 350;
      return Math.max(150, Math.min(maxH, prev + deltaY));
    });
  }, []);

  const toggleFullscreen = useCallback(() => setIsFullscreen(prev => !prev), []);
  const toggleCodeEditor = useCallback(() => setShowCodeEditor(prev => !prev), []);
  const toggleRightPanel = useCallback(() => setShowRightPanel(prev => !prev), []);

  // Left panel split resize
  const handleLeftPanelDragStart = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    leftPanelDragging.current = true;
    document.body.style.cursor = 'row-resize';
    document.body.style.userSelect = 'none';
  }, []);

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!leftPanelDragging.current || !leftPanelRef.current) return;
      const rect = leftPanelRef.current.getBoundingClientRect();
      const pct = ((e.clientY - rect.top) / rect.height) * 100;
      setLeftPanelSplit(Math.max(20, Math.min(80, pct)));
    };
    const handleMouseUp = () => {
      leftPanelDragging.current = false;
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    };
    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, []);

  return (
    <div className="flex flex-col h-screen bg-dark-900 text-white">
      {/* Toast */}
      {toast && <Toast message={toast.message} type={toast.type} onClose={hideToast} />}

      {/* Fullscreen Video Overlay */}
      {isFullscreen && (
        <div className="fixed inset-0 bg-black z-50 flex flex-col">
          <VideoPlayer
            videoUrl={currentVideo}
            selectedClip={selectedClip}
            onDurationChange={handleDurationChange}
            onTimeUpdate={handleTimeUpdate}
            onPlayStateChange={handlePlayStateChange}
            currentTime={currentTime}
            textOverlays={textOverlays}
            isPlaying={isPlaying}
            clips={clips}
            onClipEnded={handleClipEnded}
            seekToTime={seekToTime}
            onSeekComplete={() => setSeekToTime(null)}
            playerHeight={window.innerHeight}
            onResize={() => {}}
            onToggleFullscreen={toggleFullscreen}
            isFullscreen={true}
            showCodeEditor={false}
            onToggleCodeEditor={() => {}}
            showRightPanel={false}
            onToggleRightPanel={() => {}}
            onUpdateTextOverlay={handleUpdateTextOverlay}
            selectedTextId={selectedTextOverlay?.id}
          />
        </div>
      )}

      {/* Code Editor Fullscreen */}
      {isCodeEditorFullscreen && (
        <div className="fixed inset-0 bg-dark-900 z-50 flex flex-col">
          <CodeEditor
            code={displayCode}
            onChange={isSelectedClipTrimmed ? undefined : handleCodeChange}
            onRender={handleRenderCode}
            isRendering={isRendering}
            isFullscreen={true}
            onToggleFullscreen={() => setIsCodeEditorFullscreen(false)}
            readOnly={isSelectedClipTrimmed}
            placeholder={isSelectedClipTrimmed ? 'Code not available for trimmed clips' : undefined}
          />
        </div>
      )}

      {/* Toolbar */}
      <Toolbar onExport={handleExport} isRendering={isRendering} />

      {/* Main Content */}
      <div className="flex flex-1 min-h-0 overflow-hidden">
        {/* Left Panel - AI Chat + Assets */}
        <div ref={leftPanelRef} className="w-64 flex flex-col border-r border-dark-700 shrink-0">
          {/* Chat Prompt */}
          <div className="overflow-hidden" style={{ height: `${leftPanelSplit}%`, minHeight: '120px' }}>
            <ChatPrompt
              onGenerateVideo={handleGenerateVideo}
              isGenerating={isGenerating}
              generationProgress={generationProgress}
              generationMessage={generationMessage}
            />
          </div>
          {/* Resize Handle */}
          <div
            className="h-1.5 cursor-row-resize bg-dark-700 hover:bg-primary-500/40 transition-colors shrink-0 flex items-center justify-center"
            onMouseDown={handleLeftPanelDragStart}
          >
            <div className="w-8 h-0.5 bg-white/10 rounded-full" />
          </div>
          {/* Assets */}
          <div className="flex-1 min-h-[120px] overflow-hidden border-t border-dark-700">
            <AssetPanel
              clips={clips}
              selectedClip={selectedClip}
              onAddClip={handleAddClip}
              onSelectClip={handleSelectClip}
              onRemoveAsset={handleRemoveAsset}
              generatingTasks={generatingTasks}
              onCancelGeneration={handleCancelGeneration}
            />
          </div>
        </div>

        {/* Center Panel */}
        <div className="flex-1 flex flex-col min-w-0 min-h-0 overflow-hidden">
          {/* Video Player */}
          <div
            className={`relative z-10 overflow-hidden ${showCodeEditor ? 'flex-shrink-0' : 'flex-1'}`}
            style={showCodeEditor ? { height: `${playerHeight}px`, minHeight: '150px' } : { minHeight: '150px' }}
          >
            <VideoPlayer
              videoUrl={currentVideo}
              selectedClip={selectedClip}
              onDurationChange={handleDurationChange}
              onTimeUpdate={handleTimeUpdate}
              onPlayStateChange={handlePlayStateChange}
              currentTime={currentTime}
              textOverlays={textOverlays}
              isPlaying={isPlaying}
              clips={clips}
              onClipEnded={handleClipEnded}
              seekToTime={seekToTime}
              onSeekComplete={() => setSeekToTime(null)}
              playerHeight={playerHeight}
              onResize={handlePlayerResize}
              onToggleFullscreen={toggleFullscreen}
              isFullscreen={isFullscreen}
              showCodeEditor={showCodeEditor}
              onToggleCodeEditor={toggleCodeEditor}
              showRightPanel={showRightPanel}
              onToggleRightPanel={toggleRightPanel}
              onUpdateTextOverlay={handleUpdateTextOverlay}
              selectedTextId={selectedTextOverlay?.id}
            />
          </div>

          {/* Code Editor */}
          {showCodeEditor && (
            <div className="flex-1 min-h-[200px] overflow-hidden border-t border-dark-700">
              <CodeEditor
                code={displayCode}
                onChange={isSelectedClipTrimmed ? undefined : handleCodeChange}
                onRender={handleRenderCode}
                isRendering={isRendering}
                isFullscreen={false}
                onToggleFullscreen={() => setIsCodeEditorFullscreen(true)}
                readOnly={isSelectedClipTrimmed}
                placeholder={isSelectedClipTrimmed ? 'Code not available for trimmed clips' : undefined}
              />
            </div>
          )}
        </div>

        {/* Right Panel - Properties */}
        {showRightPanel && (
          <PropertiesPanel
            selectedClip={selectedClip}
            onUpdateClip={(clip: Clip) => setClips(prev => prev.map(c => (c.id === clip.id ? clip : c)))}
            onAddText={handleAddText}
            currentTime={currentTime}
            selectedTextOverlay={selectedTextOverlay}
            onUpdateText={(text: TextOverlay) => setTextOverlays(prev => prev.map(t => (t.id === text.id ? text : t)))}
            onSelectText={handleSelectText}
            onRemoveText={handleRemoveText}
            textOverlays={textOverlays}
          />
        )}
      </div>

      {/* Timeline */}
      <Timeline
        clips={clips}
        selectedClip={selectedClip}
        onSelectClip={handleSelectClip}
        onRemoveClip={handleRemoveClip}
        onReorderClips={setClips}
        audioClips={audioClips}
        textOverlays={textOverlays}
        onTrimClip={handleTrimClip}
        onSplitClip={handleSplitClip}
        onRemoveAudio={(audioId: string) => {
          setAudioClips(prev => prev.filter(a => a.timelineId !== audioId));
          showToast('Audio removed from timeline', 'info');
        }}
        onRemoveText={handleRemoveText}
        onSelectText={handleSelectText}
        currentTime={currentTime}
        onSeek={handleSeek}
      />
    </div>
  );
}
