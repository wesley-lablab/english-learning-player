import { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Plus, Trash2, Video as VideoIcon, BarChart3, Clock, LogOut, Upload, ArrowLeft, BookOpen, Settings as SettingsIcon } from 'lucide-react';
import type { Video, StudyStats, StudyRecord } from '../types';
import { storageApi } from '../utils/storage';
import { formatDuration, formatDate, getCategoryEmoji } from '../utils';
import { useAppStore } from '../store/useAppStore';
import { saveGitHubSettings } from '../utils/githubUpload';

export default function ParentDashboard() {
  const navigate = useNavigate();
  const { setIsAdmin } = useAppStore();
  const [videos, setVideos] = useState<Video[]>([]);
  const [stats, setStats] = useState<StudyStats | null>(null);
  const [records, setRecords] = useState<StudyRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'videos' | 'stats' | 'settings'>('videos');
  const [githubToken, setGithubToken] = useState('');
  const [githubOwner, setGithubOwner] = useState('wesley-lablab');
  const [githubRepo, setGithubRepo] = useState('english-learning-player');

  useEffect(() => {
    checkAuth();
    loadData();
  }, []);

  const checkAuth = async () => {
    const token = localStorage.getItem('admin_token');
    if (!token) {
      navigate('/parent/login');
      return;
    }
    const res = await storageApi.auth.status();
    if (!res.data?.isLoggedIn) {
      navigate('/parent/login');
    }
  };

  const loadData = async () => {
    setLoading(true);
    try {
      const [videosRes, statsRes, recordsRes] = await Promise.all([
        storageApi.videos.list(),
        storageApi.records.stats(),
        storageApi.records.list(),
      ]);
      if (videosRes.data) setVideos(videosRes.data);
      if (statsRes.data) setStats(statsRes.data);
      if (recordsRes.data) setRecords(recordsRes.data);
    } catch (e) {
      console.error(e);
    }
    setLoading(false);
  };

  useEffect(() => {
    try {
      const saved = localStorage.getItem('elp_github_settings');
      if (saved) {
        const settings = JSON.parse(saved);
        setGithubToken(settings.token || '');
        setGithubOwner(settings.owner || 'wesley-lablab');
        setGithubRepo(settings.repo || 'english-learning-player');
      }
    } catch {}
  }, []);

  const handleDelete = async (id: number, title: string) => {
    if (!confirm(`确定要删除视频「${title}」吗？删除后无法恢复。`)) return;
    try {
      const res = await storageApi.videos.delete(id);
      if (res.success) {
        alert('删除成功！');
        loadData();
      } else {
        alert('删除失败：' + (res.error || '未知错误，请检查 GitHub Token 是否配置正确'));
      }
    } catch (e) {
      console.error(e);
      alert('删除失败：' + (e as Error).message);
    }
  };

  const handleSaveGithubSettings = () => {
    saveGitHubSettings({
      token: githubToken,
      owner: githubOwner,
      repo: githubRepo,
    });
    alert('GitHub 设置已保存！');
  };

  const handleLogout = () => {
    localStorage.removeItem('admin_token');
    setIsAdmin(false);
    navigate('/');
  };

  const handleExportData = async () => {
    try {
      const videosRes = await storageApi.videos.list();
      const localVideos = videosRes.data?.filter(v => !v.isPreset) || [];
      
      const exportData: any = {
        exportTime: new Date().toISOString(),
        videos: [],
      };

      for (const video of localVideos) {
        const sentencesRes = await storageApi.videos.getSentences(video.id);
        exportData.videos.push({
          ...video,
          sentences: sentencesRes.data,
        });
      }

      const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `elp-export-${new Date().toISOString().slice(0, 10)}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      
      alert('导出成功！请把下载的文件发送给开发者。');
    } catch (e) {
      console.error(e);
      alert('导出失败');
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-gradient-to-r from-blue-600 to-indigo-700 text-white shadow-lg">
        <div className="max-w-6xl mx-auto px-6 py-5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Link
                to="/"
                className="w-10 h-10 bg-white/20 hover:bg-white/30 rounded-full flex items-center justify-center transition-colors"
              >
                <ArrowLeft className="w-5 h-5" />
              </Link>
              <div>
                <h1 className="text-2xl font-bold">家长管理后台</h1>
                <p className="text-white/80 text-sm">管理视频和查看学习记录</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <button
                onClick={handleExportData}
                className="flex items-center gap-2 bg-green-500 text-white px-4 py-2.5 rounded-xl font-bold hover:bg-green-600 transition-colors shadow-md"
              >
                <span className="text-lg">📤</span>
                导出数据
              </button>
              <button
                onClick={() => navigate('/parent/upload')}
                className="flex items-center gap-2 bg-white text-blue-600 px-5 py-2.5 rounded-xl font-bold hover:bg-blue-50 transition-colors shadow-md"
              >
                <Upload className="w-5 h-5" />
                上传视频
              </button>
              <button
                onClick={handleLogout}
                className="w-10 h-10 bg-white/20 hover:bg-white/30 rounded-full flex items-center justify-center transition-colors"
                title="退出登录"
              >
                <LogOut className="w-5 h-5" />
              </button>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-6 py-8">
        <div className="flex gap-2 mb-6 bg-white p-1.5 rounded-2xl shadow-md w-fit flex-wrap">
          <button
            onClick={() => setActiveTab('videos')}
            className={`flex items-center gap-2 px-6 py-3 rounded-xl font-bold transition-all ${
              activeTab === 'videos'
                ? 'bg-blue-500 text-white shadow-md'
                : 'text-gray-600 hover:bg-gray-100'
            }`}
          >
            <VideoIcon className="w-5 h-5" />
            视频管理
          </button>
          <button
            onClick={() => setActiveTab('stats')}
            className={`flex items-center gap-2 px-6 py-3 rounded-xl font-bold transition-all ${
              activeTab === 'stats'
                ? 'bg-blue-500 text-white shadow-md'
                : 'text-gray-600 hover:bg-gray-100'
            }`}
          >
            <BarChart3 className="w-5 h-5" />
            学习统计
          </button>
          <button
            onClick={() => setActiveTab('settings')}
            className={`flex items-center gap-2 px-6 py-3 rounded-xl font-bold transition-all ${
              activeTab === 'settings'
                ? 'bg-blue-500 text-white shadow-md'
                : 'text-gray-600 hover:bg-gray-100'
            }`}
          >
            <SettingsIcon className="w-5 h-5" />
            设置
          </button>
        </div>

        {activeTab === 'videos' && (
          <div>
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-bold text-gray-800">
                视频列表 <span className="text-gray-400">({videos.length})</span>
              </h2>
              <button
                onClick={() => navigate('/parent/upload')}
                className="flex items-center gap-2 bg-gradient-to-r from-green-500 to-emerald-600 text-white px-6 py-3 rounded-xl font-bold hover:shadow-lg transition-all hover:scale-105"
              >
                <Plus className="w-5 h-5" />
                上传新视频
              </button>
            </div>

            {loading ? (
              <div className="bg-white rounded-2xl p-8 text-center">
                <p className="text-gray-500">加载中...</p>
              </div>
            ) : videos.length > 0 ? (
              <div className="bg-white rounded-2xl shadow-md overflow-hidden">
                <table className="w-full">
                  <thead className="bg-gray-50 border-b">
                    <tr>
                      <th className="text-left px-6 py-4 font-bold text-gray-600">视频名称</th>
                      <th className="text-left px-6 py-4 font-bold text-gray-600">分类</th>
                      <th className="text-left px-6 py-4 font-bold text-gray-600">时长</th>
                      <th className="text-left px-6 py-4 font-bold text-gray-600">上传时间</th>
                      <th className="text-right px-6 py-4 font-bold text-gray-600">操作</th>
                    </tr>
                  </thead>
                  <tbody>
                    {videos.map((video) => (
                      <tr key={video.id} className="border-b hover:bg-gray-50 transition-colors">
                        <td className="px-6 py-4">
                          <div className="font-medium text-gray-800">{video.title}</div>
                          {video.description && (
                            <div className="text-sm text-gray-500 mt-1">{video.description}</div>
                          )}
                        </td>
                        <td className="px-6 py-4">
                          <span className="inline-flex items-center gap-1 px-3 py-1 bg-gray-100 rounded-full text-sm">
                            <span>{getCategoryEmoji(video.category)}</span>
                            <span className="text-gray-600">{video.category}</span>
                          </span>
                        </td>
                        <td className="px-6 py-4 text-gray-600">
                          {formatDuration(video.duration)}
                        </td>
                        <td className="px-6 py-4 text-gray-500 text-sm">
                          {formatDate(video.createdAt)}
                        </td>
                        <td className="px-6 py-4 text-right">
                          <div className="flex items-center justify-end gap-2">
                            <button
                              onClick={() => navigate(`/parent/editor/${video.id}`)}
                              className="w-10 h-10 text-emerald-500 hover:bg-emerald-50 rounded-lg flex items-center justify-center transition-colors"
                              title="编辑跟读句子"
                            >
                              <BookOpen className="w-5 h-5" />
                            </button>
                            <button
                              onClick={() => handleDelete(video.id, video.title)}
                              className="w-10 h-10 text-red-500 hover:bg-red-50 rounded-lg flex items-center justify-center transition-colors"
                              title="删除"
                            >
                              <Trash2 className="w-5 h-5" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="bg-white rounded-2xl p-12 text-center">
                <div className="text-6xl mb-4">📭</div>
                <h3 className="text-xl font-bold text-gray-700 mb-2">还没有视频</h3>
                <p className="text-gray-500 mb-6">点击上方按钮上传第一个英语学习视频</p>
                <button
                  onClick={() => navigate('/parent/upload')}
                  className="inline-flex items-center gap-2 bg-gradient-to-r from-green-500 to-emerald-600 text-white px-6 py-3 rounded-xl font-bold hover:shadow-lg transition-all"
                >
                  <Plus className="w-5 h-5" />
                  上传视频
                </button>
              </div>
            )}
          </div>
        )}

        {activeTab === 'stats' && (
          <div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
              <div className="bg-gradient-to-br from-blue-500 to-blue-600 text-white rounded-2xl p-6 shadow-lg">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-blue-100 mb-1">视频总数</p>
                    <p className="text-4xl font-bold">{stats?.totalVideos || 0}</p>
                  </div>
                  <VideoIcon className="w-12 h-12 text-blue-200" />
                </div>
              </div>
              <div className="bg-gradient-to-br from-green-500 to-emerald-600 text-white rounded-2xl p-6 shadow-lg">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-green-100 mb-1">学习次数</p>
                    <p className="text-4xl font-bold">{stats?.recordsCount || 0}</p>
                  </div>
                  <Clock className="w-12 h-12 text-green-200" />
                </div>
              </div>
              <div className="bg-gradient-to-br from-orange-500 to-orange-600 text-white rounded-2xl p-6 shadow-lg">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-orange-100 mb-1">总学习时长</p>
                    <p className="text-4xl font-bold">{formatDuration(stats?.totalDuration || 0)}</p>
                  </div>
                  <BarChart3 className="w-12 h-12 text-orange-200" />
                </div>
              </div>
            </div>

            <div className="bg-white rounded-2xl shadow-md overflow-hidden">
              <div className="px-6 py-4 border-b">
                <h3 className="font-bold text-gray-800">最近学习记录</h3>
              </div>
              {records.length > 0 ? (
                <table className="w-full">
                  <thead className="bg-gray-50 border-b">
                    <tr>
                      <th className="text-left px-6 py-3 font-bold text-gray-600 text-sm">视频名称</th>
                      <th className="text-left px-6 py-3 font-bold text-gray-600 text-sm">孩子</th>
                      <th className="text-left px-6 py-3 font-bold text-gray-600 text-sm">观看时长</th>
                      <th className="text-left px-6 py-3 font-bold text-gray-600 text-sm">播放速度</th>
                      <th className="text-left px-6 py-3 font-bold text-gray-600 text-sm">时间</th>
                    </tr>
                  </thead>
                  <tbody>
                    {records.map((record) => (
                      <tr key={record.id} className="border-b hover:bg-gray-50">
                        <td className="px-6 py-3 font-medium text-gray-800">{record.videoTitle}</td>
                        <td className="px-6 py-3 text-gray-600">{record.childName}</td>
                        <td className="px-6 py-3 text-gray-600">{formatDuration(record.watchedDuration)}</td>
                        <td className="px-6 py-3">
                          <span className="px-2 py-1 bg-blue-100 text-blue-700 rounded text-sm font-medium">
                            {record.playbackRate}x
                          </span>
                        </td>
                        <td className="px-6 py-3 text-gray-500 text-sm">
                          {formatDate(record.watchedAt)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              ) : (
                <div className="p-12 text-center">
                  <div className="text-4xl mb-2">📊</div>
                  <p className="text-gray-500">暂无学习记录</p>
                </div>
              )}
            </div>
          </div>
        )}

        {activeTab === 'settings' && (
          <div className="bg-white rounded-2xl shadow-md p-8">
            <h2 className="text-xl font-bold text-gray-800 mb-6">GitHub 云端同步设置</h2>
            <p className="text-gray-500 mb-6">
              配置 GitHub Token 后，上传的视频会自动同步到 GitHub 仓库，多台设备可以共享视频和分段数据。
            </p>
            
            <div className="space-y-6 max-w-xl">
              <div>
                <label className="block text-sm font-bold text-gray-700 mb-2">
                  GitHub Token
                </label>
                <input
                  type="password"
                  value={githubToken}
                  onChange={(e) => setGithubToken(e.target.value)}
                  placeholder="ghp_xxxxxxxxxxxxxxxxxxxx"
                  className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:border-blue-500 focus:outline-none transition-colors"
                />
                <p className="text-xs text-gray-400 mt-2">
                  Token 只保存在本机浏览器中，不会上传到任何服务器
                </p>
              </div>
              
              <div>
                <label className="block text-sm font-bold text-gray-700 mb-2">
                  仓库所有者
                </label>
                <input
                  type="text"
                  value={githubOwner}
                  onChange={(e) => setGithubOwner(e.target.value)}
                  className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:border-blue-500 focus:outline-none transition-colors"
                />
              </div>
              
              <div>
                <label className="block text-sm font-bold text-gray-700 mb-2">
                  仓库名称
                </label>
                <input
                  type="text"
                  value={githubRepo}
                  onChange={(e) => setGithubRepo(e.target.value)}
                  className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:border-blue-500 focus:outline-none transition-colors"
                />
              </div>
              
              <button
                onClick={handleSaveGithubSettings}
                className="bg-gradient-to-r from-blue-500 to-indigo-600 text-white px-8 py-3 rounded-xl font-bold hover:shadow-lg transition-all hover:scale-105"
              >
                保存设置
              </button>
            </div>
            
            <div className="mt-8 p-4 bg-amber-50 rounded-xl border border-amber-200">
              <h3 className="font-bold text-amber-800 mb-2">⚠️ 安全提示</h3>
              <p className="text-sm text-amber-700">
                GitHub Token 拥有仓库写入权限，请妥善保管。建议使用仅有单一仓库权限的 Fine-grained token。
              </p>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
