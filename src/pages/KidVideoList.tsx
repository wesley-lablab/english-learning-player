import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Settings, Star, Sparkles } from 'lucide-react';
import type { Video, Category } from '../types';
import { api } from '../utils/api';
import VideoCard from '../components/VideoCard';
import CategoryNav from '../components/CategoryNav';
import { useAppStore } from '../store/useAppStore';

export default function KidVideoList() {
  const navigate = useNavigate();
  const { settings, selectedCategory, setSelectedCategory } = useAppStore();
  const [videos, setVideos] = useState<Video[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadData();
  }, []);

  useEffect(() => {
    loadVideos();
  }, [selectedCategory]);

  const loadData = async () => {
    try {
      const [catRes, settingsRes] = await Promise.all([
        api.categories.list(),
        api.auth.getSettings(),
      ]);
      if (catRes.data) setCategories(catRes.data);
      if (settingsRes.data) {
        useAppStore.getState().setSettings(settingsRes.data);
      }
    } catch (e) {
      console.error(e);
    }
  };

  const loadVideos = async () => {
    setLoading(true);
    try {
      const res = await api.videos.list(selectedCategory === 'all' ? undefined : selectedCategory);
      if (res.data) setVideos(res.data);
    } catch (e) {
      console.error(e);
    }
    setLoading(false);
  };

  const handleVideoClick = (video: Video) => {
    navigate(`/kid/video/${video.id}`);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-orange-50 via-yellow-50 to-pink-50">
      <header className="bg-gradient-to-r from-orange-400 via-orange-500 to-yellow-400 text-white py-8 px-6 shadow-lg">
        <div className="max-w-6xl mx-auto">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-5">
              <div className="w-20 h-20 bg-white rounded-full flex items-center justify-center text-5xl shadow-xl border-4 border-yellow-200">
                {settings.childAvatar}
              </div>
              <div>
                <h1 className="text-4xl font-bold mb-1 flex items-center gap-2">
                  <Sparkles className="w-8 h-8" />
                  你好，{settings.childName}！
                </h1>
                <p className="text-xl opacity-90">今天也要开心学英语哦 🌟</p>
              </div>
            </div>
            <button
              onClick={() => navigate('/')}
              className="w-14 h-14 bg-white/20 hover:bg-white/30 rounded-full flex items-center justify-center transition-all hover:scale-110"
              title="返回首页"
            >
              <Settings className="w-7 h-7" />
            </button>
          </div>

          <div className="flex items-center gap-3 mt-6">
            <div className="flex items-center gap-2 bg-white/20 rounded-full px-5 py-2">
              <Star className="w-6 h-6 text-yellow-200" fill="currentColor" />
              <span className="text-lg font-bold">{videos.length} 个学习视频</span>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-6 py-8">
        <div className="mb-8">
          <h2 className="text-2xl font-bold text-gray-800 mb-4 flex items-center gap-2">
            <span className="text-3xl">🎯</span>
            选择学习内容
          </h2>
          <CategoryNav
            categories={categories}
            selected={selectedCategory}
            onSelect={setSelectedCategory}
          />
        </div>

        {loading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {[1, 2, 3, 4, 5, 6].map((i) => (
              <div key={i} className="bg-white rounded-3xl overflow-hidden shadow-lg animate-pulse">
                <div className="aspect-video bg-gray-200" />
                <div className="p-5">
                  <div className="h-6 bg-gray-200 rounded w-3/4 mb-2" />
                  <div className="h-4 bg-gray-200 rounded w-full" />
                </div>
              </div>
            ))}
          </div>
        ) : videos.length > 0 ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {videos.map((video) => (
              <VideoCard
                key={video.id}
                video={video}
                onClick={() => handleVideoClick(video)}
              />
            ))}
          </div>
        ) : (
          <div className="text-center py-20">
            <div className="text-8xl mb-4">📭</div>
            <h3 className="text-2xl font-bold text-gray-600 mb-2">还没有视频哦</h3>
            <p className="text-gray-500">请让爸爸妈妈上传英语学习视频吧！</p>
          </div>
        )}
      </main>

      <div className="fixed bottom-6 right-6">
        <button
          onClick={() => navigate('/')}
          className="w-16 h-16 bg-gradient-to-br from-blue-400 to-blue-600 text-white rounded-full shadow-xl flex items-center justify-center hover:scale-110 transition-transform"
          title="返回首页"
        >
          <span className="text-2xl">🏠</span>
        </button>
      </div>
    </div>
  );
}
