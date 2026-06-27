import { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { 
  ArrowLeft, Mic, MicOff, Play, Pause, RotateCcw, 
  CheckCircle, XCircle, Volume2, SkipForward, SkipBack,
  ChevronRight, ChevronLeft, Edit3, Trash2, Plus,
  Flag, PlayCircle, GripHorizontal, Headphones, HelpCircle
} from 'lucide-react';
import type { Video, Sentence } from '../types';
import { storageApi } from '../utils/storage';
import { 
  calculateSimilarity, getScore, generateFeedback, 
  formatTime, autoSplitSentences 
} from '../utils/pronunciation';
import { useSpeechRecognition } from '../hooks/useSpeechRecognition';

export default function PracticeSession() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const videoRef = useRef<HTMLVideoElement>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  
  const [video, setVideo] = useState<Video | null>(null);
  const [loading, setLoading] = useState(true);
  const [sentences, setSentences] = useState<Sentence[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [isRecording, setIsRecording] = useState(false);
  const [recognizedText, setRecognizedText] = useState('');
  const [result, setResult] = useState<{ accuracy: number; feedback: string; score: string } | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [recordedAudioUrl, setRecordedAudioUrl] = useState<string | null>(null);
  const [isPlayingRecording, setIsPlayingRecording] = useState(false);
  const [showHelp, setShowHelp] = useState(false);

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

  const loadVideo = async () => {
    if (!id) return;
    setLoading(true);
    try {
      const res = await storageApi.videos.get(parseInt(id, 10));
      if (res.data) {
        setVideo(res.data);
        const savedSentences = localStorage.getItem(`sentences_${id}`);
        if (savedSentences) {
          setSentences(JSON.parse(savedSentences));
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

  const togglePlay = useCallback(() => {
    if (!videoRef.current) return;
    if (videoRef.current.paused) {
      videoRef.current.play();
      setIsPlaying(true);
    } else {
      videoRef.current.pause();
      setIsPlaying(false);
    }
  }, []);

  const currentSentence = sentences[currentIndex];
  const duration = video?.duration || 0;

  const seekTo = (time: number) => {
    if (!videoRef.current) return;
    videoRef.current.currentTime = time;
    setCurrentTime(time);
  };

  const playSentence = useCallback(() => {
    if (!videoRef.current || !currentSentence) return;
    videoRef.current.currentTime = currentSentence.startTime;
    videoRef.current.play();
    setIsPlaying(true);
  }, [currentSentence]);

  const setAsStartTime = () => {
    if (!currentSentence) return;
    const updated = [...sentences];
    updated[currentIndex] = {
      ...updated[currentIndex],
      startTime: Math.round(currentTime * 10) / 10,
    };
    saveSentences(updated);
  };

  const setAsEndTime = () => {
    if (!currentSentence) return;
    const updated = [...sentences];
    updated[currentIndex] = {
      ...updated[currentIndex],
      endTime: Math.round(currentTime * 10) / 10,
    };
    saveSentences(updated);
  };

  const updateSentenceText = (text: string) => {
    const updated = [...sentences];
    updated[currentIndex] = { ...updated[currentIndex], text };
    saveSentences(updated);
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
  };

  const deleteSentence = () => {
    if (sentences.length <= 1) return;
    if (!confirm('确定删除这个句子吗？')) return;
    const updated = sentences.filter((_, i) => i !== currentIndex);
    saveSentences(updated);
    if (currentIndex >= updated.length) {
      setCurrentIndex(updated.length - 1);
    }
  };

  const autoSplit = () => {
    if (!video) return;
    const auto = autoSplitSentences(video.duration || 60, 5);
    saveSentences(auto);
  };

  const startRecording = async () => {
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      alert('您的浏览器不支持录音功能');
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];

      mediaRecorder.ondataavailable = (e) => {
        audioChunksRef.current.push(e.data);
      };

      mediaRecorder.onstop = () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        const url = URL.createObjectURL(audioBlob);
        setRecordedAudioUrl(url);
        stream.getTracks().forEach(track => track.stop());
      };

      mediaRecorder.start();
      startListening();
      setIsRecording(true);
      setRecognizedText('');
      setResult(null);
      resetTranscript();
    } catch (e) {
      console.error('录音失败', e);
      alert('无法访问麦克风，请检查权限设置');
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      stopListening();
      setIsRecording(false);
    }
  };

  const playRecording = () => {
    if (!recordedAudioUrl) return;
    
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
    }
    
    const audio = new Audio(recordedAudioUrl);
    audioRef.current = audio;
    audio.onplay = () => setIsPlayingRecording(true);
    audio.onended = () => setIsPlayingRecording(false);
    audio.play();
  };

  const handleCompare = () => {
    if (!recognizedText || !currentSentence) return;
    
    const accuracy = calculateSimilarity(currentSentence.text, recognizedText);
    const score = getScore(accuracy);
    const feedback = generateFeedback(accuracy, currentSentence.text, recognizedText);
    
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
    setRecordedAudioUrl(null);
    setIsPlayingRecording(false);
    resetTranscript();
    if (videoRef.current) {
      videoRef.current.pause();
    }
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
    }
  };

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
      {/* 隐藏的视频 */}
      <video
        ref={videoRef}
        src={video.fileDataUrl}
        className="hidden"
        onTimeUpdate={handleTimeUpdate}
        onPlay={() => setIsPlaying(true)}
        onPause={() => setIsPlaying(false)}
        onEnded={() => setIsPlaying(false)}
      />

      <header className="bg-gradient-to-r from-emerald-500 to-teal-600 text-white py-4 px-4 shadow-lg">
        <div className="max-w-4xl mx-auto flex items-center justify-between">
          <button
            onClick={() => navigate(`/kid/video/${id}`)}
            className="flex items-center gap-2 bg-white/20 hover:bg-white/30 px-4 py-2 rounded-full transition-all"
          >
            <ArrowLeft className="w-5 h-5" />
            <span className="font-bold">返回</span>
          </button>
          <div className="text-center">
            <h1 className="text-xl font-bold">跟读练习</h1>
            <p className="text-white/80 text-xs truncate max-w-[200px]">{video.title}</p>
          </div>
          <button
            onClick={() => setShowHelp(!showHelp)}
            className="w-10 h-10 bg-white/20 hover:bg-white/30 rounded-full flex items-center justify-center"
          >
            <HelpCircle className="w-5 h-5" />
          </button>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 py-6">
        {/* 帮助面板 */}
        {showHelp && (
          <div className="mb-6 bg-blue-50 border border-blue-200 rounded-2xl p-4">
            <h3 className="font-bold text-blue-800 mb-3">💡 跟读练习使用指南</h3>
            <div className="space-y-2 text-sm text-blue-700">
              <p><strong>📌 编辑句子：</strong>点击"编辑"按钮可以修改句子内容</p>
              <p><strong>⏱️ 设置时间：</strong>播放视频到指定位置，点击"设为开始"或"设为结束"</p>
              <p><strong>🎤 跟读录音：</strong>点击麦克风开始跟读，录完后可以回放自己的声音</p>
              <p><strong>📊 对比评分：</strong>系统会自动对比你的发音和原句</p>
            </div>
          </div>
        )}

        {/* 句子导航 */}
        <div className="mb-4 bg-white rounded-2xl shadow-lg p-3">
          <div className="flex items-center justify-between mb-2">
            <span className="font-bold text-gray-700 text-sm">句子列表</span>
            <div className="flex gap-2">
              <button
                onClick={autoSplit}
                className="text-xs px-3 py-1 bg-blue-100 text-blue-600 rounded-lg hover:bg-blue-200"
              >
                自动分割
              </button>
              <button
                onClick={addSentence}
                className="text-xs px-3 py-1 bg-green-100 text-green-600 rounded-lg hover:bg-green-200 flex items-center gap-1"
              >
                <Plus className="w-3 h-3" />
                添加
              </button>
            </div>
          </div>
          <div className="flex gap-2 overflow-x-auto pb-1">
            {sentences.map((s, i) => (
              <button
                key={s.id}
                onClick={() => { setCurrentIndex(i); resetState(); }}
                className={`px-3 py-2 rounded-xl font-medium whitespace-nowrap transition-all text-sm ${
                  i === currentIndex
                    ? 'bg-emerald-500 text-white shadow-md'
                    : s.text
                    ? 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                    : 'bg-yellow-50 text-yellow-600 border border-yellow-200'
                }`}
              >
                {i + 1}
              </button>
            ))}
          </div>
        </div>

        {currentSentence && (
          <>
            {/* 视频播放 + 时间轴 */}
            <div className="bg-white rounded-2xl shadow-lg p-4 mb-4">
              {/* 视频显示区域 */}
              <div className="relative bg-black rounded-xl overflow-hidden mb-4 aspect-video">
                <video
                  src={video.fileDataUrl}
                  className="w-full h-full object-contain"
                  controls
                  onTimeUpdate={handleTimeUpdate}
                />
              </div>

              {/* 可视化时间轴 */}
              <div className="mb-4">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm text-gray-500">{formatTime(currentTime)}</span>
                  <span className="text-sm text-gray-500">{formatTime(duration)}</span>
                </div>
                <div className="relative h-8 bg-gray-100 rounded-lg overflow-hidden">
                  {/* 句子区域标记 */}
                  {sentences.map((s, i) => (
                    <div
                      key={s.id}
                      className={`absolute top-0 h-full ${
                        i === currentIndex
                          ? 'bg-emerald-400/50'
                          : i < currentIndex
                          ? 'bg-blue-300/40'
                          : 'bg-gray-300/40'
                      }`}
                      style={{
                        left: `${(s.startTime / duration) * 100}%`,
                        width: `${Math.max(1, ((s.endTime - s.startTime) / duration) * 100)}%`,
                      }}
                    />
                  ))}
                  {/* 当前播放位置 */}
                  <div
                    className="absolute top-0 bottom-0 w-1 bg-red-500 z-10"
                    style={{ left: `${(currentTime / duration) * 100}%` }}
                  />
                </div>
                {/* 时间轴说明 */}
                <div className="flex justify-between mt-1 text-xs text-gray-400">
                  <span>开始</span>
                  <span>结束</span>
                </div>
              </div>

              {/* 当前句子时间信息 */}
              <div className="bg-gray-50 rounded-xl p-3 mb-4">
                <div className="flex items-center justify-between mb-2">
                  <span className="font-bold text-emerald-600">句子 {currentIndex + 1}</span>
                  <span className="text-sm text-gray-500">
                    {formatTime(currentSentence.startTime)} - {formatTime(currentSentence.endTime)}
                    <span className="ml-2 text-gray-400">
                      ({formatTime(currentSentence.endTime - currentSentence.startTime)})
                    </span>
                  </span>
                </div>
                
                {/* 时间设置按钮 */}
                <div className="flex gap-2 flex-wrap">
                  <button
                    onClick={playSentence}
                    className="flex-1 min-w-[100px] py-2 bg-emerald-500 text-white rounded-lg font-medium hover:bg-emerald-600 flex items-center justify-center gap-1"
                  >
                    <PlayCircle className="w-4 h-4" />
                    播放本句
                  </button>
                  <button
                    onClick={setAsStartTime}
                    className="flex-1 min-w-[100px] py-2 bg-blue-100 text-blue-600 rounded-lg font-medium hover:bg-blue-200 flex items-center justify-center gap-1"
                  >
                    <Flag className="w-4 h-4" />
                    设为开始
                  </button>
                  <button
                    onClick={setAsEndTime}
                    className="flex-1 min-w-[100px] py-2 bg-orange-100 text-orange-600 rounded-lg font-medium hover:bg-orange-200 flex items-center justify-center gap-1"
                  >
                    <Flag className="w-4 h-4" />
                    设为结束
                  </button>
                </div>
                <p className="text-xs text-gray-400 mt-2 text-center">
                  💡 拖动视频到指定位置，然后点击"设为开始/结束"
                </p>
              </div>

              {/* 句子文本编辑 */}
              {isEditing ? (
                <div className="mb-4">
                  <textarea
                    className="w-full p-3 border-2 border-emerald-300 rounded-xl focus:border-emerald-500 focus:outline-none text-lg"
                    rows={2}
                    placeholder="输入句子文本..."
                    value={currentSentence.text}
                    onChange={(e) => updateSentenceText(e.target.value)}
                  />
                  <div className="flex gap-2 mt-2">
                    <button
                      onClick={() => setIsEditing(false)}
                      className="flex-1 py-2 bg-emerald-500 text-white rounded-lg font-bold hover:bg-emerald-600"
                    >
                      ✓ 完成编辑
                    </button>
                    <button
                      onClick={deleteSentence}
                      className="py-2 px-4 bg-red-100 text-red-600 rounded-lg hover:bg-red-200"
                    >
                      <Trash2 className="w-5 h-5" />
                    </button>
                  </div>
                </div>
              ) : (
                <div className="mb-4">
                  <div className="flex items-start justify-between mb-2">
                    <p className={`text-2xl font-bold leading-relaxed flex-1 ${
                      currentSentence.text ? 'text-gray-800' : 'text-gray-400'
                    }`}>
                      {currentSentence.text || '📝 点击编辑按钮输入句子'}
                    </p>
                    <button
                      onClick={() => setIsEditing(true)}
                      className="p-2 bg-blue-100 text-blue-600 rounded-lg hover:bg-blue-200 ml-2 shrink-0"
                    >
                      <Edit3 className="w-5 h-5" />
                    </button>
                  </div>
                </div>
              )}

              {/* 上下句切换 */}
              <div className="flex items-center justify-center gap-4">
                <button
                  onClick={handlePrevious}
                  disabled={currentIndex === 0}
                  className="w-12 h-12 bg-gray-100 hover:bg-gray-200 rounded-full flex items-center justify-center disabled:opacity-40"
                >
                  <ChevronLeft className="w-6 h-6" />
                </button>
                <span className="text-gray-500 font-medium">
                  {currentIndex + 1} / {sentences.length}
                </span>
                <button
                  onClick={handleNext}
                  disabled={currentIndex === sentences.length - 1}
                  className="w-12 h-12 bg-gray-100 hover:bg-gray-200 rounded-full flex items-center justify-center disabled:opacity-40"
                >
                  <ChevronRight className="w-6 h-6" />
                </button>
              </div>
            </div>

            {/* 跟读区域 */}
            <div className="bg-white rounded-2xl shadow-lg p-4 mb-4">
              <h3 className="text-lg font-bold text-gray-700 mb-4 flex items-center gap-2">
                <Headphones className="w-5 h-5 text-emerald-500" />
                跟读练习
              </h3>

              {!isSupported ? (
                <div className="bg-red-50 text-red-600 p-4 rounded-xl text-center text-sm">
                  ⚠️ 您的浏览器不支持语音识别，请使用 Chrome 或 Safari
                </div>
              ) : (
                <>
                  {/* 录音按钮 */}
                  <div className="flex flex-col items-center gap-3 mb-4">
                    <button
                      onClick={isRecording ? stopRecording : startRecording}
                      className={`w-24 h-24 rounded-full flex items-center justify-center shadow-lg transition-all ${
                        isRecording
                          ? 'bg-red-500 animate-pulse scale-105'
                          : 'bg-gradient-to-r from-emerald-500 to-teal-600 hover:scale-105'
                      }`}
                    >
                      {isRecording ? (
                        <MicOff className="w-12 h-12 text-white" />
                      ) : (
                        <Mic className="w-12 h-12 text-white" />
                      )}
                    </button>
                    <p className={`font-medium ${isRecording ? 'text-red-500' : 'text-gray-600'}`}>
                      {isRecording ? '🔴 录音中... 点击停止' : '🎤 点击开始跟读'}
                    </p>
                  </div>

                  {/* 录音回放 */}
                  {recordedAudioUrl && !isRecording && (
                    <div className="mb-4 bg-purple-50 rounded-xl p-4">
                      <div className="flex items-center justify-between mb-2">
                        <span className="font-medium text-purple-700">你的录音</span>
                        <button
                          onClick={playRecording}
                          disabled={isPlayingRecording}
                          className="flex items-center gap-2 px-4 py-2 bg-purple-500 text-white rounded-lg hover:bg-purple-600 disabled:opacity-50"
                        >
                          {isPlayingRecording ? (
                            <><Pause className="w-4 h-4" />播放中</>
                          ) : (
                            <><Play className="w-4 h-4" />播放录音</>
                          )}
                        </button>
                      </div>
                      <p className="text-sm text-purple-600">
                        {isPlayingRecording ? '🔊 正在播放你的录音...' : '🎧 点击听听自己的发音'}
                      </p>
                    </div>
                  )}

                  {/* 识别结果 */}
                  {recognizedText && (
                    <div className="mb-4 bg-gray-50 rounded-xl p-4">
                      <p className="text-xs text-gray-500 mb-1">识别结果：</p>
                      <p className="text-lg text-gray-800">{recognizedText}</p>
                    </div>
                  )}

                  {/* 对比评分 */}
                  {result && (
                    <div className={`rounded-xl p-4 ${
                      result.score === 'excellent' ? 'bg-green-100' :
                      result.score === 'good' ? 'bg-blue-100' :
                      result.score === 'fair' ? 'bg-yellow-100' : 'bg-red-100'
                    }`}>
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2">
                          {result.score === 'excellent' || result.score === 'good' ? (
                            <CheckCircle className="w-6 h-6 text-green-600" />
                          ) : (
                            <XCircle className="w-6 h-6 text-red-600" />
                          )}
                          <span className="text-xl font-bold">
                            {result.score === 'excellent' ? '太棒了！' :
                             result.score === 'good' ? '很好！' :
                             result.score === 'fair' ? '还不错' : '继续加油'}
                          </span>
                        </div>
                        <div className="text-3xl font-bold text-emerald-600">
                          {result.accuracy}%
                        </div>
                      </div>
                      <p className="text-gray-700 mb-3">{result.feedback}</p>
                      <div className="flex gap-2 flex-wrap">
                        <button
                          onClick={resetState}
                          className="flex-1 py-2 bg-white rounded-lg font-bold hover:bg-gray-100 flex items-center justify-center gap-1"
                        >
                          <RotateCcw className="w-4 h-4" />
                          再读一遍
                        </button>
                        {currentIndex < sentences.length - 1 && (
                          <button
                            onClick={handleNext}
                            className="flex-1 py-2 bg-emerald-500 text-white rounded-lg font-bold hover:bg-emerald-600 flex items-center justify-center gap-1"
                          >
                            下一句
                            <ChevronRight className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    </div>
                  )}

                  {/* 对比按钮 */}
                  {recognizedText && !result && (
                    <div className="flex justify-center">
                      <button
                        onClick={handleCompare}
                        className="px-8 py-3 bg-gradient-to-r from-emerald-500 to-teal-600 text-white rounded-xl font-bold text-lg shadow-lg hover:scale-105 transition-transform"
                      >
                        📊 对比评分
                      </button>
                    </div>
                  )}
                </>
              )}
            </div>

            {/* 快速操作提示 */}
            <div className="bg-white rounded-2xl shadow-lg p-4">
              <h3 className="font-bold text-gray-700 mb-3">📝 快速上手指南</h3>
              <div className="space-y-2 text-sm text-gray-600">
                <div className="flex gap-3">
                  <span className="w-6 h-6 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center font-bold shrink-0">1</span>
                  <span>先看视频，找到要练习的句子</span>
                </div>
                <div className="flex gap-3">
                  <span className="w-6 h-6 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center font-bold shrink-0">2</span>
                  <span>拖动视频到句子开头，点"设为开始"；到结尾点"设为结束"</span>
                </div>
                <div className="flex gap-3">
                  <span className="w-6 h-6 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center font-bold shrink-0">3</span>
                  <span>点"编辑"输入句子的英文内容</span>
                </div>
                <div className="flex gap-3">
                  <span className="w-6 h-6 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center font-bold shrink-0">4</span>
                  <span>点麦克风跟读，录完可以回放，再对比评分</span>
                </div>
              </div>
            </div>
          </>
        )}
      </main>
    </div>
  );
}
