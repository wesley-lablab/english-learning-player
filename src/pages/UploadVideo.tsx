import { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Upload, ArrowLeft, FileVideo, CheckCircle, X, Loader2, FolderPlus } from 'lucide-react';
import type { Course } from '../types';
import { storageApi } from '../utils/storage';

export default function UploadVideo() {
  const navigate = useNavigate();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [selectedCourseId, setSelectedCourseId] = useState<number | undefined>();
  const [courses, setCourses] = useState<Course[]>([]);
  const [showNewCourse, setShowNewCourse] = useState(false);
  const [newCourseTitle, setNewCourseTitle] = useState('');
  const [newCourseIcon, setNewCourseIcon] = useState('📚');
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    loadCourses();
  }, []);

  const loadCourses = async () => {
    const res = await storageApi.courses.list();
    if (res.data) {
      setCourses(res.data);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile) {
      setError('');
      setFile(selectedFile);
      if (!title) {
        setTitle(selectedFile.name.replace(/\.[^/.]+$/, ''));
      }
    }
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleCreateCourse = async () => {
    if (!newCourseTitle.trim()) {
      setError('请输入课程名称');
      return;
    }
    
    const res = await storageApi.courses.create(newCourseTitle, '', newCourseIcon);
    if (res.success && res.data) {
      setCourses([...courses, res.data]);
      setSelectedCourseId(res.data.id);
      setShowNewCourse(false);
      setNewCourseTitle('');
    } else {
      setError(res.error || '创建课程失败');
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!file) {
      setError('请选择文件');
      return;
    }
    if (!title.trim()) {
      setError('请输入标题');
      return;
    }

    setError('');
    setUploading(true);
    setProgress(0);

    try {
      const result = await storageApi.videos.upload(
        file,
        title,
        description,
        selectedCourseId,
        (percent) => {
          setProgress(percent);
        }
      );

      if (result.success) {
        setSuccess(true);
        setTimeout(() => {
          navigate('/parent/dashboard');
        }, 1500);
      } else {
        setError(result.error || '上传失败');
      }
    } catch (e) {
      setError('上传失败：' + (e as Error).message);
    } finally {
      setUploading(false);
    }
  };

  const removeFile = () => {
    setFile(null);
    setTitle('');
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  if (success) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="w-24 h-24 mx-auto bg-green-100 rounded-full flex items-center justify-center mb-6 animate-bounce">
            <CheckCircle className="w-12 h-12 text-green-500" />
          </div>
          <h2 className="text-2xl font-bold text-gray-800 mb-2">上传成功！</h2>
          <p className="text-gray-600">正在跳转...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white shadow-sm py-4 px-6">
        <div className="max-w-2xl mx-auto flex items-center gap-4">
          <button
            onClick={() => navigate('/parent/dashboard')}
            className="w-10 h-10 bg-gray-100 hover:bg-gray-200 rounded-full flex items-center justify-center transition-all"
          >
            <ArrowLeft className="w-5 h-5 text-gray-600" />
          </button>
          <h1 className="text-xl font-bold text-gray-800">上传视频</h1>
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-6 py-8">
        <form onSubmit={handleSubmit} className="space-y-6">
          {/* 文件选择 */}
          <div className="bg-white rounded-2xl p-6 shadow-sm">
            <h2 className="text-lg font-bold text-gray-800 mb-4">选择文件</h2>
            
            {file ? (
              <div className="flex items-center gap-4 bg-green-50 rounded-xl p-4">
                <div className="w-12 h-12 bg-green-100 rounded-xl flex items-center justify-center">
                  <FileVideo className="w-6 h-6 text-green-600" />
                </div>
                <div className="flex-1">
                  <p className="font-medium text-gray-800 truncate">{file.name}</p>
                  <p className="text-sm text-gray-500">{(file.size / 1024 / 1024).toFixed(2)} MB</p>
                </div>
                <button
                  type="button"
                  onClick={removeFile}
                  className="w-10 h-10 bg-red-100 hover:bg-red-200 rounded-full flex items-center justify-center transition-all"
                >
                  <X className="w-5 h-5 text-red-600" />
                </button>
              </div>
            ) : (
              <div
                onClick={() => fileInputRef.current?.click()}
                className="border-2 border-dashed border-gray-300 rounded-xl p-8 text-center cursor-pointer hover:border-orange-400 hover:bg-orange-50 transition-all"
              >
                <Upload className="w-12 h-12 mx-auto text-gray-400 mb-3" />
                <p className="text-gray-600">点击选择视频或音频文件</p>
                <p className="text-sm text-gray-400 mt-1">支持 mp4, mov, mp3 等格式</p>
              </div>
            )}
            
            <input
              ref={fileInputRef}
              type="file"
              accept="video/*,audio/*"
              onChange={handleFileChange}
              className="hidden"
            />
          </div>

          {/* 课程选择 */}
          <div className="bg-white rounded-2xl p-6 shadow-sm">
            <h2 className="text-lg font-bold text-gray-800 mb-4">选择课程</h2>
            
            <div className="space-y-2">
              {courses.map((course) => (
                <button
                  key={course.id}
                  type="button"
                  onClick={() => setSelectedCourseId(course.id)}
                  className={`w-full p-4 rounded-xl flex items-center gap-3 transition-all text-left ${
                    selectedCourseId === course.id
                      ? 'bg-orange-100 border-2 border-orange-400'
                      : 'bg-gray-50 hover:bg-gray-100 border-2 border-transparent'
                  }`}
                >
                  <span className="text-2xl">{course.icon}</span>
                  <div className="flex-1">
                    <p className="font-medium text-gray-800">{course.title}</p>
                    <p className="text-sm text-gray-500">{course.videoIds.length} 个视频</p>
                  </div>
                  {selectedCourseId === course.id && (
                    <CheckCircle className="w-6 h-6 text-orange-500" />
                  )}
                </button>
              ))}
              
              {!showNewCourse && (
                <button
                  type="button"
                  onClick={() => setShowNewCourse(true)}
                  className="w-full p-4 rounded-xl flex items-center gap-3 bg-gray-50 hover:bg-gray-100 border-2 border-dashed border-gray-300 transition-all"
                >
                  <FolderPlus className="w-6 h-6 text-gray-400" />
                  <span className="text-gray-600">创建新课程</span>
                </button>
              )}
            </div>
            
            {showNewCourse && (
              <div className="mt-4 p-4 bg-orange-50 rounded-xl space-y-3">
                <input
                  type="text"
                  value={newCourseTitle}
                  onChange={(e) => setNewCourseTitle(e.target.value)}
                  placeholder="输入课程名称"
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-400 focus:border-orange-400 outline-none"
                />
                <div className="flex gap-2">
                  {['📚', '🎬', '🎵', '📖', '✏️', '🌟'].map((icon) => (
                    <button
                      key={icon}
                      type="button"
                      onClick={() => setNewCourseIcon(icon)}
                      className={`w-10 h-10 rounded-lg text-xl flex items-center justify-center transition-all ${
                        newCourseIcon === icon ? 'bg-orange-400 text-white' : 'bg-white hover:bg-gray-100'
                      }`}
                    >
                      {icon}
                    </button>
                  ))}
                </div>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={handleCreateCourse}
                    className="flex-1 bg-orange-500 text-white py-2 rounded-lg hover:bg-orange-600 transition-all"
                  >
                    确认创建
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowNewCourse(false)}
                    className="px-4 bg-gray-200 text-gray-600 rounded-lg hover:bg-gray-300 transition-all"
                  >
                    取消
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* 标题和描述 */}
          <div className="bg-white rounded-2xl p-6 shadow-sm space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">标题</label>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="输入视频标题"
                className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-orange-400 focus:border-orange-400 outline-none"
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">描述（可选）</label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="输入视频描述"
                rows={3}
                className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-orange-400 focus:border-orange-400 outline-none resize-none"
              />
            </div>
          </div>

          {/* 上传进度 */}
          {uploading && (
            <div className="bg-white rounded-2xl p-6 shadow-sm">
              <div className="flex items-center gap-3 mb-3">
                <Loader2 className="w-5 h-5 text-orange-500 animate-spin" />
                <span className="font-medium text-gray-800">上传中...</span>
                <span className="text-gray-500">{progress}%</span>
              </div>
              <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-orange-400 to-orange-500 transition-all"
                  style={{ width: `${progress}%` }}
                />
              </div>
            </div>
          )}

          {/* 错误提示 */}
          {error && (
            <div className="bg-red-50 text-red-600 px-4 py-3 rounded-xl">
              {error}
            </div>
          )}

          {/* 提交按钮 */}
          <button
            type="submit"
            disabled={uploading || !file || !title.trim()}
            className="w-full bg-gradient-to-r from-orange-500 to-orange-600 text-white py-4 rounded-xl font-bold text-lg shadow-lg hover:shadow-xl transition-all disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {uploading ? '上传中...' : '开始上传'}
          </button>
        </form>
      </main>
    </div>
  );
}
