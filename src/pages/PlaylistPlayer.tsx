import { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Play, Pause, SkipBack, SkipForward, Repeat, Repeat1, Home, ChevronLeft, ChevronRight, Volume2 } from 'lucide-react';
import type { Video, LoopMode } from '../types';
import { storageApi } from '../utils/storage';
import { updateMediaSessionMetadata } from '../utils/mediaSession';

type PlaylistLoopMode = 'none' | 'single' | 'all';

export default function PlaylistPlayer() {
  const navigate = useNavigate();
  const location = useLocation();
  const videoRef = useRef<HTMLVideoElement>(null);
  const audioRef = useRef<HTMLAudioElement>(null);
  
  const [videos, setVideos] = useState<Video[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [loopMode, setLoopMode] = useState<PlaylistLoopMode>('none');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [useAudio, setUseAudio] = useState(false);

  const currentVideo = videos[currentIndex];

  useEffect(() => {
    const videoIds = location.state?.videoIds as number[];
    if (!videoIds || videoIds.length === 0) {
      navigate('/kid');
      return;
    }
    loadVideos(videoIds);
  }, [location.state]);

  const loadVideos = async (videoIds: number[]) => {
    setLoading(true);
    try {
      const loadedVideos: Video[] = [];
      for (const id of videoIds) {
        const res = await storageApi.videos.get(id);
        if (res.data) {
          loadedVideos.push(res.data);
        }
      }
      if (loadedVideos.length === 0) {
        setError('没有找到视频');
      } else {
        setVideos(loadedVideos);
      }
    } catch (e) {
      setError('加载失败');
    }
    setLoading(false);
  };

  const playCurrent = useCallback(() => {
    if (!videoRef.current || !currentVideo) return;
    
    setIsPlaying(true);
    updateMediaSessionMetadata(
      `${currentIndex + 1}/${videos.length}`,
      currentVideo.title
    );
    
    if (useAudio && audioRef.current && currentVideo.fileDataUrl) {
      audioRef.current.src = currentVideo.fileDataUrl;
      audioRef.current.play().catch(console.warn);
    } else {
      videoRef.current.play().catch(console.warn);
    }
  }, [currentVideo, currentIndex, videos.length, useAudio]);

  const pauseCurrent = useCallback(() => {
    setIsPlaying(false);
    if (useAudio && audioRef.current) {
      audioRef.current.pause();
    } else if (videoRef.current) {
      videoRef.current.pause();
    }
  }, [useAudio]);

  const togglePlay = () => {
    if (isPlaying) {
      pauseCurrent();
    } else {
      playCurrent();
    }
  };

  const handleVideoEnded = () => {
    if (loopMode === 'single') {
      playCurrent();
    } else if (currentIndex < videos.length - 1) {
      setCurrentIndex(currentIndex + 1);
    } else if (loopMode === 'all') {
      setCurrentIndex(0);
    } else {
      setIsPlaying(false);
    }
  };

  const goNext = () => {
    if (currentIndex < videos.length - 1) {
      setCurrentIndex(currentIndex + 1);
    } else if (loopMode === 'all') {
      setCurrentIndex(0);
    }
  };

  const goPrev = () => {
    if (currentIndex > 0) {
      setCurrentIndex(currentIndex - 1);
    } else if (loopMode === 'all') {
      setCurrentIndex(videos.length - 1);
    }
  };

  const cycleLoopMode = () => {
    const modes: PlaylistLoopMode[] = ['none', 'single', 'all'];
    const currentIdx = modes.indexOf(loopMode);
    setLoopMode(modes[(currentIdx + 1) % modes.length]);
  };

  useEffect(() => {
    if (currentVideo && videoRef.current) {
      videoRef.current.src = currentVideo.fileDataUrl || '';
      if (isPlaying) {
        videoRef.current.play().catch(console.warn);
      }
    }
  }, [currentIndex, currentVideo]);

  useEffect(() => {
    if (currentVideo) {
      updateMediaSessionMetadata(
        `${currentIndex + 1}/${videos.length}`,
        currentVideo.title
      );
    }
  }, [currentIndex, currentVideo, videos.length]);

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center">
        <div className="text-white text-xl">加载中...</div>
      </div>
    );
  }

  if (error || !currentVideo) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center">
        <div className="text-white text-center">
          <div className="text-6xl mb-4">😢</div>
          <p className="text-xl mb-4">{error || '没有视频'}</p>
          <button
            onClick={() => navigate('/kid')}
            className="bg-orange-500 text-white px-6 py-3 rounded-full"
          >
            返回
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-900 flex flex-col">
      {/* 视频区域 */}
      <div className="flex-1 flex items-center justify-center bg-black relative">
        {!useAudio && (
          <video
            ref={videoRef}
            src={currentVideo.fileDataUrl}
            className="max-w-full max-h-full"
            onEnded={handleVideoEnded}
            onError={() => setError('视频加载失败')}
            playsInline
          />
        )}
        
        {useAudio && (
          <audio ref={audioRef} onEnded={handleVideoEnded} />
        )}
        
        {useAudio && (
          <div className="text-white text-center">
            <div className="text-8xl mb-4 animate-pulse">🎵</div>
            <p className="text-2xl font-bold">{currentVideo.title}</p>
            <p className="text-gray-400 mt-2">音频模式 - 锁屏可听</p>
          </div>
        )}
      </div>

      {/* 控制栏 */}
      <div className="bg-gray-800 text-white p-6">
        {/* 进度指示 */}
        <div className="text-center mb-4">
          <p className="text-sm text-gray-400">
            第 {currentIndex + 1} / {videos.length} 个视频
          </p>
          <h2 className="text-xl font-bold mt-1">{currentVideo.title}</h2>
          {videos.length > 1 && (
            <p className="text-xs text-gray-500 mt-1">
              {videos.map((v, i) => i === currentIndex ? `${i + 1}. ${v.title}` : null).filter(Boolean).join(' → ')}
            </p>
          )}
        </div>

        {/* 循环模式 */}
        <div className="flex justify-center mb-4">
          <button
            onClick={cycleLoopMode}
            className={`px-4 py-2 rounded-full flex items-center gap-2 transition-all ${
              loopMode === 'none'
                ? 'bg-gray-600 text-white'
                : loopMode === 'single'
                ? 'bg-orange-500 text-white'
                : 'bg-green-500 text-white'
            }`}
          >
            {loopMode === 'single' ? <Repeat1 className="w-5 h-5" /> : <Repeat className="w-5 h-5" />}
            {loopMode === 'none' ? '不循环' : loopMode === 'single' ? '单曲循环' : '全部循环'}
          </button>
        </div>

        {/* 播放控制 */}
        <div className="flex items-center justify-center gap-6">
          <button
            onClick={goPrev}
            className="w-14 h-14 bg-gray-700 hover:bg-gray-600 rounded-full flex items-center justify-center transition-all"
            disabled={currentIndex === 0 && loopMode !== 'all'}
          >
            <SkipBack className="w-6 h-6" />
          </button>

          <button
            onClick={togglePlay}
            className="w-20 h-20 bg-orange-500 hover:bg-orange-600 rounded-full flex items-center justify-center transition-all shadow-lg"
          >
            {isPlaying ? (
              <Pause className="w-10 h-10" />
            ) : (
              <Play className="w-10 h-10 ml-1" />
            )}
          </button>

          <button
            onClick={goNext}
            className="w-14 h-14 bg-gray-700 hover:bg-gray-600 rounded-full flex items-center justify-center transition-all"
            disabled={currentIndex === videos.length - 1 && loopMode !== 'all'}
          >
            <SkipForward className="w-6 h-6" />
          </button>
        </div>

        {/* 音频模式切换 */}
        <div className="flex justify-center mt-4">
          <button
            onClick={() => setUseAudio(!useAudio)}
            className={`px-4 py-2 rounded-full flex items-center gap-2 transition-all ${
              useAudio ? 'bg-blue-500 text-white' : 'bg-gray-600 text-white'
            }`}
          >
            <Volume2 className="w-5 h-5" />
            {useAudio ? '音频模式（锁屏可听）' : '视频模式'}
          </button>
        </div>

        {/* 返回按钮 */}
        <div className="flex justify-center mt-4">
          <button
            onClick={() => navigate('/kid')}
            className="w-14 h-14 bg-gray-700 hover:bg-gray-600 rounded-full flex items-center justify-center transition-all"
          >
            <Home className="w-6 h-6" />
          </button>
        </div>
      </div>
    </div>
  );
}
