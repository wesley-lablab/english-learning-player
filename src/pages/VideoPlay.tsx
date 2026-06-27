import { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, RotateCcw } from 'lucide-react';
import type { Video, PlaybackRate } from '../types';
import { api } from '../utils/api';
import { getVideoUrl } from '../utils';
import VideoPlayer from '../components/VideoPlayer';
import { useAppStore } from '../store/useAppStore';

export default function VideoPlay() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { playbackRate, setPlaybackRate, settings } = useAppStore();
  const [video, setVideo] = useState<Video | null>(null);
  const [loading, setLoading] = useState(true);
  const startTimeRef = useRef<number>(0);
  const watchedTimeRef = useRef<number>(0);

  useEffect(() => {
    loadVideo();
  }, [id]);

  const loadVideo = async () => {
    if (!id) return;
    setLoading(true);
    try {
      const res = await api.videos.get(parseInt(id, 10));
      if (res.data) {
        setVideo(res.data);
        startTimeRef.current = Date.now();
        watchedTimeRef.current = 0;
      }
    } catch (e) {
      console.error(e);
    }
    setLoading(false);
  };

  const handleTimeUpdate = useCallback((time: number, _duration: number) => {
    watchedTimeRef.current = time;
  }, []);

  const saveRecord = useCallback(async () => {
    if (!video || watchedTimeRef.current < 5) return;
    
    try {
      await api.records.add({
        videoId: video.id,
        videoTitle: video.title,
        childName: settings.childName,
        watchedDuration: Math.floor(watchedTimeRef.current),
        playbackRate,
      });
    } catch (e) {
      console.error('Failed to save record', e);
    }
  }, [video, settings.childName, playbackRate]);

  useEffect(() => {
    return () => {
      saveRecord();
    };
  }, [saveRecord]);

  const handleRateChange = (rate: PlaybackRate) => {
    setPlaybackRate(rate);
  };

  const handleReplay = () => {
    const videoEl = document.querySelector('video');
    if (videoEl) {
      videoEl.currentTime = 0;
      videoEl.play();
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-orange-50 via-yellow-50 to-pink-50 flex items-center justify-center">
        <div className="text-center">
          <div className="text-6xl mb-4 animate-bounce">🎬</div>
          <p className="text-xl text-gray-600">加载中...</p>
        </div>
      </div>
    );
  }

  if (!video) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-orange-50 via-yellow-50 to-pink-50 flex items-center justify-center">
        <div className="text-center">
          <div className="text-6xl mb-4">😢</div>
          <p className="text-xl text-gray-600 mb-4">视频不存在</p>
          <button
            onClick={() => navigate('/kid')}
            className="px-6 py-3 bg-orange-500 text-white rounded-full font-bold hover:bg-orange-600 transition-colors"
          >
            返回列表
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-orange-50 via-yellow-50 to-pink-50">
      <header className="bg-gradient-to-r from-orange-400 via-orange-500 to-yellow-400 text-white py-5 px-6 shadow-lg">
        <div className="max-w-5xl mx-auto flex items-center justify-between">
          <button
            onClick={() => navigate('/kid')}
            className="flex items-center gap-2 bg-white/20 hover:bg-white/30 px-5 py-3 rounded-full transition-all hover:scale-105"
          >
            <ArrowLeft className="w-6 h-6" />
            <span className="text-lg font-bold">返回列表</span>
          </button>

          <div className="flex items-center gap-3">
            <span className="text-3xl">{settings.childAvatar}</span>
            <span className="text-xl font-bold">{settings.childName}</span>
          </div>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-6 py-8">
        <div className="mb-6">
          <h1 className="text-3xl font-bold text-gray-800 mb-2 flex items-center gap-3">
            <span className="text-4xl">🎯</span>
            {video.title}
          </h1>
          <p className="text-gray-500 text-lg">{video.description}</p>
        </div>

        <VideoPlayer
          videoUrl={getVideoUrl(video.fileName)}
          title={video.title}
          playbackRate={playbackRate}
          onRateChange={handleRateChange}
          onTimeUpdate={handleTimeUpdate}
          onEnded={saveRecord}
        />

        <div className="mt-8 flex justify-center gap-4">
          <button
            onClick={handleReplay}
            className="flex items-center gap-2 px-8 py-4 bg-gradient-to-r from-green-400 to-green-600 text-white rounded-2xl text-xl font-bold shadow-lg hover:scale-105 transition-transform"
          >
            <RotateCcw className="w-6 h-6" />
            再看一遍
          </button>
          <button
            onClick={() => navigate('/kid')}
            className="flex items-center gap-2 px-8 py-4 bg-gradient-to-r from-blue-400 to-blue-600 text-white rounded-2xl text-xl font-bold shadow-lg hover:scale-105 transition-transform"
          >
            <ArrowLeft className="w-6 h-6" />
            选择其他视频
          </button>
        </div>

        <div className="mt-8 bg-white rounded-3xl p-6 shadow-lg">
          <h3 className="text-xl font-bold text-gray-800 mb-4 flex items-center gap-2">
            <span className="text-2xl">💡</span>
            学习小贴士
          </h3>
          <ul className="space-y-3 text-gray-600">
            <li className="flex items-start gap-3">
              <span className="text-xl">🐢</span>
              <span>如果听不懂，可以把速度调慢一点（0.5x 或 0.75x）</span>
            </li>
            <li className="flex items-start gap-3">
              <span className="text-xl">🔄</span>
              <span>重要的内容可以反复观看，加深记忆</span>
            </li>
            <li className="flex items-start gap-3">
              <span className="text-xl">🗣️</span>
              <span>跟着视频一起说，练习口语发音</span>
            </li>
          </ul>
        </div>
      </main>
    </div>
  );
}
