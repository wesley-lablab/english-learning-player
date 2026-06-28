import { useRef, useState, useEffect, useCallback } from 'react';
import { Play, Pause, SkipBack, SkipForward, Maximize, Volume2, VolumeX, Repeat, Repeat1, Gauge } from 'lucide-react';
import type { PlaybackRate } from '../types';
import { formatDuration } from '../utils';
import { setupMediaSession, updateMediaSessionPlaybackState, updateMediaSessionMetadata } from '../utils/mediaSession';

interface VideoPlayerProps {
  videoUrl: string;
  title: string;
  playbackRate: PlaybackRate;
  onRateChange: (rate: PlaybackRate) => void;
  onTimeUpdate?: (time: number, duration: number) => void;
  onEnded?: () => void;
  loopMode?: 'none' | 'single';
  onLoopModeChange?: (mode: 'none' | 'single') => void;
}

export default function VideoPlayer({
  videoUrl,
  title,
  playbackRate,
  onRateChange,
  onTimeUpdate,
  onEnded,
  loopMode = 'none',
  onLoopModeChange,
}: VideoPlayerProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [isMuted, setIsMuted] = useState(false);
  const [showControls, setShowControls] = useState(true);
  const [showSpeedMenu, setShowSpeedMenu] = useState(false);
  const controlsTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    setupMediaSession(
      title,
      '英语学习视频',
      () => {
        if (videoRef.current) {
          videoRef.current.play();
          setIsPlaying(true);
        }
      },
      () => {
        if (videoRef.current) {
          videoRef.current.pause();
          setIsPlaying(false);
        }
      }
    );
    
    return () => {
      if ('mediaSession' in navigator) {
        try {
          navigator.mediaSession.playbackState = 'none';
        } catch (e) {}
      }
    };
  }, [title]);

  useEffect(() => {
    updateMediaSessionPlaybackState(isPlaying);
  }, [isPlaying]);

  const playbackRates: PlaybackRate[] = [0.5, 0.75, 1, 1.25, 1.5, 2];

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
      if (loopMode === 'single') {
        video.currentTime = 0;
        video.play();
      } else {
        setIsPlaying(false);
        onEnded?.();
      }
    };

    video.addEventListener('play', handlePlay);
    video.addEventListener('pause', handlePause);
    video.addEventListener('ended', handleEnded);

    return () => {
      video.removeEventListener('play', handlePlay);
      video.removeEventListener('pause', handlePause);
      video.removeEventListener('ended', handleEnded);
    };
  }, [onEnded, loopMode]);

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
        onPlay={() => setIsPlaying(true)}
        onPause={() => setIsPlaying(false)}
        onEnded={() => {
          if (loopMode === 'single' && videoRef.current) {
            videoRef.current.currentTime = 0;
            videoRef.current.play();
          } else {
            setIsPlaying(false);
            onEnded?.();
          }
        }}
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

        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-1 sm:gap-2">
            <button
              onClick={togglePlay}
              className="w-9 h-9 sm:w-11 sm:h-11 bg-white/20 hover:bg-white/30 rounded-full flex items-center justify-center transition-all flex-shrink-0"
            >
              {isPlaying ? (
                <Pause className="w-4 h-4 sm:w-5 sm:h-5 text-white" fill="currentColor" />
              ) : (
                <Play className="w-4 h-4 sm:w-5 sm:h-5 text-white ml-0.5" fill="currentColor" />
              )}
            </button>

            <button
              onClick={() => skip(-10)}
              className="w-8 h-8 sm:w-9 sm:h-9 bg-white/20 hover:bg-white/30 rounded-full flex items-center justify-center transition-all flex-shrink-0"
              title="后退10秒"
            >
              <SkipBack className="w-4 h-4 sm:w-4 sm:h-4 text-white" />
            </button>

            <button
              onClick={() => skip(10)}
              className="w-8 h-8 sm:w-9 sm:h-9 bg-white/20 hover:bg-white/30 rounded-full flex items-center justify-center transition-all flex-shrink-0"
              title="前进10秒"
            >
              <SkipForward className="w-4 h-4 sm:w-4 sm:h-4 text-white" />
            </button>

            <button
              onClick={toggleMute}
              className="w-8 h-8 sm:w-9 sm:h-9 bg-white/20 hover:bg-white/30 rounded-full flex items-center justify-center transition-all flex-shrink-0"
            >
              {isMuted ? (
                <VolumeX className="w-4 h-4 sm:w-4 sm:h-4 text-white" />
              ) : (
                <Volume2 className="w-4 h-4 sm:w-4 sm:h-4 text-white" />
              )}
            </button>

            <button
              onClick={() => {
                if (!onLoopModeChange) return;
                const nextMode = loopMode === 'none' ? 'single' : 'none';
                onLoopModeChange(nextMode);
              }}
              className={`w-8 h-8 sm:w-9 sm:h-9 rounded-full flex items-center justify-center transition-all flex-shrink-0 ${
                loopMode === 'single' 
                  ? 'bg-orange-500 text-white' 
                  : 'bg-white/20 hover:bg-white/30 text-white'
              }`}
              title={loopMode === 'single' ? '循环播放中' : '循环播放'}
            >
              {loopMode === 'single' ? (
                <Repeat1 className="w-4 h-4 sm:w-4 sm:h-4" />
              ) : (
                <Repeat className="w-4 h-4 sm:w-4 sm:h-4" />
              )}
            </button>

            <div className="relative flex-shrink-0">
              <button
                onClick={() => setShowSpeedMenu(!showSpeedMenu)}
                className="w-8 h-8 sm:w-9 sm:h-9 bg-white/20 hover:bg-white/30 rounded-full flex items-center justify-center transition-all text-white"
                title="播放速度"
              >
                <Gauge className="w-4 h-4 sm:w-4 sm:h-4" />
              </button>
              
              {showSpeedMenu && (
                <div className="absolute bottom-10 left-0 bg-black/90 rounded-xl p-2 shadow-xl z-20 min-w-[100px]">
                  {playbackRates.map((rate) => (
                    <button
                      key={rate}
                      onClick={() => {
                        onRateChange(rate);
                        setShowSpeedMenu(false);
                      }}
                      className={`w-full text-left px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                        rate === playbackRate
                          ? 'bg-orange-500 text-white'
                          : 'text-white/80 hover:bg-white/20'
                      }`}
                    >
                      {rate}x
                    </button>
                  ))}
                </div>
              )}
            </div>

            <span className="text-white text-xs sm:text-sm font-medium whitespace-nowrap">
              {formatDuration(currentTime)}
            </span>
          </div>

          <div className="flex items-center gap-2 flex-shrink-0">
            <button
              onClick={toggleFullscreen}
              className="w-8 h-8 sm:w-9 sm:h-9 bg-white/20 hover:bg-white/30 rounded-full flex items-center justify-center transition-all"
            >
              <Maximize className="w-4 h-4 sm:w-4 sm:h-4 text-white" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
