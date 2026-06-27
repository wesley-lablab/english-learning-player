import { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { 
  ArrowLeft, Play, Pause, Plus, Trash2, Edit3, Save,
  Flag, PlayCircle, HelpCircle, ChevronUp, ChevronDown
} from 'lucide-react';
import type { Video, Sentence } from '../types';
import { storageApi } from '../utils/storage';
import { formatTime, autoSplitSentences } from '../utils/pronunciation';

export default function SentenceEditor() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const videoRef = useRef<HTMLVideoElement>(null);
  
  const [video, setVideo] = useState<Video | null>(null);
  const [loading, setLoading] = useState(true);
  const [sentences, setSentences] = useState<Sentence[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [showHelp, setShowHelp] = useState(false);
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [editText, setEditText] = useState('');

  const duration = video?.duration || 0;

  useEffect(() => {
    loadVideo();
  }, [id]);

  const loadVideo = async () => {
    if (!id) return;
    setLoading(true);
    try {
      const res = await storageApi.videos.get(parseInt(id, 10));
      if (res.data) {
        setVideo(res.data);
        const saved = localStorage.getItem(`sentences_${id}`);
        if (saved) {
          setSentences(JSON.parse(saved));
        } else {
          const auto = autoSplitSentences(res.data.duration || 60, 5);
          setSentences(auto);
        }
      }
    } catch (e) {
      console.error(e);
    }
    setLoading(false);
  };

  const saveSentences = (newSentences: Sentence[]) => {
    setSentences(newSentences);
    localStorage.setItem(`sentences_${id}`, JSON.stringify(newSentences));
  };

  const handleTimeUpdate = useCallback(() => {
    if (videoRef.current) {
      setCurrentTime(videoRef.current.currentTime);
    }
  }, []);

  const playSentence = (index: number) => {
    if (!videoRef.current || !sentences[index]) return;
    videoRef.current.currentTime = sentences[index].startTime;
    videoRef.current.play();
    setIsPlaying(true);
    setCurrentIndex(index);
    
    const s = sentences[index];
    const checkEnd = setInterval(() => {
      if (videoRef.current && videoRef.current.currentTime >= s.endTime) {
        videoRef.current.pause();
        setIsPlaying(false);
        clearInterval(checkEnd);
      }
    }, 100);
  };

  const setAsStartTime = () => {
    if (editingIndex === null) return;
    const updated = [...sentences];
    updated[editingIndex] = {
      ...updated[editingIndex],
      startTime: Math.round(currentTime * 10) / 10,
    };
    saveSentences(updated);
  };

  const setAsEndTime = () => {
    if (editingIndex === null) return;
    const updated = [...sentences];
    updated[editingIndex] = {
      ...updated[editingIndex],
      endTime: Math.round(currentTime * 10) / 10,
    };
    saveSentences(updated);
  };

  const startEditing = (index: number) => {
    setEditingIndex(index);
    setEditText(sentences[index].text);
    setCurrentIndex(index);
  };

  const saveEditText = () => {
    if (editingIndex === null) return;
    const updated = [...sentences];
    updated[editingIndex] = {
      ...updated[editingIndex],
      text: editText,
    };
    saveSentences(updated);
    setEditingIndex(null);
  };

  const addSentence = () => {
    const newSentence: Sentence = {
      id: `sentence_${Date.now()}`,
      text: '',
      startTime: Math.round(currentTime * 10) / 10,
      endTime: Math.round((currentTime + 5) * 10) / 10,
    };
    const updated = [...sentences, newSentence];
    saveSentences(updated);
    setCurrentIndex(updated.length - 1);
    setEditingIndex(updated.length - 1);
    setEditText('');
  };

  const deleteSentence = (index: number) => {
    if (!confirm('确定删除这个句子吗？')) return;
    const updated = sentences.filter((_, i) => i !== index);
    saveSentences(updated);
    if (currentIndex >= updated.length) {
      setCurrentIndex(Math.max(0, updated.length - 1));
    }
    if (editingIndex === index) {
      setEditingIndex(null);
    }
  };

  const autoSplit = () => {
    if (!video || !confirm('确定要自动重新分割吗？当前编辑的内容会被替换。')) return;
    const auto = autoSplitSentences(video.duration || 60, 5);
    saveSentences(auto);
    setCurrentIndex(0);
    setEditingIndex(null);
  };

  const moveSentence = (index: number, direction: 'up' | 'down') => {
    const target = direction === 'up' ? index - 1 : index + 1;
    if (target < 0 || target >= sentences.length) return;
    const updated = [...sentences];
    [updated[index], updated[target]] = [updated[target], updated[index]];
    saveSentences(updated);
    setCurrentIndex(target);
    if (editingIndex === index) setEditingIndex(target);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="text-6xl mb-4 animate-bounce">⏳</div>
          <p className="text-xl text-gray-600">加载中...</p>
        </div>
      </div>
    );
  }

  if (!video) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="text-6xl mb-4">😢</div>
          <p className="text-xl text-gray-600">视频不存在</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <video
        ref={videoRef}
        src={video.fileDataUrl}
        className="hidden"
        onTimeUpdate={handleTimeUpdate}
        onPlay={() => setIsPlaying(true)}
        onPause={() => setIsPlaying(false)}
        onEnded={() => setIsPlaying(false)}
      />

      <header className="bg-white border-b shadow-sm">
        <div className="max-w-5xl mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <button
              onClick={() => navigate('/parent/dashboard')}
              className="flex items-center gap-2 text-gray-600 hover:text-gray-800"
            >
              <ArrowLeft className="w-5 h-5" />
              <span className="font-medium">返回管理后台</span>
            </button>
            <div className="text-center">
              <h1 className="text-xl font-bold text-gray-800">跟读句子编辑</h1>
              <p className="text-sm text-gray-500 truncate max-w-xs">{video.title}</p>
            </div>
            <button
              onClick={() => setShowHelp(!showHelp)}
              className="w-10 h-10 bg-gray-100 hover:bg-gray-200 rounded-full flex items-center justify-center"
            >
              <HelpCircle className="w-5 h-5 text-gray-600" />
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-6 py-6">
        {showHelp && (
          <div className="mb-6 bg-blue-50 border border-blue-200 rounded-2xl p-5">
            <h3 className="font-bold text-blue-800 mb-3">💡 编辑句子使用指南</h3>
            <div className="space-y-2 text-sm text-blue-700">
              <p><strong>第一步：</strong>播放视频，找到句子开始的地方，点"设开始"</p>
              <p><strong>第二步：</strong>播放到句子结束，点"设结束"</p>
              <p><strong>第三步：</strong>点"编辑"输入句子的英文内容</p>
              <p><strong>提示：</strong>可以用"自动分割"快速生成5个平均时间段，再逐个调整</p>
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* 左侧：视频和时间轴 */}
          <div className="space-y-4">
            <div className="bg-white rounded-2xl shadow-lg p-4">
              <div className="relative bg-black rounded-xl overflow-hidden aspect-video mb-4">
                <video
                  src={video.fileDataUrl}
                  className="w-full h-full object-contain"
                  controls
                  onTimeUpdate={handleTimeUpdate}
                />
              </div>

              <div className="mb-4">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm text-gray-500">{formatTime(currentTime)}</span>
                  <span className="text-sm text-gray-500">{formatTime(duration)}</span>
                </div>
                <div className="relative h-10 bg-gray-100 rounded-lg overflow-hidden">
                  {sentences.map((s, i) => (
                    <div
                      key={s.id}
                      className={`absolute top-0 h-full cursor-pointer ${
                        i === editingIndex ? 'bg-emerald-500/60' :
                        i === currentIndex ? 'bg-blue-500/60' :
                        'bg-gray-300/60 hover:bg-gray-400/60'
                      }`}
                      style={{
                        left: `${(s.startTime / duration) * 100}%`,
                        width: `${Math.max(2, ((s.endTime - s.startTime) / duration) * 100)}%`,
                      }}
                      onClick={() => setCurrentIndex(i)}
                    >
                      <div className="absolute inset-0 flex items-center justify-center text-xs text-white font-bold">
                        {i + 1}
                      </div>
                    </div>
                  ))}
                  <div
                    className="absolute top-0 bottom-0 w-0.5 bg-red-500 z-10"
                    style={{ left: `${(currentTime / duration) * 100}%` }}
                  />
                </div>
              </div>

              {editingIndex !== null && sentences[editingIndex] && (
                <div className="bg-emerald-50 rounded-xl p-4 border border-emerald-200">
                  <div className="flex items-center justify-between mb-3">
                    <span className="font-bold text-emerald-700">
                      正在编辑：句子 {editingIndex + 1}
                    </span>
                    <span className="text-sm text-emerald-600">
                      {formatTime(sentences[editingIndex].startTime)} - {formatTime(sentences[editingIndex].endTime)}
                    </span>
                  </div>
                  <div className="grid grid-cols-3 gap-2">
                    <button
                      onClick={() => playSentence(editingIndex)}
                      className="py-2 bg-emerald-500 text-white rounded-lg font-medium hover:bg-emerald-600 flex items-center justify-center gap-1"
                    >
                      <PlayCircle className="w-4 h-4" />
                      播放
                    </button>
                    <button
                      onClick={setAsStartTime}
                      className="py-2 bg-blue-500 text-white rounded-lg font-medium hover:bg-blue-600 flex items-center justify-center gap-1"
                    >
                      <Flag className="w-4 h-4" />
                      设开始
                    </button>
                    <button
                      onClick={setAsEndTime}
                      className="py-2 bg-orange-500 text-white rounded-lg font-medium hover:bg-orange-600 flex items-center justify-center gap-1"
                    >
                      <Flag className="w-4 h-4" />
                      设结束
                    </button>
                  </div>
                  <p className="text-xs text-emerald-600 mt-2 text-center">
                    💡 拖动视频到指定位置后点击按钮
                  </p>
                </div>
              )}
            </div>
          </div>

          {/* 右侧：句子列表 */}
          <div className="space-y-4">
            <div className="bg-white rounded-2xl shadow-lg p-4">
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-bold text-gray-700">
                  句子列表
                  <span className="text-sm font-normal text-gray-400 ml-2">({sentences.length}句)</span>
                </h3>
                <div className="flex gap-2">
                  <button
                    onClick={autoSplit}
                    className="text-sm px-3 py-1.5 bg-blue-100 text-blue-600 rounded-lg hover:bg-blue-200"
                  >
                    自动分割
                  </button>
                  <button
                    onClick={addSentence}
                    className="text-sm px-3 py-1.5 bg-green-100 text-green-600 rounded-lg hover:bg-green-200 flex items-center gap-1"
                  >
                    <Plus className="w-4 h-4" />
                    添加
                  </button>
                </div>
              </div>

              <div className="space-y-2 max-h-[500px] overflow-y-auto pr-1">
                {sentences.map((s, i) => (
                  <div
                    key={s.id}
                    className={`rounded-xl border-2 transition-all ${
                      editingIndex === i ? 'border-emerald-400 bg-emerald-50' :
                      currentIndex === i ? 'border-blue-300 bg-blue-50' :
                      'border-gray-200 bg-white hover:border-gray-300'
                    }`}
                  >
                    <div className="p-3">
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2">
                          <span className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${
                            editingIndex === i ? 'bg-emerald-500 text-white' :
                            currentIndex === i ? 'bg-blue-500 text-white' :
                            'bg-gray-200 text-gray-600'
                          }`}>
                            {i + 1}
                          </span>
                          <span className="text-xs text-gray-500">
                            {formatTime(s.startTime)} - {formatTime(s.endTime)}
                          </span>
                        </div>
                        <div className="flex gap-1">
                          <button
                            onClick={() => moveSentence(i, 'up')}
                            disabled={i === 0}
                            className="p-1 hover:bg-gray-200 rounded disabled:opacity-30"
                          >
                            <ChevronUp className="w-4 h-4 text-gray-500" />
                          </button>
                          <button
                            onClick={() => moveSentence(i, 'down')}
                            disabled={i === sentences.length - 1}
                            className="p-1 hover:bg-gray-200 rounded disabled:opacity-30"
                          >
                            <ChevronDown className="w-4 h-4 text-gray-500" />
                          </button>
                          <button
                            onClick={() => playSentence(i)}
                            className="p-1 hover:bg-blue-100 rounded text-blue-600"
                          >
                            <Play className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => startEditing(i)}
                            className="p-1 hover:bg-emerald-100 rounded text-emerald-600"
                          >
                            <Edit3 className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => deleteSentence(i)}
                            className="p-1 hover:bg-red-100 rounded text-red-500"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>

                      {editingIndex === i ? (
                        <div>
                          <textarea
                            className="w-full p-3 border-2 border-emerald-300 rounded-lg focus:border-emerald-500 focus:outline-none"
                            rows={2}
                            placeholder="输入句子文本..."
                            value={editText}
                            onChange={(e) => setEditText(e.target.value)}
                            autoFocus
                          />
                          <div className="flex gap-2 mt-2">
                            <button
                              onClick={saveEditText}
                              className="flex-1 py-2 bg-emerald-500 text-white rounded-lg font-bold hover:bg-emerald-600 flex items-center justify-center gap-1"
                            >
                              <Save className="w-4 h-4" />
                              保存句子
                            </button>
                            <button
                              onClick={() => setEditingIndex(null)}
                              className="px-4 py-2 bg-gray-200 rounded-lg hover:bg-gray-300"
                            >
                              取消
                            </button>
                          </div>
                        </div>
                      ) : (
                        <p className={`text-sm ${s.text ? 'text-gray-700' : 'text-gray-400 italic'}`}>
                          {s.text || '（未设置文本，点击编辑按钮添加）'}
                        </p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="bg-white rounded-2xl shadow-lg p-4">
              <h3 className="font-bold text-gray-700 mb-3">📋 编辑步骤</h3>
              <ol className="space-y-2 text-sm text-gray-600">
                <li className="flex gap-2">
                  <span className="w-5 h-5 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center text-xs font-bold shrink-0">1</span>
                  <span>点句子右边的"编辑"按钮开始编辑</span>
                </li>
                <li className="flex gap-2">
                  <span className="w-5 h-5 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center text-xs font-bold shrink-0">2</span>
                  <span>播放视频到句子开始，点"设开始"</span>
                </li>
                <li className="flex gap-2">
                  <span className="w-5 h-5 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center text-xs font-bold shrink-0">3</span>
                  <span>播放到句子结束，点"设结束"</span>
                </li>
                <li className="flex gap-2">
                  <span className="w-5 h-5 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center text-xs font-bold shrink-0">4</span>
                  <span>输入句子文本，点"保存句子"</span>
                </li>
              </ol>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
