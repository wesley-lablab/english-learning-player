import { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { 
  ArrowLeft, Mic, MicOff, Play, Pause, RotateCcw, 
  CheckCircle, XCircle, Headphones, ChevronRight, ChevronLeft,
  PlayCircle, Volume2
} from 'lucide-react';
import type { Video, Sentence } from '../types';
import { storageApi } from '../utils/storage';
import { 
  calculateSimilarity, getScore, generateFeedback, 
  formatTime 
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
  const [isRecording, setIsRecording] = useState(false);
  const [recognizedText, setRecognizedText] = useState('');
  const [result, setResult] = useState<{ accuracy: number; feedback: string; score: string } | null>(null);
  const [recordedAudioUrl, setRecordedAudioUrl] = useState<string | null>(null);
  const [isPlayingRecording, setIsPlayingRecording] = useState(false);

  const { startListening, stopListening, transcript, resetTranscript, isSupported } = useSpeechRecognition({
    language: 'en-US',
    onResult: (res) => {
      if (res.isFinal) {
        setRecognizedText(res.transcript);
      }
    },
  });

  const currentSentence = sentences[currentIndex];
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
          const parsed = JSON.parse(saved);
          const hasText = parsed.filter((s: Sentence) => s.text).length;
          if (hasText > 0) {
            setSentences(parsed);
          } else {
            setSentences([]);
          }
        }
      }
    } catch (e) {
      console.error(e);
    }
    setLoading(false);
  };

  const handleTimeUpdate = useCallback(() => {
  }, []);

  const playSentence = useCallback(() => {
    if (!videoRef.current || !currentSentence) return;
    videoRef.current.currentTime = currentSentence.startTime;
    videoRef.current.play();
    setIsPlaying(true);
    
    const checkEnd = setInterval(() => {
      if (videoRef.current && videoRef.current.currentTime >= currentSentence.endTime) {
        videoRef.current.pause();
        setIsPlaying(false);
        clearInterval(checkEnd);
      }
    }, 100);
  }, [currentSentence]);

  const startRecording = async () => {
    if (!navigator.mediaDevices?.getUserMedia) {
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

  if (sentences.length === 0) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-green-50 via-emerald-50 to-teal-50 flex items-center justify-center">
        <div className="text-center max-w-md mx-auto px-6">
          <div className="text-6xl mb-4">📝</div>
          <h2 className="text-2xl font-bold text-gray-800 mb-2">还没有跟读内容</h2>
          <p className="text-gray-600 mb-6">
            请让爸爸妈妈先在管理后台添加跟读句子哦！
          </p>
          <button
            onClick={() => navigate(`/kid/video/${id}`)}
            className="px-8 py-3 bg-gradient-to-r from-emerald-500 to-teal-600 text-white rounded-xl font-bold"
          >
            返回视频
          </button>
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

      <header className="bg-gradient-to-r from-orange-400 via-orange-500 to-yellow-400 text-white py-4 px-4 shadow-lg">
        <div className="max-w-3xl mx-auto flex items-center justify-between">
          <button
            onClick={() => navigate(`/kid/video/${id}`)}
            className="flex items-center gap-2 bg-white/20 hover:bg-white/30 px-4 py-2 rounded-full transition-all"
          >
            <ArrowLeft className="w-5 h-5" />
            <span className="font-bold">返回</span>
          </button>
          <div className="text-center">
            <h1 className="text-xl font-bold">🎤 跟读练习</h1>
            <p className="text-white/90 text-xs">第 {currentIndex + 1} 句 / 共 {sentences.length} 句</p>
          </div>
          <div className="w-20" />
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-4 py-6">
        {currentSentence && (
          <>
            {/* 进度条 */}
            <div className="mb-6">
              <div className="flex gap-1.5">
                {sentences.map((_, i) => (
                  <div
                    key={i}
                    className={`flex-1 h-2 rounded-full transition-all ${
                      i < currentIndex
                        ? 'bg-green-500'
                        : i === currentIndex
                        ? 'bg-orange-500'
                        : 'bg-gray-300'
                    }`}
                  />
                ))}
              </div>
            </div>

            {/* 句子卡片 */}
            <div className="bg-white rounded-3xl shadow-xl p-6 mb-6">
              <div className="text-center mb-6">
                <div className="inline-block px-4 py-1 bg-orange-100 text-orange-600 rounded-full text-sm font-bold mb-4">
                  句子 {currentIndex + 1} / {sentences.length}
                </div>
                <p className="text-3xl font-bold text-gray-800 leading-relaxed">
                  {currentSentence.text}
                </p>
                <div className="flex items-center justify-center gap-2 mt-3 text-gray-500">
                  <PlayCircle className="w-4 h-4" />
                  <span className="text-sm">
                    {formatTime(currentSentence.startTime)} - {formatTime(currentSentence.endTime)}
                  </span>
                </div>
              </div>

              {/* 播放控制 */}
              <div className="flex items-center justify-center gap-4 mb-6">
                <button
                  onClick={handlePrevious}
                  disabled={currentIndex === 0}
                  className="w-14 h-14 bg-gray-100 hover:bg-gray-200 rounded-full flex items-center justify-center disabled:opacity-40 transition-colors"
                >
                  <ChevronLeft className="w-7 h-7 text-gray-600" />
                </button>
                <button
                  onClick={playSentence}
                  className="w-20 h-20 bg-gradient-to-r from-orange-400 to-yellow-500 text-white rounded-full flex items-center justify-center shadow-lg hover:scale-105 transition-transform active:scale-95"
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
                  className="w-14 h-14 bg-gray-100 hover:bg-gray-200 rounded-full flex items-center justify-center disabled:opacity-40 transition-colors"
                >
                  <ChevronRight className="w-7 h-7 text-gray-600" />
                </button>
              </div>

              <div className="text-center text-sm text-gray-500">
                👆 点击播放按钮听原句
              </div>
            </div>

            {/* 跟读录音卡片 */}
            <div className="bg-white rounded-3xl shadow-xl p-6 mb-6">
              <h3 className="text-xl font-bold text-gray-700 mb-4 flex items-center justify-center gap-2">
                <Headphones className="w-6 h-6 text-emerald-500" />
                你的跟读
              </h3>

              {!isSupported ? (
                <div className="bg-red-50 text-red-600 p-4 rounded-2xl text-center">
                  ⚠️ 您的浏览器不支持语音识别，请使用 Chrome 或 Safari
                </div>
              ) : (
                <>
                  {/* 录音按钮 */}
                  <div className="flex flex-col items-center gap-3 mb-4">
                    <button
                      onClick={isRecording ? stopRecording : startRecording}
                      className={`w-28 h-28 rounded-full flex items-center justify-center shadow-xl transition-all ${
                        isRecording
                          ? 'bg-red-500 animate-pulse scale-105'
                          : 'bg-gradient-to-r from-emerald-500 to-teal-600 hover:scale-105 active:scale-95'
                      }`}
                    >
                      {isRecording ? (
                        <MicOff className="w-14 h-14 text-white" />
                      ) : (
                        <Mic className="w-14 h-14 text-white" />
                      )}
                    </button>
                    <p className={`font-bold text-lg ${isRecording ? 'text-red-500' : 'text-gray-600'}`}>
                      {isRecording ? '🔴 录音中... 点击停止' : '🎤 点击开始跟读'}
                    </p>
                  </div>

                  {/* 录音回放 */}
                  {recordedAudioUrl && !isRecording && (
                    <div className="mb-4 bg-purple-50 rounded-2xl p-4">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <Volume2 className="w-5 h-5 text-purple-500" />
                          <span className="font-medium text-purple-700">听我刚才读的</span>
                        </div>
                        <button
                          onClick={playRecording}
                          disabled={isPlayingRecording}
                          className="px-5 py-2 bg-purple-500 text-white rounded-xl font-bold hover:bg-purple-600 disabled:opacity-50 flex items-center gap-2"
                        >
                          {isPlayingRecording ? (
                            <><Pause className="w-4 h-4" />播放中</>
                          ) : (
                            <><Play className="w-4 h-4" />回放</>
                          )}
                        </button>
                      </div>
                    </div>
                  )}

                  {/* 识别结果 */}
                  {recognizedText && (
                    <div className="mb-4 bg-gray-50 rounded-2xl p-4">
                      <p className="text-xs text-gray-500 mb-2">📝 系统识别你读的是：</p>
                      <p className="text-lg text-gray-800">{recognizedText}</p>
                    </div>
                  )}

                  {/* 对比结果 */}
                  {result && (
                    <div className={`rounded-2xl p-5 ${
                      result.score === 'excellent' ? 'bg-green-100' :
                      result.score === 'good' ? 'bg-blue-100' :
                      result.score === 'fair' ? 'bg-yellow-100' : 'bg-red-100'
                    }`}>
                      <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center gap-2">
                          {result.score === 'excellent' || result.score === 'good' ? (
                            <CheckCircle className="w-8 h-8 text-green-600" />
                          ) : (
                            <XCircle className="w-8 h-8 text-red-600" />
                          )}
                          <span className="text-2xl font-bold">
                            {result.score === 'excellent' ? '太棒了！🎉' :
                             result.score === 'good' ? '很好！💪' :
                             result.score === 'fair' ? '还不错 😊' : '继续加油 💪'}
                          </span>
                        </div>
                        <div className="text-4xl font-bold text-emerald-600">
                          {result.accuracy}%
                        </div>
                      </div>
                      <p className="text-lg text-gray-700 mb-4">{result.feedback}</p>
                      <div className="flex gap-3">
                        <button
                          onClick={resetState}
                          className="flex-1 py-3 bg-white rounded-xl font-bold hover:bg-gray-100 flex items-center justify-center gap-2"
                        >
                          <RotateCcw className="w-5 h-5" />
                          再读一遍
                        </button>
                        {currentIndex < sentences.length - 1 && (
                          <button
                            onClick={handleNext}
                            className="flex-1 py-3 bg-emerald-500 text-white rounded-xl font-bold hover:bg-emerald-600 flex items-center justify-center gap-2"
                          >
                            下一句
                            <ChevronRight className="w-5 h-5" />
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
                        className="px-10 py-4 bg-gradient-to-r from-emerald-500 to-teal-600 text-white rounded-2xl font-bold text-xl shadow-lg hover:scale-105 transition-transform active:scale-95"
                      >
                        📊 看看我读得怎么样
                      </button>
                    </div>
                  )}
                </>
              )}
            </div>

            {/* 小提示 */}
            <div className="bg-white/60 rounded-2xl p-4 text-center">
              <p className="text-sm text-gray-500">
                💡 小提示：先听 2-3 遍原句，熟悉了再跟读效果更好哦！
              </p>
            </div>
          </>
        )}
      </main>
    </div>
  );
}
