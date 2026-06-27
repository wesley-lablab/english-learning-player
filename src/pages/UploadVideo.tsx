import { useState, useRef, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Upload, ArrowLeft, FileVideo, CheckCircle, X, Loader2 } from 'lucide-react';
import type { Category } from '../types';
import { storageApi } from '../utils/storage';

export default function UploadVideo() {
  const navigate = useNavigate();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState('course');
  const [categories, setCategories] = useState<Category[]>([]);
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    loadCategories();
  }, []);

  const loadCategories = async () => {
    const res = await storageApi.categories.list();
    if (res.data) {
      setCategories(res.data);
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
        category,
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
          <p className="text-gray-500">即将跳转...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white shadow-sm border-b">
        <div className="max-w-3xl mx-auto px-6 py-4">
          <div className="flex items-center gap-4">
            <Link
              to="/parent/dashboard"
              className="w-10 h-10 hover:bg-gray-100 rounded-full flex items-center justify-center"
            >
              <ArrowLeft className="w-5 h-5 text-gray-600" />
            </Link>
            <h1 className="text-xl font-bold text-gray-800">上传文件</h1>
          </div>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-6 py-8">
        <form onSubmit={handleSubmit} className="space-y-6">
          {/* 文件选择区域 */}
          <div>
            <div className="block text-gray-700 font-bold mb-3">选择文件</div>
            {!file ? (
              <div className="relative w-full border-3 border-dashed border-gray-300 rounded-2xl bg-white hover:border-blue-400 hover:bg-blue-50 active:bg-blue-100 transition-all overflow-hidden" style={{ minHeight: '200px', WebkitTapHighlightColor: 'transparent' }}>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="video/*,image/*"
                  onChange={handleFileChange}
                  className="absolute inset-0 w-full h-full m-0 p-0 opacity-0 cursor-pointer"
                  style={{ zIndex: 20, fontSize: '0' }}
                />
                <div className="absolute inset-0 flex flex-col items-center justify-center p-8 pointer-events-none" style={{ zIndex: 10 }}>
                  <div className="w-20 h-20 bg-blue-100 rounded-full flex items-center justify-center mb-4">
                    <Upload className="w-10 h-10 text-blue-500" />
                  </div>
                  <p className="text-lg font-bold text-gray-700 mb-2">
                    点击选择文件
                  </p>
                  <p className="text-gray-500 text-sm text-center">
                    支持视频（MP4、MOV等）和图片文件
                  </p>
                  <p className="text-blue-500 text-sm mt-3">
                    👆 点击任意位置选择
                  </p>
                </div>
              </div>
            ) : (
              <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-200">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div className="w-14 h-14 bg-orange-100 rounded-xl flex items-center justify-center">
                      <FileVideo className="w-7 h-7 text-orange-500" />
                    </div>
                    <div>
                      <p className="font-bold text-gray-800">{file.name}</p>
                      <p className="text-sm text-gray-500">
                        {(file.size / (1024 * 1024)).toFixed(2)} MB
                      </p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={removeFile}
                    className="w-10 h-10 text-red-500 hover:bg-red-50 rounded-lg flex items-center justify-center"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* 上传进度 */}
          {uploading && (
            <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-200">
              <div className="flex items-center gap-3 mb-3">
                <Loader2 className="w-5 h-5 text-blue-500 animate-spin" />
                <span className="font-medium text-gray-700">
                  {progress < 10 ? '检查存储空间...' :
                   progress < 30 ? '读取文件信息...' :
                   progress < 60 ? '生成缩略图...' :
                   progress < 90 ? '保存到本地...' :
                   progress < 100 ? '即将完成...' :
                   '完成！'}
                  {progress > 0 && progress < 100 && ` ${progress}%`}
                </span>
              </div>
              <div className="w-full h-3 bg-gray-200 rounded-full overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-blue-500 to-blue-600 transition-all"
                  style={{ width: `${progress}%` }}
                />
              </div>
            </div>
          )}

          {/* 标题和分类 */}
          <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-200 space-y-5">
            <div>
              <label className="block text-gray-700 font-bold mb-2">标题 *</label>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="请输入标题"
                className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:border-blue-400 focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-gray-700 font-bold mb-2">分类</label>
              <div className="flex flex-wrap gap-2">
                {categories.map((cat) => (
                  <button
                    key={cat.id}
                    type="button"
                    onClick={() => setCategory(cat.id)}
                    className={`flex items-center gap-2 px-4 py-2 rounded-full font-medium transition-all ${
                      category === cat.id
                        ? 'text-white shadow-md'
                        : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                    }`}
                    style={category === cat.id ? { backgroundColor: cat.color } : {}}
                  >
                    <span>{cat.icon}</span>
                    <span>{cat.name}</span>
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="block text-gray-700 font-bold mb-2">描述（选填）</label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="请输入描述"
                rows={3}
                className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:border-blue-400 focus:outline-none resize-none"
              />
            </div>
          </div>

          {/* 错误提示 */}
          {error && (
            <div className="bg-red-50 text-red-500 p-4 rounded-xl text-center font-medium">
              {error}
            </div>
          )}

          {/* 提交按钮 */}
          <div className="flex gap-4">
            <button
              type="button"
              onClick={() => navigate('/parent/dashboard')}
              className="flex-1 py-4 border-2 border-gray-200 text-gray-600 font-bold rounded-xl hover:bg-gray-50"
            >
              取消
            </button>
            <button
              type="submit"
              disabled={uploading || !file || !title.trim()}
              className={`flex-1 py-4 font-bold rounded-xl shadow-lg transition-all flex items-center justify-center gap-2 ${
                uploading || !file || !title.trim()
                  ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                  : 'bg-gradient-to-r from-blue-500 to-indigo-600 text-white hover:shadow-xl'
              }`}
            >
              {uploading ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  保存中...
                </>
              ) : (
                <>
                  <Upload className="w-5 h-5" />
                  保存到本地
                </>
              )}
            </button>
          </div>
        </form>
      </main>
    </div>
  );
}