import { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { 
  ArrowLeft, Mic, MicOff, Play, Pause, RotateCcw, 
  CheckCircle, XCircle, Volume2, SkipForward, SkipBack,
  ChevronRight, ChevronLeft, Edit3, Save, Trash2, Plus
} from 'lucide-react';
import type { Video, Sentence } from '../types';
import { storageApi } from '../utils/storage';
import { 
  calculateSimilarity, getScore, generateFeedback, 
  formatTime, autoSplitSentences, isSpeechRecognitionSupported 
} from '../utils/pronunciation';
import { useSpeechRecognition } from '../hooks/useSpeechRecognition';

export default function PracticeSession() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const videoRef = useRef<HTMLVideoElement>(null);
  
  const [video, setVideo] = useState<Video | null>(null);
  const [loading, setLoading] = useState(true);
  const [sentences, setSentences] = useState<Sentence[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [recognizedText, setRecognizedText] = useState('');
  const [result, setResult] = useState<{ accuracy: number; feedback: string; score: string } | null>(null);
  const [showTranslation, setShowTranslation] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editingSentence, setEditingSentence] = useState<Sentence | null>(null);

  const { startListening, stopListening, transcript, resetTranscript, isSupported } = useSpeechRecognition({
    language: 'en-US',
    onResult: (res) => {
      if (res.isFinal) {
        setRecognizedText(res.transcript);
      }
    },
  });

  useEffect(() => {
    loadVideo();
  }, [id]);

  useEffect(() => {
    if (isPlaying) {
      videoRef.current?.play();
    } else {
      videoRef.current?.pause();
    }
  }, [isPlaying]);

  const loadVideo = async () => {
    if (!id) return;
    setLoading(true);
    try {
      const res = await storageApi.videos.get(parseInt(id, 10));
      if (res.data) {
        setVideo(res.data);
        // 加载句子数据
        const savedSentences = localStorage.getItem(`sentences_${id}`);
        if (savedSentences) {
          setSentences(JSON.parse(savedSentences));
        } else {
          // 自动分割
          const auto = autoSplitSentences(res.data.duration || 60, 5);
          setSentences(auto);
        }
      }
    } catch (e) {
      console.error(e);
    }
    setLoading(false);
  };

  const handlePlaySentence = useCallback(() => {
    if (!videoRef.current || sentences.length === 0) return;
    
    const current = sentences[currentIndex];
    videoRef.current.currentTime = current.startTime;
    setIsPlaying(true);
    
    const checkTime = setInterval(() => {
      if (videoRef.current && videoRef.current.currentTime >= current.endTime) {
        videoRef.current.pause();
        setIsPlaying(false);
        clearInterval(checkTime);
      }
    }, 100);
  }, [currentIndex, sentences]);

  const handleRecord = () => {
    if (isRecording) {
      stopListening();
      setIsRecording(false);
    } else {
      resetTranscript();
      setRecognizedText('');
      setResult(null);
      startListening();
      setIsRecording(true);
    }
  };

  const handleCompare = () => {
    if (!recognizedText || sentences.length === 0) return;
    
    const current = sentences[currentIndex];
    const accuracy = calculateSimilarity(current.text, recognizedText);
    const score = getScore(accuracy);
    const feedback = generateFeedback(accuracy, current.text, recognizedText);
    
    setResult({ accuracy, feedback, score });
  };

  const handleNext = () => {
    if (currentIndex < sentences.length - 1) {
      setCurrentIndex(currentIndex + 1);
      resetState();
    }
  };

  const handlePrevious = () => {
    if (currentIndex > 0) {
      setCurrentIndex(currentIndex - 1);
      resetState();
    }
  };

  const resetState = () => {
    setIsPlaying(false);
    setIsRecording(false);
    setRecognizedText('');
    setResult(null);
    resetTranscript();
    if (videoRef.current) {
      videoRef.current.pause();
    }
  };

  const handleTimeChange = (newTime: number) => {
    if (videoRef.current) {
      videoRef.current.currentTime = newTime;
    }
  };

  const handleUpdateSentence = (index: number, newText: string) => {
    const updated = [...sentences];
    updated[index] = { ...updated[index], text: newText };
    setSentences(updated);
    localStorage.setItem(`sentences_${id}`, JSON.stringify(updated));
    setIsEditing(false);
    setEditingSentence(null);
  };

  const handleAddSentence = () => {
    const newSentence: Sentence = {
      id: `sentence_${Date.now()}`,
      text: '',
      startTime: 0,
      endTime: 0,
    };
    setSentences([...sentences, newSentence]);
    setEditingSentence(newSentence);
    setIsEditing(true);
  };

  const handleDeleteSentence = (index: number) => {
    const updated = sentences.filter((_, i) => i !== index);
    setSentences(updated);
    localStorage.setItem(`sentences_${id}`, JSON.stringify(updated));
    if (currentIndex >= updated.length) {
      setCurrentIndex(Math.max(0, updated.length - 1));
    }
  };

  const handleAutoSplit = () => {
    if (!video) return;
    const auto = autoSplitSentences(video.duration || 60, 5);
    setSentences(auto);
    localStorage.setItem(`sentences_${id}`, JSON.stringify(auto));
  };

  const currentSentence = sentences[currentIndex];

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-green-50 via-emerald-50 to-teal-50 flex items-center justify-center">
        <div className="text-center">
          <div className="text-6xl mb-4 animate-bounce">🎯</div>
          <p className="text-xl text-gray-600">加载中...</p>
        </div>
      </div>
    );
  }

  if (!video) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-green-50 via-emerald-50 to-teal-50 flex items-center justify-center">
        <div className="text-center">
          <div className="text-6xl mb-4">😢</div>
          <p className="text-xl text-gray-600">视频不存在</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-green-50 via-emerald-50 to-teal-50">
      {/* 隐藏的视频播放器 */}
      <video
        ref={videoRef}
        src={video.fileDataUrl}
        className="hidden"
        onTimeUpdate={() => {
          if (isPlaying && currentSentence && videoRef.current) {
            if (videoRef.current.currentTime >= currentSentence.endTime) {
              setIsPlaying(false);
              videoRef.current.pause();
            }
          }
        }}
        onEnded={() => setIsPlaying(false)}
      />

      <header className="bg-gradient-to-r from-emerald-500 to-teal-600 text-white py-5 px-6 shadow-lg">
        <div className="max-w-4xl mx-auto flex items-center justify-between">
          <button
            onClick={() => navigate(`/kid/video/${id}`)}
            className="flex items-center gap-2 bg-white/20 hover:bg-white/30 px-5 py-3 rounded-full transition-all"
          >
            <ArrowLeft className="w-6 h-6" />
            <span className="text-lg font-bold">返回</span>
          </button>
          <div className="text-center">
            <h1 className="text-2xl font-bold">跟读练习</h1>
            <p className="text-white/80 text-sm">{video.title}</p>
          </div>
          <div className="text-sm bg-white/20 px-4 py-2 rounded-full">
            {currentIndex + 1} / {sentences.length}
          </div>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-6 py-8">
        {/* 句子导航 */}
        <div className="mb-6 bg-white rounded-2xl shadow-lg p-4">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-bold text-gray-700">句子列表</h3>
            <div className="flex gap-2">
              <button
                onClick={handleAutoSplit}
                className="text-sm px-3 py-1 bg-blue-100 text-blue-600 rounded-lg hover:bg-blue-200"
              >
                自动分割
              </button>
              <button
                onClick={handleAddSentence}
                className="text-sm px-3 py-1 bg-green-100 text-green-600 rounded-lg hover:bg-green-200"
              >
                添加句子
              </button>
            </div>
          </div>
          <div className="flex gap-2 overflow-x-auto pb-2">
            {sentences.map((s, i) => (
              <button
                key={s.id}
                onClick={() => { setCurrentIndex(i); resetState(); }}
                className={`px-4 py-2 rounded-xl font-medium whitespace-nowrap transition-all ${
                  i === currentIndex
                    ? 'bg-emerald-500 text-white shadow-md'
                    : s.text
                    ? 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                    : 'bg-yellow-50 text-yellow-600 border border-yellow-200'
                }`}
              >
                {i + 1}. {s.text ? (s.text.length > 15 ? s.text.substring(0, 15) + '...' : s.text) : '待编辑'}
              </button>
            ))}
          </div>
        </div>

        {/* 当前句子 */}
        {currentSentence && (
          <div className="bg-white rounded-3xl shadow-xl p-8 mb-6">
            {/* 句子时间显示 */}
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-4">
                <span className="text-3xl font-bold text-emerald-600">
                  句子 {currentIndex + 1}
                </span>
                <span className="text-gray-500">
                  {formatTime(currentSentence.startTime)} - {formatTime(currentSentence.endTime)}
                </span>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => handleTimeChange(Math.max(0, currentSentence.startTime - 5))}
                  className="p-2 bg-gray-100 rounded-lg hover:bg-gray-200"
                >
                  <SkipBack className="w-5 h-5" />
                </button>
                <button
                  onClick={() => handleTimeChange(Math.min(video.duration, currentSentence.endTime + 5))}
                  className="p-2 bg-gray-100 rounded-lg hover:bg-gray-200"
                >
                  <SkipForward className="w-5 h-5" />
                </button>
                <button
                  onClick={() => setShowTranslation(!showTranslation)}
                  className="px-4 py-2 bg-purple-100 text-purple-600 rounded-lg hover:bg-purple-200"
                >
                  {showTranslation ? '隐藏翻译' : '显示翻译'}
                </button>
              </div>
            </div>

            {/* 编辑/显示句子文本 */}
            {isEditing && editingSentence ? (
              <div className="mb-6">
                <textarea
                  className="w-full p-4 border-2 border-emerald-300 rounded-xl focus:border-emerald-500 focus:outline-none text-xl"
                  rows={3}
                  placeholder="输入句子文本..."
                  value={editingSentence.text}
                  onChange={(e) => setEditingSentence({ ...editingSentence, text: e.target.value })}
                />
                <div className="flex gap-2 mt-2">
                  <input
                    type="number"
                    className="w-24 px-3 py-2 border rounded-lg"
                    placeholder="开始"
                    value={editingSentence.startTime}
                    onChange={(e) => setEditingSentence({ ...editingSentence, startTime: parseFloat(e.target.value) || 0 })}
                  />
                  <input
                    type="number"
                    className="w-24 px-3 py-2 border rounded-lg"
                    placeholder="结束"
                    value={editingSentence.endTime}
                    onChange={(e) => setEditingSentence({ ...editingSentence, endTime: parseFloat(e.target.value) || 0 })}
                  />
                  <button
                    onClick={() => handleUpdateSentence(currentIndex, editingSentence.text)}
                    className="flex-1 bg-emerald-500 text-white px-4 py-2 rounded-lg hover:bg-emerald-600"
                  >
                    保存
                  </button>
                  <button
                    onClick={() => { setIsEditing(false); setEditingSentence(null); }}
                    className="px-4 py-2 bg-gray-200 rounded-lg hover:bg-gray-300"
                  >
                    取消
                  </button>
                  <button
                    onClick={() => handleDeleteSentence(currentIndex)}
                    className="px-4 py-2 bg-red-100 text-red-600 rounded-lg hover:bg-red-200"
                  >
                    <Trash2 className="w-5 h-5" />
                  </button>
                </div>
              </div>
            ) : (
              <div className="mb-6">
                <div className="flex items-start justify-between">
                  <p className="text-3xl font-bold text-gray-800 leading-relaxed flex-1">
                    {currentSentence.text || '⚠️ 请先编辑句子文本'}
                  </p>
                  {currentSentence.text && (
                    <button
                      onClick={() => { setEditingSentence(currentSentence); setIsEditing(true); }}
                      className="p-2 bg-blue-100 text-blue-600 rounded-lg hover:bg-blue-200 ml-4"
                    >
                      <Edit3 className="w-5 h-5" />
                    </button>
                  )}
                </div>
                {showTranslation && currentSentence.translation && (
                  <p className="text-xl text-gray-500 mt-3">{currentSentence.translation}</p>
                )}
              </div>
            )}

            {/* 播放控制 */}
            <div className="flex items-center justify-center gap-4 mb-8">
              <button
                onClick={handlePrevious}
                disabled={currentIndex === 0}
                className="w-14 h-14 bg-gray-100 hover:bg-gray-200 rounded-full flex items-center justify-center disabled:opacity-50"
              >
                <ChevronLeft className="w-8 h-8" />
              </button>
              <button
                onClick={handlePlaySentence}
                className="w-20 h-20 bg-gradient-to-r from-emerald-500 to-teal-600 text-white rounded-full flex items-center justify-center shadow-lg hover:scale-105 transition-transform"
              >
                {isPlaying ? (
                  <Pause className="w-10 h-10" />
                ) : (
                  <Play className="w-10 h-10 ml-1" />
                )}
              </button>
              <button
                onClick={handleNext}
                disabled={currentIndex === sentences.length - 1}
                className="w-14 h-14 bg-gray-100 hover:bg-gray-200 rounded-full flex items-center justify-center disabled:opacity-50"
              >
                <ChevronRight className="w-8 h-8" />
              </button>
            </div>

            {/* 跟读区域 */}
            <div className="border-t pt-6">
              <h4 className="text-xl font-bold text-gray-700 mb-4 flex items-center gap-2">
                <Volume2 className="w-6 h-6 text-emerald-500" />
                你的跟读
              </h4>
              
              {!isSupported ? (
                <div className="bg-red-50 text-red-600 p-4 rounded-xl text-center">
                  ⚠️ 您的浏览器不支持语音识别，请使用 Chrome 或 Safari
                </div>
              ) : (
                <>
                  <div className="flex flex-col items-center gap-4">
                    <button
                      onClick={handleRecord}
                      className={`w-32 h-32 rounded-full flex items-center justify-center shadow-lg transition-all ${
                        isRecording
                          ? 'bg-red-500 animate-pulse scale-110'
                          : 'bg-gradient-to-r from-emerald-500 to-teal-600 hover:scale-105'
                      }`}
                    >
                      {isRecording ? (
                        <MicOff className="w-16 h-16 text-white" />
                      ) : (
                        <Mic className="w-16 h-16 text-white" />
                      )}
                    </button>
                    <p className="text-gray-600">
                      {isRecording ? '🔴 录音中... 点击停止' : '点击开始跟读'}
                    </p>
                  </div>

                  {/* 识别结果 */}
                  {recognizedText && (
                    <div className="mt-6 bg-gray-50 rounded-xl p-4">
                      <p className="text-sm text-gray-500 mb-2">识别结果：</p>
                      <p className="text-xl text-gray-800">{recognizedText}</p>
                    </div>
                  )}

                  {/* 对比结果 */}
                  {result && (
                    <div className={`mt-6 rounded-xl p-6 ${
                      result.score === 'excellent' ? 'bg-green-100' :
                      result.score === 'good' ? 'bg-blue-100' :
                      result.score === 'fair' ? 'bg-yellow-100' : 'bg-red-100'
                    }`}>
                      <div className="flex items-center justify-between mb-4">
                        <div className="flex items-center gap-3">
                          {result.score === 'excellent' || result.score === 'good' ? (
                            <CheckCircle className="w-8 h-8 text-green-600" />
                          ) : (
                            <XCircle className="w-8 h-8 text-red-600" />
                          )}
                          <span className="text-2xl font-bold">
                            {result.score === 'excellent' ? '太棒了！' :
                             result.score === 'good' ? '很好！' :
                             result.score === 'fair' ? '还不错' : '继续加油'}
                          </span>
                        </div>
                        <div className="text-4xl font-bold text-emerald-600">
                          {result.accuracy}%
                        </div>
                      </div>
                      <p className="text-lg text-gray-700">{result.feedback}</p>
                      <div className="mt-4 flex gap-2">
                        <button
                          onClick={resetState}
                          className="px-6 py-3 bg-white rounded-xl font-bold hover:bg-gray-100"
                        >
                          <RotateCcw className="w-5 h-5 inline mr-2" />
                          再读一遍
                        </button>
                        {currentIndex < sentences.length - 1 && (
                          <button
                            onClick={handleNext}
                            className="px-6 py-3 bg-emerald-500 text-white rounded-xl font-bold hover:bg-emerald-600"
                          >
                            下一句
                            <ChevronRight className="w-5 h-5 inline ml-2" />
                          </button>
                        )}
                      </div>
                    </div>
                  )}

                  {/* 对比按钮 */}
                  {recognizedText && !result && (
                    <div className="mt-6 flex justify-center">
                      <button
                        onClick={handleCompare}
                        className="px-8 py-4 bg-gradient-to-r from-emerald-500 to-teal-600 text-white rounded-xl font-bold text-xl shadow-lg hover:scale-105 transition-transform"
                      >
                        对比评分
                      </button>
                    </div>
                  )}
                </>
              )}
            </div>
          </div>
        )}

        {/* 操作提示 */}
        <div className="bg-white rounded-2xl shadow-lg p-6">
          <h3 className="font-bold text-gray-700 mb-4">📝 使用说明</h3>
          <ol className="space-y-3 text-gray-600">
            <li className="flex items-start gap-3">
              <span className="w-8 h-8 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center font-bold">1</span>
              <span>先点击播放按钮听原句，模仿发音和语调</span>
            </li>
            <li className="flex items-start gap-3">
              <span className="w-8 h-8 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center font-bold">2</span>
              <span>点击麦克风开始录音，朗读刚才的句子</span>
            </li>
            <li className="flex items-start gap-3">
              <span className="w-8 h-8 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center font-bold">3</span>
              <span>点击"对比评分"查看你的发音准确度</span>
            </li>
            <li className="flex items-start gap-3">
              <span className="w-8 h-8 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center font-bold">4</span>
              <span>如果句子内容不正确，点击编辑按钮修改</span>
            </li>
          </ol>
        </div>
      </main>
    </div>
  );
}
