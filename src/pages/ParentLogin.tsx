import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { ArrowLeft, Lock, LogIn } from 'lucide-react';
import { storageApi } from '../utils/storage';
import { useAppStore } from '../store/useAppStore';

export default function ParentLogin() {
  const navigate = useNavigate();
  const { setIsAdmin } = useAppStore();
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const res = await storageApi.auth.login(password);
      if (res.success && res.data?.token) {
        localStorage.setItem('admin_token', res.data.token);
        setIsAdmin(true);
        navigate('/parent/dashboard');
      } else {
        setError(res.error || '密码错误');
      }
    } catch (e) {
      setError('登录失败，请重试');
    }
    setLoading(false);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50 flex flex-col">
      <header className="p-6">
        <Link
          to="/"
          className="inline-flex items-center gap-2 text-gray-600 hover:text-gray-800 transition-colors"
        >
          <ArrowLeft className="w-5 h-5" />
          <span>返回首页</span>
        </Link>
      </header>

      <div className="flex-1 flex items-center justify-center p-6">
        <div className="w-full max-w-md">
          <div className="bg-white rounded-3xl shadow-2xl p-8">
            <div className="text-center mb-8">
              <div className="w-24 h-24 mx-auto bg-gradient-to-br from-blue-400 to-indigo-600 rounded-full flex items-center justify-center mb-4 shadow-lg">
                <span className="text-5xl">👨‍👩‍👧</span>
              </div>
              <h1 className="text-3xl font-bold text-gray-800 mb-2">家长/老师登录</h1>
              <p className="text-gray-500">请输入密码进入管理后台</p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-6">
              <div>
                <label className="block text-gray-700 font-medium mb-2">
                  密码
                </label>
                <div className="relative">
                  <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                  <input
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="请输入密码"
                    className="w-full pl-12 pr-4 py-4 border-2 border-gray-200 rounded-2xl text-lg focus:border-blue-400 focus:outline-none transition-colors"
                    autoFocus
                  />
                </div>
              </div>

              {error && (
                <div className="bg-red-50 text-red-500 p-4 rounded-xl text-center">
                  {error}
                </div>
              )}

              <button
                type="submit"
                disabled={loading || !password}
                className="w-full py-4 bg-gradient-to-r from-blue-500 to-indigo-600 text-white text-xl font-bold rounded-2xl shadow-lg hover:shadow-xl transform hover:scale-[1.02] transition-all disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none flex items-center justify-center gap-2"
              >
                <LogIn className="w-6 h-6" />
                {loading ? '登录中...' : '登录'}
              </button>
            </form>

            <div className="mt-6 p-4 bg-blue-50 rounded-2xl">
              <p className="text-sm text-blue-600 text-center">
                💡 默认密码：<span className="font-mono font-bold">123456</span>
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
