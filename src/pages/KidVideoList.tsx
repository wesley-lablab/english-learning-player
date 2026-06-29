import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Settings, Star, Sparkles, Check, Play, ChevronLeft, Folder } from 'lucide-react';
import type { Video, Course } from '../types';
import { storageApi } from '../utils/storage';
import { useAppStore } from '../store/useAppStore';

export default function KidVideoList() {
  const navigate = useNavigate();
  const { settings } = useAppStore();
  const [courses, setCourses] = useState<Course[]>([]);
  const [videos, setVideos] = useState<Video[]>([]);
  const [selectedCourse, setSelectedCourse] = useState<Course | null>(null);
  const [selectedVideos, setSelectedVideos] = useState<Set<number>>(new Set());
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadCourses();
  }, []);

  useEffect(() => {
    if (settings) {
      useAppStore.getState().setSettings(settings);
    }
  }, [settings]);

  const loadCourses = async () => {
    setLoading(true);
    try {
      const res = await storageApi.courses.list();
      if (res.data) setCourses(res.data);
    } catch (e) {
      console.error(e);
    }
    setLoading(false);
  };

  const loadVideos = async (courseId: number) => {
    setLoading(true);
    try {
      const res = await storageApi.videos.list(courseId);
      if (res.data) setVideos(res.data);
    } catch (e) {
      console.error(e);
    }
    setLoading(false);
  };

  const handleCourseClick = (course: Course) => {
    setSelectedCourse(course);
    setSelectedVideos(new Set());
    loadVideos(course.id);
  };

  const handleBackToCourses = () => {
    setSelectedCourse(null);
    setVideos([]);
    setSelectedVideos(new Set());
  };

  const toggleVideoSelection = (videoId: number) => {
    const newSelected = new Set(selectedVideos);
    if (newSelected.has(videoId)) {
      newSelected.delete(videoId);
    } else {
      newSelected.add(videoId);
    }
    setSelectedVideos(newSelected);
  };

  const handlePlay = () => {
    if (selectedVideos.size === 0) return;
    
    const videoIds = Array.from(selectedVideos);
    if (videoIds.length === 1) {
      navigate(`/kid/video/${videoIds[0]}`);
    } else {
      navigate(`/kid/playlist`, { state: { videoIds } });
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-orange-50 via-yellow-50 to-pink-50 flex items-center justify-center">
        <div className="text-center">
          <div className="text-6xl mb-4 animate-bounce">📚</div>
          <div className="text-xl text-gray-600">加载中...</div>
        </div>
      </div>
    );
  }

  // 选课模式
  if (!selectedCourse) {
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
              >
                <Settings className="w-7 h-7" />
              </button>
            </div>
          </div>
        </header>

        <main className="max-w-4xl mx-auto px-6 py-8">
          <h2 className="text-2xl font-bold text-gray-800 mb-6 flex items-center gap-2">
            <span className="text-3xl">📚</span>
            选择课程
          </h2>

          {courses.length > 0 ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {courses.map((course) => (
                <button
                  key={course.id}
                  onClick={() => handleCourseClick(course)}
                  className="bg-white rounded-2xl p-6 shadow-lg hover:shadow-xl transition-all hover:scale-[1.02] flex items-center gap-4 text-left border-2 border-transparent hover:border-orange-300"
                >
                  <div className="w-16 h-16 bg-gradient-to-br from-orange-400 to-yellow-400 rounded-2xl flex items-center justify-center text-3xl shadow">
                    {course.icon || '📚'}
                  </div>
                  <div className="flex-1">
                    <h3 className="text-xl font-bold text-gray-800">{course.title}</h3>
                    <p className="text-gray-500 text-sm">{course.videoIds.length} 个视频</p>
                  </div>
                </button>
              ))}
            </div>
          ) : (
            <div className="text-center py-20">
              <div className="text-8xl mb-4">📭</div>
              <h3 className="text-2xl font-bold text-gray-600 mb-2">还没有课程哦</h3>
              <p className="text-gray-500">请让爸爸妈妈添加课程吧！</p>
            </div>
          )}
        </main>

        <div className="fixed bottom-6 right-6">
          <button
            onClick={() => navigate('/')}
            className="w-16 h-16 bg-gradient-to-br from-blue-400 to-blue-600 text-white rounded-full shadow-xl flex items-center justify-center hover:scale-110 transition-transform"
          >
            <span className="text-2xl">🏠</span>
          </button>
        </div>
      </div>
    );
  }

  // 选视频模式
  return (
    <div className="min-h-screen bg-gradient-to-br from-orange-50 via-yellow-50 to-pink-50">
      <header className="bg-gradient-to-r from-orange-400 via-orange-500 to-yellow-400 text-white py-6 px-6 shadow-lg">
        <div className="max-w-6xl mx-auto">
          <div className="flex items-center justify-between">
            <button
              onClick={handleBackToCourses}
              className="flex items-center gap-2 bg-white/20 hover:bg-white/30 rounded-full px-4 py-2 transition-all"
            >
              <ChevronLeft className="w-5 h-5" />
              返回课程
            </button>
            
            <div className="text-center">
              <h1 className="text-2xl font-bold flex items-center gap-2">
                <span className="text-3xl">{selectedCourse.icon || '📚'}</span>
                {selectedCourse.title}
              </h1>
              <p className="text-sm opacity-90">{videos.length} 个视频 | 已选 {selectedVideos.size} 个</p>
            </div>
            
            <div className="w-24" />
          </div>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-6 py-8">
        <h2 className="text-xl font-bold text-gray-800 mb-4">
          选择要学习的视频（可多选）
        </h2>

        {videos.length > 0 ? (
          <div className="space-y-3">
            {videos.map((video) => {
              const isSelected = selectedVideos.has(video.id);
              return (
                <button
                  key={video.id}
                  onClick={() => toggleVideoSelection(video.id)}
                  className={`w-full bg-white rounded-2xl p-4 shadow-md transition-all flex items-center gap-4 text-left ${
                    isSelected 
                      ? 'ring-4 ring-orange-400 shadow-lg scale-[1.01]' 
                      : 'hover:shadow-lg'
                  }`}
                >
                  <div className={`w-10 h-10 rounded-full flex items-center justify-center transition-all ${
                    isSelected 
                      ? 'bg-orange-500 text-white' 
                      : 'bg-gray-100 text-gray-400'
                  }`}>
                    {isSelected ? <Check className="w-6 h-6" /> : <span className="text-lg">{selectedVideos.size + 1 > videos.length ? '?' : Array.from({length: videos.length}, (_, i) => selectedVideos.has(videos[i].id) ? i + 1 : null).filter(Boolean).length + 1}</span>}
                  </div>
                  
                  <div className="w-24 h-16 bg-gray-100 rounded-lg overflow-hidden flex-shrink-0">
                    {video.thumbnail ? (
                      <img src={video.thumbnail} alt="" className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-2xl">🎬</div>
                    )}
                  </div>
                  
                  <div className="flex-1">
                    <h3 className="font-bold text-gray-800">{video.title}</h3>
                    <p className="text-sm text-gray-500">
                      {video.sentences?.length || 0} 句跟读
                    </p>
                  </div>
                  
                  {isSelected && (
                    <div className="px-3 py-1 bg-orange-500 text-white rounded-full text-sm font-bold">
                      已选
                    </div>
                  )}
                </button>
              );
            })}
          </div>
        ) : (
          <div className="text-center py-20">
            <div className="text-8xl mb-4">📭</div>
            <h3 className="text-2xl font-bold text-gray-600 mb-2">这个课程还没有视频</h3>
            <p className="text-gray-500">请让爸爸妈妈上传视频吧！</p>
          </div>
        )}
      </main>

      {selectedVideos.size > 0 && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50">
          <button
            onClick={handlePlay}
            className="bg-gradient-to-r from-orange-500 to-yellow-500 text-white px-8 py-4 rounded-full shadow-2xl flex items-center gap-3 hover:scale-105 transition-transform font-bold text-xl"
          >
            <Play className="w-6 h-6" />
            {selectedVideos.size === 1 ? '开始学习' : `播放 ${selectedVideos.size} 个视频`}
          </button>
        </div>
      )}

      <div className="fixed bottom-6 right-6">
        <button
          onClick={() => navigate('/')}
          className="w-16 h-16 bg-gradient-to-br from-blue-400 to-blue-600 text-white rounded-full shadow-xl flex items-center justify-center hover:scale-110 transition-transform"
        >
          <span className="text-2xl">🏠</span>
        </button>
      </div>
    </div>
  );
}
