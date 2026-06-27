import { useRef, useState, useEffect, useCallback } from 'react';
import { Play, Pause, SkipBack, SkipForward, Maximize, Volume2, VolumeX } from 'lucide-react';
import type { PlaybackRate } from '../types';
import { formatDuration } from '../utils';
import SpeedControl from './SpeedControl';

interface VideoPlayerProps {
  videoUrl: string;
  title: string;
  playbackRate: PlaybackRate;
  onRateChange: (rate: PlaybackRate) => void;
  onTimeUpdate?: (time: number, duration: number) => void;
  onEnded?: () => void;
}

export default function VideoPlayer({
  videoUrl,
  title,
  playbackRate,
  onRateChange,
  onTimeUpdate,
  onEnded,
}: VideoPlayerProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [isMuted, setIsMuted] = useState(false);
  const [showControls, setShowControls] = useState(true);
  const controlsTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const togglePlay = useCallback(() => {
    const video = videoRef.current;
    if (!video) return;

    if (video.paused) {
      video.play();
      setIsPlaying(true);
    } else {
      video.pause();
      setIsPlaying(false);
    }
  }, []);

  const handleTimeUpdate = useCallback(() => {
    const video = videoRef.current;
    if (!video) return;
    setCurrentTime(video.currentTime);
    onTimeUpdate?.(video.currentTime, video.duration);
  }, [onTimeUpdate]);

  const handleLoadedMetadata = useCallback(() => {
    const video = videoRef.current;
    if (!video) return;
    setDuration(video.duration);
  }, []);

  const handleSeek = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const video = videoRef.current;
    if (!video) return;
    const time = parseFloat(e.target.value);
    video.currentTime = time;
    setCurrentTime(time);
  }, []);

  const skip = useCallback((seconds: number) => {
    const video = videoRef.current;
    if (!video) return;
    video.currentTime = Math.max(0, Math.min(video.duration, video.currentTime + seconds));
  }, []);

  const toggleMute = useCallback(() => {
    const video = videoRef.current;
    if (!video) return;
    video.muted = !video.muted;
    setIsMuted(video.muted);
  }, []);

  const toggleFullscreen = useCallback(() => {
    const container = containerRef.current;
    if (!container) return;
    
    if (!document.fullscreenElement) {
      container.requestFullscreen?.();
    } else {
      document.exitFullscreen?.();
    }
  }, []);

  const handleMouseMove = useCallback(() => {
    setShowControls(true);
    if (controlsTimerRef.current) {
      clearTimeout(controlsTimerRef.current);
    }
    controlsTimerRef.current = setTimeout(() => {
      if (videoRef.current && !videoRef.current.paused) {
        setShowControls(false);
      }
    }, 3000);
  }, []);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    video.playbackRate = playbackRate;
  }, [playbackRate]);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    const handlePlay = () => setIsPlaying(true);
    const handlePause = () => setIsPlaying(false);
    const handleEnded = () => {
      setIsPlaying(false);
      onEnded?.();
    };

    video.addEventListener('play', handlePlay);
    video.addEventListener('pause', handlePause);
    video.addEventListener('ended', handleEnded);

    return () => {
      video.removeEventListener('play', handlePlay);
      video.removeEventListener('pause', handlePause);
      video.removeEventListener('ended', handleEnded);
    };
  }, [onEnded]);

  const progressPercent = duration > 0 ? (currentTime / duration) * 100 : 0;

  return (
    <div 
      ref={containerRef}
      className="relative w-full bg-black rounded-3xl overflow-hidden shadow-2xl"
      onMouseMove={handleMouseMove}
      onMouseLeave={() => {
        if (isPlaying) setShowControls(false);
      }}
    >
      <video
        ref={videoRef}
        src={videoUrl}
        className="w-full aspect-video object-contain bg-black"
        onClick={togglePlay}
        onTimeUpdate={handleTimeUpdate}
        onLoadedMetadata={handleLoadedMetadata}
        playsInline
      />

      {!isPlaying && (
        <div 
          className="absolute inset-0 flex items-center justify-center bg-black/30 cursor-pointer"
          onClick={togglePlay}
        >
          <div className="w-24 h-24 bg-white/90 rounded-full flex items-center justify-center shadow-2xl transform hover:scale-110 transition-transform">
            <Play className="w-12 h-12 text-orange-500 ml-2" fill="currentColor" />
          </div>
        </div>
      )}

      <div 
        className={`
          absolute bottom-0 left-0 right-0 
          bg-gradient-to-t from-black/80 via-black/50 to-transparent
          pt-12 pb-4 px-4
          transition-opacity duration-300
          ${showControls ? 'opacity-100' : 'opacity-0'}
        `}
      >
        <div className="mb-3">
          <div className="relative h-3 bg-white/30 rounded-full cursor-pointer group">
            <div 
              className="absolute top-0 left-0 h-full bg-gradient-to-r from-orange-400 to-orange-600 rounded-full transition-all"
              style={{ width: `${progressPercent}%` }}
            />
            <input
              type="range"
              min={0}
              max={duration || 0}
              value={currentTime}
              onChange={handleSeek}
              className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
            />
            <div 
              className="absolute top-1/2 -translate-y-1/2 w-5 h-5 bg-white rounded-full shadow-lg opacity-0 group-hover:opacity-100 transition-opacity"
              style={{ left: `calc(${progressPercent}% - 10px)` }}
            />
          </div>
        </div>

        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button
              onClick={togglePlay}
              className="w-14 h-14 bg-white/20 hover:bg-white/30 rounded-full flex items-center justify-center transition-all hover:scale-110"
            >
              {isPlaying ? (
                <Pause className="w-7 h-7 text-white" fill="currentColor" />
              ) : (
                <Play className="w-7 h-7 text-white ml-1" fill="currentColor" />
              )}
            </button>

            <button
              onClick={() => skip(-10)}
              className="w-12 h-12 bg-white/20 hover:bg-white/30 rounded-full flex items-center justify-center transition-all hover:scale-110"
              title="后退10秒"
            >
              <SkipBack className="w-6 h-6 text-white" />
            </button>

            <button
              onClick={() => skip(10)}
              className="w-12 h-12 bg-white/20 hover:bg-white/30 rounded-full flex items-center justify-center transition-all hover:scale-110"
              title="前进10秒"
            >
              <SkipForward className="w-6 h-6 text-white" />
            </button>

            <button
              onClick={toggleMute}
              className="w-12 h-12 bg-white/20 hover:bg-white/30 rounded-full flex items-center justify-center transition-all hover:scale-110"
            >
              {isMuted ? (
                <VolumeX className="w-6 h-6 text-white" />
              ) : (
                <Volume2 className="w-6 h-6 text-white" />
              )}
            </button>

            <span className="text-white font-medium text-lg">
              {formatDuration(currentTime)} / {formatDuration(duration)}
            </span>
          </div>

          <div className="flex items-center gap-3">
            <div className="text-white text-lg font-bold max-w-xs truncate">
              {title}
            </div>
            <button
              onClick={toggleFullscreen}
              className="w-12 h-12 bg-white/20 hover:bg-white/30 rounded-full flex items-center justify-center transition-all hover:scale-110"
            >
              <Maximize className="w-6 h-6 text-white" />
            </button>
          </div>
        </div>
      </div>

      <div 
        className={`
          absolute top-0 left-0 right-0
          bg-gradient-to-b from-black/60 to-transparent
          p-4 transition-opacity duration-300
          ${showControls ? 'opacity-100' : 'opacity-0'}
        `}
      >
        <h3 className="text-white text-xl font-bold">{title}</h3>
      </div>

      <div className={`mt-6 transition-opacity duration-300 ${showControls ? 'opacity-100' : 'opacity-70'}`}>
        <SpeedControl currentRate={playbackRate} onChange={onRateChange} />
      </div>
    </div>
  );
}
