import { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { 
  ArrowLeft, Mic, MicOff, Play, Pause, RotateCcw, 
  CheckCircle, XCircle, Headphones, ChevronRight, ChevronLeft,
  PlayCircle, Volume2, Repeat, Repeat1
} from 'lucide-react';
import type { Video, Sentence } from '../types';
import { storageApi } from '../utils/storage';
import { 
  calculateSimilarity, getScore, generateFeedback, 
  formatTime 
} from '../utils/pronunciation';
import { useSpeechRecognition } from '../hooks/useSpeechRecognition';
import { setupMediaSession, updateMediaSessionPlaybackState, updateMediaSessionMetadata } from '../utils/mediaSession';

export default function PracticeSession() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const videoRef = useRef<HTMLVideoElement>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  
  const [video, setVideo] = useState<Video | null>(null);
  const [loading, setLoading] = useState(true);
  const [sentences, setSentences] = useState<Sentence[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [recognizedText, setRecognizedText] = useState('');
  const [result, setResult] = useState<{ 
    accuracy: number; 
    feedback: string; 
    score: string;
  } | null>(null);
  const [recordedAudioUrl, setRecordedAudioUrl] = useState<string | null>(null);
  const [isPlayingRecording, setIsPlayingRecording] = useState(false);
  const [loopMode, setLoopMode] = useState<'none' | 'single' | 'all'>('none');
  const loopModeRef = useRef<'none' | 'single' | 'all'>('none');
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const sentenceEndedRef = useRef(false);
  const seekingRef = useRef(false);
  const [videoError, setVideoError] = useState(false);
  const [videoLoading, setVideoLoading] = useState(true);

  const { startListening, stopListening, transcript, resetTranscript, isSupported } = useSpeechRecognition({
    language: 'en-US',
    onResult: (res) => {
      if (res.isFinal) {
        setRecognizedText(res.transcript);
      }
    },
  });

  const currentSentence = sentences[currentIndex];

  useEffect(() => {
    if (!video) return;
    
    setupMediaSession(
      video.title,
      '跟读练习',
      () => {
        if (videoRef.current) {
          videoRef.current.play();
        }
      },
      () => {
        if (videoRef.current) {
          videoRef.current.pause();
        }
      },
      () => {
        if (currentIndex < sentences.length - 1) {
          setCurrentIndex(currentIndex + 1);
        }
      },
      () => {
        if (currentIndex > 0) {
          setCurrentIndex(currentIndex - 1);
        }
      }
    );
    
    return () => {
      if ('mediaSession' in navigator) {
        try {
          navigator.mediaSession.playbackState = 'none';
        } catch (e) {}
      }
    };
  }, [video, currentIndex, sentences]);

  useEffect(() => {
    updateMediaSessionPlaybackState(isPlaying);
  }, [isPlaying]);

  useEffect(() => {
    if (currentSentence?.text) {
      updateMediaSessionMetadata(
        `第 ${currentIndex + 1} 句`,
        currentSentence.text
      );
    }
  }, [currentIndex, currentSentence]);

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
        if (res.data.sentences && res.data.sentences.length > 0) {
          setSentences(res.data.sentences);
        }
      }
    } catch (e) {
      console.error(e);
    }
    setLoading(false);
  };

  const playSentence = useCallback((index?: number) => {
    const targetIndex = index !== undefined ? index : currentIndex;
    const sentence = sentences[targetIndex];
    if (!videoRef.current || !sentence) return;
    
    if (index !== undefined) {
      setCurrentIndex(index);
    }
    
    sentenceEndedRef.current = false;
    seekingRef.current = true;
    
    const videoEl = videoRef.current;
    videoEl.currentTime = sentence.startTime;
    videoEl.muted = false;
    
    // 等待 seeked 事件触发后再播放
    const handleSeeked = () => {
      seekingRef.current = false;
      videoEl.removeEventListener('seeked', handleSeeked);
      videoEl.play().catch(e => console.warn('播放失败:', e));
      setIsPlaying(true);
    };
    
    videoEl.addEventListener('seeked', handleSeeked);
    
    // 如果视频已经在这个位置，直接播放
    if (Math.abs(videoEl.currentTime - sentence.startTime) < 0.1) {
      seekingRef.current = false;
      videoEl.removeEventListener('seeked', handleSeeked);
      videoEl.play().catch(e => console.warn('播放失败:', e));
      setIsPlaying(true);
    }
  }, [currentIndex, sentences]);

  const handleSentenceEnded = useCallback(() => {
    const mode = loopModeRef.current;
    const videoEl = videoRef.current;
    
    if (mode === 'single') {
      if (videoEl && currentSentence) {
        sentenceEndedRef.current = false;
        seekingRef.current = true;
        videoEl.currentTime = currentSentence.startTime;
        
        const handleSeeked = () => {
          seekingRef.current = false;
          videoEl.removeEventListener('seeked', handleSeeked);
          videoEl.play().catch(e => console.warn('播放失败:', e));
        };
        
        videoEl.addEventListener('seeked', handleSeeked);
        
        if (Math.abs(videoEl.currentTime - currentSentence.startTime) < 0.1) {
          seekingRef.current = false;
          videoEl.removeEventListener('seeked', handleSeeked);
          videoEl.play().catch(e => console.warn('播放失败:', e));
        }
      }
    } else if (mode === 'all') {
      const nextIndex = currentIndex < sentences.length - 1 ? currentIndex + 1 : 0;
      const nextSentence = sentences[nextIndex];
      if (videoEl && nextSentence) {
        setCurrentIndex(nextIndex);
        sentenceEndedRef.current = false;
        seekingRef.current = true;
        videoEl.currentTime = nextSentence.startTime;
        
        const handleSeeked = () => {
          seekingRef.current = false;
          videoEl.removeEventListener('seeked', handleSeeked);
          videoEl.play().catch(e => console.warn('播放失败:', e));
        };
        
        videoEl.addEventListener('seeked', handleSeeked);
        
        if (Math.abs(videoEl.currentTime - nextSentence.startTime) < 0.1) {
          seekingRef.current = false;
          videoEl.removeEventListener('seeked', handleSeeked);
          videoEl.play().catch(e => console.warn('播放失败:', e));
        }
      }
    } else {
      setIsPlaying(false);
    }
  }, [currentIndex, sentences, currentSentence]);

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

      mediaRecorder.onstop = async () => {
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
      setRecordedAudioUrl(null);
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
    sentenceEndedRef.current = false;
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

            {/* 原音区 */}
            <div className="bg-white rounded-3xl shadow-xl p-5 mb-4">
              <div className="flex items-center gap-2 mb-3">
                <div className="w-10 h-10 bg-orange-100 rounded-full flex items-center justify-center">
                  <PlayCircle className="w-5 h-5 text-orange-500" />
                </div>
                <div>
                  <h3 className="font-bold text-gray-700">原音</h3>
                  <p className="text-xs text-gray-400">
                    {formatTime(currentSentence.startTime)} - {formatTime(currentSentence.endTime)}
                  </p>
                </div>
              </div>

              {/* 视频播放器 */}
              <div className="relative rounded-2xl overflow-hidden bg-black mb-4 shadow-inner">
                <video
                  ref={videoRef}
                  src={video.fileDataUrl}
                  className="w-full h-auto block"
                  onPlay={() => setIsPlaying(true)}
                  onPause={() => setIsPlaying(false)}
                  onEnded={() => setIsPlaying(false)}
                  onLoadedData={() => {
                    setVideoLoading(false);
                    setVideoError(false);
                  }}
                  onError={(e) => {
                    console.error('视频加载错误:', e);
                    setVideoLoading(false);
                    setVideoError(true);
                  }}
                  onWaiting={() => setVideoLoading(true)}
                  onCanPlay={() => setVideoLoading(false)}
                  onTimeUpdate={() => {
                    // 如果正在 seeking，不检查
                    if (seekingRef.current) return;
                    
                    if (videoRef.current && currentSentence && !sentenceEndedRef.current) {
                      if (videoRef.current.currentTime >= currentSentence.endTime) {
                        sentenceEndedRef.current = true;
                        videoRef.current.pause();
                        handleSentenceEnded();
                      }
                    }
                  }}
                  playsInline
                  controls={false}
                  preload="metadata"
                />
                {/* 加载中提示 */}
                {videoLoading && !videoError && (
                  <div className="absolute inset-0 flex items-center justify-center bg-black/50">
                    <div className="text-center text-white">
                      <div className="w-10 h-10 border-4 border-white/30 border-t-white rounded-full animate-spin mx-auto mb-2" />
                      <p className="text-sm">加载中...</p>
                    </div>
                  </div>
                )}

                {/* 错误提示 */}
                {videoError && (
                  <div className="absolute inset-0 flex items-center justify-center bg-black/70">
                    <div className="text-center text-white px-4">
                      <div className="text-4xl mb-2">⚠️</div>
                      <p className="text-base font-medium mb-2">视频加载失败</p>
                      <button
                        onClick={() => {
                          setVideoError(false);
                          setVideoLoading(true);
                          if (videoRef.current) {
                            videoRef.current.load();
                          }
                        }}
                        className="px-4 py-2 bg-orange-500 rounded-lg text-sm font-bold hover:bg-orange-600"
                      >
                        重新加载
                      </button>
                    </div>
                  </div>
                )}
                
                {/* 循环按钮 - 视频右下角 */}
                <button
                  onClick={() => {
                    const modes: ('none' | 'single' | 'all')[] = ['none', 'single', 'all'];
                    const currentIdx = modes.indexOf(loopMode);
                    const nextMode = modes[(currentIdx + 1) % modes.length];
                    setLoopMode(nextMode);
                    loopModeRef.current = nextMode;
                  }}
                  className={`absolute bottom-3 right-3 px-3 py-1.5 rounded-full font-bold text-sm flex items-center gap-1 shadow-lg border-2 transition-all ${
                    loopMode === 'none'
                      ? 'bg-black/60 text-white border-white/30'
                      : loopMode === 'single'
                      ? 'bg-orange-500 text-white border-orange-300'
                      : 'bg-emerald-500 text-white border-emerald-300'
                  }`}
                >
                  {loopMode === 'single' ? (
                    <Repeat1 className="w-4 h-4" />
                  ) : (
                    <Repeat className="w-4 h-4" />
                  )}
                  {loopMode === 'none' ? '循环' :
                   loopMode === 'single' ? '单曲' : '全部'}
                </button>
                
                {/* 大播放按钮覆盖层 */}
                {!isPlaying && (
                  <button
                    onClick={() => playSentence()}
                    className="absolute inset-0 flex items-center justify-center bg-black/20 active:bg-black/30 transition-colors"
                  >
                    <div className="w-16 h-16 bg-white/90 rounded-full flex items-center justify-center shadow-xl">
                      <Play className="w-8 h-8 text-orange-500 ml-1" />
                    </div>
                  </button>
                )}
              </div>

              <p className="text-xl font-bold text-gray-800 leading-relaxed mb-4 px-2">
                {currentSentence.text}
              </p>

              {/* 第几段 + 播放按钮 */}
              <div className="text-center mb-3">
                <div className="inline-block bg-orange-100 text-orange-600 px-4 py-1.5 rounded-full text-sm font-bold mb-3">
                  📌 第 {currentIndex + 1} 段
                </div>
              </div>

              <div className="flex items-center justify-center gap-3">
                <button
                  onClick={handlePrevious}
                  disabled={currentIndex === 0}
                  className="w-12 h-12 bg-gray-100 hover:bg-gray-200 rounded-full flex items-center justify-center disabled:opacity-40 transition-colors"
                >
                  <ChevronLeft className="w-6 h-6 text-gray-600" />
                </button>
                <button
                  onClick={() => playSentence()}
                  className="w-16 h-16 bg-gradient-to-r from-orange-400 to-yellow-500 text-white rounded-full flex items-center justify-center shadow-lg hover:scale-105 transition-transform active:scale-95"
                >
                  {isPlaying ? (
                    <Pause className="w-8 h-8" />
                  ) : (
                    <Play className="w-8 h-8 ml-1" />
                  )}
                </button>
                <button
                  onClick={handleNext}
                  disabled={currentIndex === sentences.length - 1}
                  className="w-12 h-12 bg-gray-100 hover:bg-gray-200 rounded-full flex items-center justify-center disabled:opacity-40 transition-colors"
                >
                  <ChevronRight className="w-6 h-6 text-gray-600" />
                </button>
              </div>
            </div>

            {/* 跟读区 */}
            <div className="bg-white rounded-3xl shadow-xl p-5 mb-4">
              <div className="flex items-center gap-2 mb-3">
                <div className="w-10 h-10 bg-emerald-100 rounded-full flex items-center justify-center">
                  <Headphones className="w-5 h-5 text-emerald-500" />
                </div>
                <div>
                  <h3 className="font-bold text-gray-700">你的跟读</h3>
                  <p className="text-xs text-gray-400">点击麦克风开始录音</p>
                </div>
              </div>

              {!isSupported ? (
                <div className="bg-red-50 text-red-600 p-4 rounded-2xl text-center">
                  ⚠️ 您的浏览器不支持语音识别，请使用 Chrome 或 Safari
                </div>
              ) : (
                <>
                  <div className="flex flex-col items-center gap-2 mb-4">
                    <button
                      onClick={isRecording ? stopRecording : startRecording}
                      className={`w-20 h-20 rounded-full flex items-center justify-center shadow-xl transition-all ${
                        isRecording
                          ? 'bg-red-500 animate-pulse scale-105'
                          : 'bg-gradient-to-r from-emerald-500 to-teal-600 hover:scale-105 active:scale-95'
                      }`}
                    >
                      {isRecording ? (
                        <MicOff className="w-10 h-10 text-white" />
                      ) : (
                        <Mic className="w-10 h-10 text-white" />
                      )}
                    </button>
                    <p className={`font-bold ${isRecording ? 'text-red-500' : 'text-gray-600'}`}>
                      {isRecording ? '🔴 录音中... 点击停止' : '🎤 点击开始跟读'}
                    </p>
                  </div>

                  {recordedAudioUrl && !isRecording && (
                    <div className="mb-4 bg-purple-50 rounded-2xl p-3">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <Volume2 className="w-5 h-5 text-purple-500" />
                          <span className="font-medium text-purple-700">回放录音</span>
                        </div>
                        <button
                          onClick={playRecording}
                          disabled={isPlayingRecording}
                          className="px-4 py-2 bg-purple-500 text-white rounded-xl font-bold hover:bg-purple-600 disabled:opacity-50 flex items-center gap-2"
                        >
                          {isPlayingRecording ? (
                            <><Pause className="w-4 h-4" />播放中</>
                          ) : (
                            <><Play className="w-4 h-4" />听一下</>
                          )}
                        </button>
                      </div>
                    </div>
                  )}

                  {recognizedText && (
                    <div className="mb-4 bg-gray-50 rounded-2xl p-3">
                      <p className="text-xs text-gray-500 mb-1">📝 识别到你读的：</p>
                      <p className="text-base text-gray-800">{recognizedText}</p>
                    </div>
                  )}

                  {result && (
                    <div className={`rounded-2xl p-4 ${
                      result.score === 'excellent' ? 'bg-green-100' :
                      result.score === 'good' ? 'bg-blue-100' :
                      result.score === 'fair' ? 'bg-yellow-100' : 'bg-red-100'
                    }`}>
                      <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center gap-2">
                          {result.score === 'excellent' || result.score === 'good' ? (
                            <CheckCircle className="w-7 h-7 text-green-600" />
                          ) : (
                            <XCircle className="w-7 h-7 text-red-600" />
                          )}
                          <span className="text-xl font-bold">
                            {result.score === 'excellent' ? '太棒了！🎉' :
                             result.score === 'good' ? '很好！💪' :
                             result.score === 'fair' ? '还不错 😊' : '继续加油 💪'}
                          </span>
                        </div>
                        <div className="text-right">
                          <div className="text-3xl font-bold text-emerald-600">
                            {result.accuracy}%
                          </div>
                          <div className="text-xs text-gray-500">发音准确度</div>
                        </div>
                      </div>

                      <div className="bg-white/40 rounded-xl p-2.5 mb-3">
                        <div className="h-2.5 bg-gray-200 rounded-full overflow-hidden">
                          <div 
                            className="h-full bg-emerald-500 rounded-full transition-all"
                            style={{ width: `${result.accuracy}%` }}
                          />
                        </div>
                      </div>

                      <p className="text-base text-gray-700 mb-3">{result.feedback}</p>
                      <div className="flex gap-2">
                        <button
                          onClick={resetState}
                          className="flex-1 py-2.5 bg-white rounded-xl font-bold hover:bg-gray-100 flex items-center justify-center gap-1"
                        >
                          <RotateCcw className="w-4 h-4" />
                          再读一遍
                        </button>
                        {currentIndex < sentences.length - 1 && (
                          <button
                            onClick={handleNext}
                            className="flex-1 py-2.5 bg-emerald-500 text-white rounded-xl font-bold hover:bg-emerald-600 flex items-center justify-center gap-1"
                          >
                            下一句
                            <ChevronRight className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    </div>
                  )}

                  {recognizedText && !result && (
                    <div className="flex justify-center">
                      <button
                        onClick={handleCompare}
                        className="px-8 py-3 bg-gradient-to-r from-emerald-500 to-teal-600 text-white rounded-2xl font-bold text-lg shadow-lg hover:scale-105 transition-transform active:scale-95"
                      >
                        📊 对比评分
                      </button>
                    </div>
                  )}
                </>
              )}
            </div>
          </>
        )}
      </main>
    </div>
  );
}
