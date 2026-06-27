import { useNavigate } from 'react-router-dom';
import { Sparkles } from 'lucide-react';

export default function RoleSelect() {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-gradient-to-br from-orange-100 via-yellow-50 to-pink-100 flex flex-col items-center justify-center p-6">
      <div className="text-center mb-12">
        <div className="flex items-center justify-center gap-3 mb-4">
          <Sparkles className="w-12 h-12 text-yellow-500" />
          <h1 className="text-5xl md:text-6xl font-bold bg-gradient-to-r from-orange-500 via-pink-500 to-purple-500 bg-clip-text text-transparent">
            英语学习乐园
          </h1>
          <Sparkles className="w-12 h-12 text-yellow-500" />
        </div>
        <p className="text-2xl text-gray-600">选择你的身份，开始学习吧！</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8 max-w-4xl w-full">
        <div
          onClick={() => navigate('/kid')}
          className="group cursor-pointer bg-gradient-to-br from-orange-400 via-orange-500 to-yellow-400 rounded-[40px] p-10 text-white shadow-2xl transform transition-all duration-300 hover:scale-105 hover:shadow-orange-300/50 hover:shadow-2xl"
        >
          <div className="text-center">
            <div className="w-32 h-32 mx-auto bg-white/30 rounded-full flex items-center justify-center mb-6 group-hover:scale-110 transition-transform">
              <span className="text-7xl">🧒</span>
            </div>
            <h2 className="text-4xl font-bold mb-3">我是小朋友</h2>
            <p className="text-xl opacity-90 mb-6">点击这里看英语视频</p>
            <div className="flex justify-center gap-2">
              <span className="text-4xl animate-bounce" style={{ animationDelay: '0ms' }}>🌟</span>
              <span className="text-4xl animate-bounce" style={{ animationDelay: '100ms' }}>📚</span>
              <span className="text-4xl animate-bounce" style={{ animationDelay: '200ms' }}>🎬</span>
            </div>
          </div>
        </div>

        <div
          onClick={() => navigate('/parent/login')}
          className="group cursor-pointer bg-gradient-to-br from-blue-400 via-blue-500 to-indigo-600 rounded-[40px] p-10 text-white shadow-2xl transform transition-all duration-300 hover:scale-105 hover:shadow-blue-300/50 hover:shadow-2xl"
        >
          <div className="text-center">
            <div className="w-32 h-32 mx-auto bg-white/30 rounded-full flex items-center justify-center mb-6 group-hover:scale-110 transition-transform">
              <span className="text-7xl">👨‍👩‍👧</span>
            </div>
            <h2 className="text-4xl font-bold mb-3">我是家长/老师</h2>
            <p className="text-xl opacity-90 mb-6">上传视频，管理学习</p>
            <div className="flex justify-center gap-2">
              <span className="text-4xl animate-bounce" style={{ animationDelay: '0ms' }}>📤</span>
              <span className="text-4xl animate-bounce" style={{ animationDelay: '100ms' }}>📊</span>
              <span className="text-4xl animate-bounce" style={{ animationDelay: '200ms' }}>⚙️</span>
            </div>
          </div>
        </div>
      </div>

      <div className="mt-12 text-center">
        <p className="text-gray-500 text-lg">
          💡 默认家长密码：<span className="font-mono bg-gray-200 px-2 py-1 rounded">123456</span>
        </p>
      </div>
    </div>
  );
}
