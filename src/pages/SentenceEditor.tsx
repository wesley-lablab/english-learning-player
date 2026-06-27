import { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { 
  ArrowLeft, Play, Pause, Plus, Trash2, Edit3, Save,
  Flag, PlayCircle, HelpCircle, GripVertical,
  MoveLeft, MoveRight, Scissors, ZoomIn, Mic, MicOff
} from 'lucide-react';
import type { Video, Sentence } from '../types';
import { storageApi } from '../utils/storage';
import { formatTime, autoSplitSentences } from '../utils/pronunciation';

type DragType = 'start' | 'end' | 'move' | null;

export default function SentenceEditor() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const timelineRef = useRef<HTMLDivElement>(null);
  const videoElRef = useRef<HTMLVideoElement>(null);
  const recognitionRef = useRef<any>(null);
  
  const [video, setVideo] = useState<Video | null>(null);
  const [loading, setLoading] = useState(true);
  const [sentences, setSentences] = useState<Sentence[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [showHelp, setShowHelp] = useState(false);
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [editText, setEditText] = useState('');
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const [dragType, setDragType] = useState<DragType>(null);
  const [dragStartX, setDragStartX] = useState(0);
  const [dragStartTime, setDragStartTime] = useState(0);
  const [dragEndTime, setDragEndTime] = useState(0);
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [transcribeSource, setTranscribeSource] = useState<'video' | 'mic' | null>(null);
  const [debugLog, setDebugLog] = useState<string[]>([]);
  const transcribeEndCheckRef = useRef<number | null>(null);

  const addLog = (msg: string) => {
    const time = new Date().toLocaleTimeString();
    console.log('[语音识别]', msg);
    setDebugLog(prev => [...prev.slice(-9), `[${time}] ${msg}`]);
  };

  const isSpeechSupported = 'webkitSpeechRecognition' in window || 'SpeechRecognition' in window;

  const startVideoTranscribe = () => {
    if (!sentences[currentIndex]) return;
    
    addLog('开始视频转文字...');
    
    if (editingIndex === null) {
      setEditingIndex(currentIndex);
    }
    setEditText('');
    addLog('文本框已清空');
    
    if (!isSpeechSupported) {
      addLog('错误：浏览器不支持语音识别');
      alert('您的浏览器不支持语音识别，请使用 Chrome 或 Safari');
      return;
    }
    
    const videoEl = videoElRef.current;
    if (!videoEl) {
      addLog('错误：找不到视频元素');
      alert('找不到视频元素');
      return;
    }
    addLog('找到视频元素，时长：' + videoEl.duration + '秒');
    
    try {
      const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
      const recognition = new SpeechRecognition();
      
      recognition.continuous = true;
      recognition.interimResults = true;
      recognition.lang = 'en-US';
      recognition.maxAlternatives = 1;
      
      let finalText = '';
      
      recognition.onstart = () => {
        addLog('语音识别已启动');
      };
      
      recognition.onresult = (event: any) => {
        let interimText = '';
        
        for (let i = event.resultIndex; i < event.results.length; i++) {
          const result = event.results[i];
          if (result.isFinal) {
            finalText += result[0].transcript;
            addLog('识别到最终结果：' + result[0].transcript);
          } else {
            interimText += result[0].transcript;
          }
        }
        
        const fullText = (finalText + interimText).trim();
        setEditText(fullText);
        addLog('当前识别文本：' + fullText);
      };
      
      recognition.onerror = (event: any) => {
        addLog('识别错误：' + event.error);
        setIsTranscribing(false);
        setTranscribeSource(null);
        if (event.error === 'not-allowed') {
          alert('麦克风权限被拒绝，请在浏览器设置中允许麦克风权限');
        }
      };
      
      recognition.onend = () => {
        addLog('语音识别已结束，最终文本：' + finalText);
        setIsTranscribing(false);
        setTranscribeSource(null);
        setEditText(finalText.trim());
        
        if (transcribeEndCheckRef.current) {
          clearInterval(transcribeEndCheckRef.current);
          transcribeEndCheckRef.current = null;
        }
      };
      
      recognitionRef.current = recognition;
      recognition.start();
      addLog('调用 recognition.start()');
      
      setIsTranscribing(true);
      setTranscribeSource('video');
      
      const s = sentences[currentIndex];
      addLog(`跳转视频到 ${s.startTime}秒，播放到 ${s.endTime}秒`);
      
      const playVideo = () => {
        videoEl.currentTime = s.startTime;
        const onSeeked = () => {
          videoEl.removeEventListener('seeked', onSeeked);
          addLog('视频跳转完成，开始播放');
          videoEl.play().then(() => {
            addLog('视频播放成功');
          }).catch((err) => {
            addLog('视频播放失败：' + err.message);
          });
        };
        videoEl.addEventListener('seeked', onSeeked);
      };
      
      setTimeout(playVideo, 300);
      
      transcribeEndCheckRef.current = window.setInterval(() => {
        if (!videoEl) return;
        if (videoEl.currentTime >= s.endTime) {
          addLog('视频播放到结束位置，停止播放和识别');
          videoEl.pause();
          
          try {
            recognition.stop();
          } catch (e) {
            // ignore
          }
          
          if (transcribeEndCheckRef.current) {
            clearInterval(transcribeEndCheckRef.current);
            transcribeEndCheckRef.current = null;
          }
        }
      }, 100);
      
    } catch (e: any) {
      addLog('启动失败：' + e.message);
      alert('启动语音识别失败：' + e.message);
      setIsTranscribing(false);
      setTranscribeSource(null);
    }
  };

  const startMicTranscribe = () => {
    addLog('开始麦克风输入...');
    
    if (editingIndex === null) {
      setEditingIndex(currentIndex);
    }
    setEditText('');
    addLog('文本框已清空');
    
    if (!isSpeechSupported) {
      addLog('错误：浏览器不支持语音识别');
      alert('您的浏览器不支持语音识别，请使用 Chrome 或 Safari');
      return;
    }
    
    try {
      const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
      const recognition = new SpeechRecognition();
      
      recognition.continuous = true;
      recognition.interimResults = true;
      recognition.lang = 'en-US';
      recognition.maxAlternatives = 1;
      
      let finalText = '';
      
      recognition.onstart = () => {
        addLog('语音识别已启动');
      };
      
      recognition.onresult = (event: any) => {
        let interimText = '';
        
        for (let i = event.resultIndex; i < event.results.length; i++) {
          const result = event.results[i];
          if (result.isFinal) {
            finalText += result[0].transcript;
            addLog('识别到最终结果：' + result[0].transcript);
          } else {
            interimText += result[0].transcript;
          }
        }
        
        const fullText = (finalText + interimText).trim();
        setEditText(fullText);
      };
      
      recognition.onerror = (event: any) => {
        addLog('识别错误：' + event.error);
        setIsTranscribing(false);
        setTranscribeSource(null);
        if (event.error === 'not-allowed') {
          alert('麦克风权限被拒绝，请在浏览器设置中允许麦克风权限');
        }
      };
      
      recognition.onend = () => {
        addLog('语音识别已结束，最终文本：' + finalText);
        setIsTranscribing(false);
        setTranscribeSource(null);
        setEditText(finalText.trim());
      };
      
      recognitionRef.current = recognition;
      recognition.start();
      addLog('调用 recognition.start()');
      
      setIsTranscribing(true);
      setTranscribeSource('mic');
      
    } catch (e: any) {
      addLog('启动失败：' + e.message);
      alert('启动语音识别失败：' + e.message);
      setIsTranscribing(false);
      setTranscribeSource(null);
    }
  };

  const stopTranscribe = () => {
    addLog('手动停止识别');
    if (recognitionRef.current) {
      try {
        recognitionRef.current.stop();
      } catch (e) {
        // ignore
      }
      recognitionRef.current = null;
    }
    
    if (videoElRef.current && transcribeSource === 'video') {
      videoElRef.current.pause();
    }
    
    if (transcribeEndCheckRef.current) {
      clearInterval(transcribeEndCheckRef.current);
      transcribeEndCheckRef.current = null;
    }
    
    setIsTranscribing(false);
    setTranscribeSource(null);
  };

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
    const sorted = [...newSentences].sort((a, b) => a.startTime - b.startTime);
    setSentences(sorted);
    localStorage.setItem(`sentences_${id}`, JSON.stringify(sorted));
  };

  const seekTo = useCallback((time: number) => {
    const video = videoElRef.current;
    if (video) {
      video.currentTime = Math.max(0, Math.min(time, duration));
      setCurrentTime(Math.max(0, Math.min(time, duration)));
    }
  }, [duration]);

  const handleTimeUpdate = useCallback(() => {
    const video = videoElRef.current;
    if (video) {
      setCurrentTime(video.currentTime);
    }
  }, []);

  const playSentence = useCallback((index: number) => {
    const video = videoElRef.current;
    if (!video || !sentences[index]) return;
    
    video.currentTime = sentences[index].startTime;
    video.play();
    setIsPlaying(true);
    setCurrentIndex(index);
    
    const s = sentences[index];
    const checkEnd = setInterval(() => {
      const v = videoElRef.current;
      if (v && v.currentTime >= s.endTime) {
        v.pause();
        setIsPlaying(false);
        clearInterval(checkEnd);
      }
    }, 100);
  }, [sentences]);

  const togglePlay = () => {
    const video = videoElRef.current;
    if (!video) return;
    if (video.paused) {
      video.play();
      setIsPlaying(true);
    } else {
      video.pause();
      setIsPlaying(false);
    }
  };

  const handleTimelineClick = (e: React.MouseEvent) => {
    if (!timelineRef.current || duration === 0) return;
    const rect = timelineRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const percent = x / rect.width;
    const time = percent * duration;
    seekTo(time);
  };

  const startDrag = (e: React.MouseEvent, index: number, type: DragType) => {
    e.preventDefault();
    e.stopPropagation();
    setDragIndex(index);
    setDragType(type);
    setDragStartX(e.clientX);
    setDragStartTime(sentences[index].startTime);
    setDragEndTime(sentences[index].endTime);
    setCurrentIndex(index);
  };

  const handleMouseMove = useCallback((e: MouseEvent) => {
    if (dragIndex === null || !dragType || !timelineRef.current || duration === 0) return;
    
    const rect = timelineRef.current.getBoundingClientRect();
    const dx = e.clientX - dragStartX;
    const timeDelta = (dx / rect.width) * duration;
    
    const updated = [...sentences];
    let newStart = updated[dragIndex].startTime;
    let newEnd = updated[dragIndex].endTime;
    const minDuration = 0.5;

    if (dragType === 'start') {
      newStart = Math.max(0, dragStartTime + timeDelta);
      newStart = Math.min(newStart, newEnd - minDuration);
      if (dragIndex > 0) {
        newStart = Math.max(newStart, updated[dragIndex - 1].endTime);
      }
      updated[dragIndex] = { ...updated[dragIndex], startTime: Math.round(newStart * 10) / 10 };
    } else if (dragType === 'end') {
      newEnd = Math.min(duration, dragEndTime + timeDelta);
      newEnd = Math.max(newEnd, newStart + minDuration);
      if (dragIndex < updated.length - 1) {
        newEnd = Math.min(newEnd, updated[dragIndex + 1].startTime);
      }
      updated[dragIndex] = { ...updated[dragIndex], endTime: Math.round(newEnd * 10) / 10 };
    } else if (dragType === 'move') {
      const newStartMove = dragStartTime + timeDelta;
      const senDuration = dragEndTime - dragStartTime;
      let finalStart = newStartMove;
      
      if (dragIndex > 0) {
        finalStart = Math.max(finalStart, updated[dragIndex - 1].endTime);
      }
      if (dragIndex < updated.length - 1) {
        finalStart = Math.min(finalStart, updated[dragIndex + 1].startTime - senDuration);
      }
      finalStart = Math.max(0, Math.min(finalStart, duration - senDuration));
      
      updated[dragIndex] = {
        ...updated[dragIndex],
        startTime: Math.round(finalStart * 10) / 10,
        endTime: Math.round((finalStart + senDuration) * 10) / 10,
      };
    }
    
    setSentences(updated);
  }, [dragIndex, dragType, dragStartX, dragStartTime, dragEndTime, sentences, duration]);

  const handleMouseUp = useCallback(() => {
    if (dragIndex !== null) {
      saveSentences([...sentences]);
    }
    setDragIndex(null);
    setDragType(null);
  }, [dragIndex, sentences, id]);

  useEffect(() => {
    if (dragIndex !== null) {
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
      return () => {
        document.removeEventListener('mousemove', handleMouseMove);
        document.removeEventListener('mouseup', handleMouseUp);
      };
    }
  }, [dragIndex, handleMouseMove, handleMouseUp]);

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
      endTime: Math.round(Math.min(currentTime + 5, duration) * 10) / 10,
    };
    const updated = [...sentences, newSentence];
    saveSentences(updated);
    const newIndex = updated.findIndex(s => s.id === newSentence.id);
    setCurrentIndex(newIndex);
    setEditingIndex(newIndex);
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

  const setAsStartTime = () => {
    if (editingIndex === null) return;
    const updated = [...sentences];
    let newStart = Math.round(currentTime * 10) / 10;
    if (editingIndex > 0) {
      newStart = Math.max(newStart, updated[editingIndex - 1].endTime);
    }
    newStart = Math.min(newStart, updated[editingIndex].endTime - 0.5);
    updated[editingIndex] = {
      ...updated[editingIndex],
      startTime: newStart,
    };
    saveSentences(updated);
  };

  const setAsEndTime = () => {
    if (editingIndex === null) return;
    const updated = [...sentences];
    let newEnd = Math.round(currentTime * 10) / 10;
    if (editingIndex < updated.length - 1) {
      newEnd = Math.min(newEnd, updated[editingIndex + 1].startTime);
    }
    newEnd = Math.max(newEnd, updated[editingIndex].startTime + 0.5);
    updated[editingIndex] = {
      ...updated[editingIndex],
      endTime: newEnd,
    };
    saveSentences(updated);
  };

  const splitAtCurrent = () => {
    if (sentences.length === 0) {
      addSentence();
      return;
    }
    
    const targetIdx = sentences.findIndex((s, i) => {
      const next = sentences[i + 1];
      return currentTime >= s.startTime && (!next || currentTime < next.startTime);
    });
    
    if (targetIdx >= 0) {
      const s = sentences[targetIdx];
      if (currentTime > s.startTime + 0.3 && currentTime < s.endTime - 0.3) {
        const first: Sentence = {
          ...s,
          id: `sentence_${Date.now()}_1`,
          endTime: Math.round(currentTime * 10) / 10,
        };
        const second: Sentence = {
          ...s,
          id: `sentence_${Date.now()}_2`,
          startTime: Math.round(currentTime * 10) / 10,
          text: '',
        };
        const updated = sentences.filter((_, i) => i !== targetIdx);
        updated.splice(targetIdx, 0, first, second);
        saveSentences(updated);
        setCurrentIndex(targetIdx);
      }
    }
  };

  const nudgeTime = (index: number, type: 'start' | 'end', delta: number) => {
    const updated = [...sentences];
    const s = updated[index];
    
    if (type === 'start') {
      let newStart = s.startTime + delta;
      newStart = Math.max(0, Math.min(newStart, s.endTime - 0.5));
      if (index > 0) {
        newStart = Math.max(newStart, updated[index - 1].endTime);
      }
      updated[index] = { ...s, startTime: Math.round(newStart * 10) / 10 };
    } else {
      let newEnd = s.endTime + delta;
      newEnd = Math.min(duration, Math.max(newEnd, s.startTime + 0.5));
      if (index < updated.length - 1) {
        newEnd = Math.min(newEnd, updated[index + 1].startTime);
      }
      updated[index] = { ...s, endTime: Math.round(newEnd * 10) / 10 };
    }
    
    saveSentences(updated);
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

  const colors = [
    'from-blue-400 to-blue-600',
    'from-emerald-400 to-emerald-600',
    'from-purple-400 to-purple-600',
    'from-orange-400 to-orange-600',
    'from-pink-400 to-pink-600',
    'from-cyan-400 to-cyan-600',
    'from-yellow-400 to-yellow-600',
  ];

  return (
    <div className="min-h-screen bg-gray-50">
      <video
        src={video.fileDataUrl}
        className="hidden"
        onTimeUpdate={handleTimeUpdate}
        onPlay={() => setIsPlaying(true)}
        onPause={() => setIsPlaying(false)}
        onEnded={() => setIsPlaying(false)}
      />

      <header className="bg-white border-b shadow-sm sticky top-0 z-20">
        <div className="max-w-6xl mx-auto px-6 py-4">
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

      <main className="max-w-6xl mx-auto px-6 py-6">
        {showHelp && (
          <div className="mb-6 bg-blue-50 border border-blue-200 rounded-2xl p-5">
            <h3 className="font-bold text-blue-800 mb-3">💡 使用指南</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm text-blue-700">
              <div>
                <p className="font-medium mb-1">时间轴操作：</p>
                <ul className="space-y-1 ml-4 list-disc">
                  <li><strong>点击时间轴</strong>：跳转到该位置播放</li>
                  <li><strong>拖动句子中间</strong>：整体移动句子位置</li>
                  <li><strong>拖动句子左边缘</strong>：调整开始时间</li>
                  <li><strong>拖动句子右边缘</strong>：调整结束时间</li>
                </ul>
              </div>
              <div>
                <p className="font-medium mb-1">文字编辑：</p>
                <ul className="space-y-1 ml-4 list-disc">
                  <li>点句子的「编辑」按钮修改英文文本</li>
                  <li>句子之间自动对齐，不会重叠</li>
                  <li>可以用「在当前位置拆分」添加句子</li>
                </ul>
              </div>
            </div>
          </div>
        )}

        {/* 视频播放器 */}
        <div className="bg-white rounded-2xl shadow-lg p-4 mb-6">
          <div className="flex gap-6">
            <div className="flex-1">
              <div className="relative bg-black rounded-xl overflow-hidden aspect-video">
                <video
                  ref={videoElRef}
                  src={video.fileDataUrl}
                  className="w-full h-full object-contain"
                  controls
                  onTimeUpdate={handleTimeUpdate}
                />
              </div>
            </div>
            <div className="w-64 space-y-3">
              <div className="bg-gray-50 rounded-xl p-4">
                <div className="text-2xl font-mono font-bold text-gray-800 text-center mb-2">
                  {formatTime(currentTime)}
                </div>
                <div className="text-xs text-gray-500 text-center">
                  总时长：{formatTime(duration)}
                </div>
              </div>
              <button
                onClick={togglePlay}
                className="w-full py-3 bg-blue-500 text-white rounded-xl font-bold hover:bg-blue-600 flex items-center justify-center gap-2"
              >
                {isPlaying ? <Pause className="w-5 h-5" /> : <Play className="w-5 h-5" />}
                {isPlaying ? '暂停' : '播放'}
              </button>
              <div className="grid grid-cols-2 gap-2">
                <button
                  onClick={() => seekTo(Math.max(0, currentTime - 3))}
                  className="py-2 bg-gray-100 hover:bg-gray-200 rounded-lg text-sm font-medium"
                >
                  ⏪ -3秒
                </button>
                <button
                  onClick={() => seekTo(Math.min(duration, currentTime + 3))}
                  className="py-2 bg-gray-100 hover:bg-gray-200 rounded-lg text-sm font-medium"
                >
                  +3秒 ⏩
                </button>
              </div>
              <button
                onClick={splitAtCurrent}
                className="w-full py-2 bg-orange-100 text-orange-600 rounded-xl font-medium hover:bg-orange-200 flex items-center justify-center gap-2"
              >
                <Scissors className="w-4 h-4" />
                在当前位置拆分
              </button>
            </div>
          </div>
        </div>

        {/* 可视化时间轴 */}
        <div className="bg-white rounded-2xl shadow-lg p-4 mb-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-bold text-gray-700 flex items-center gap-2">
              <ZoomIn className="w-5 h-5 text-blue-500" />
              可视化时间轴
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
                添加句子
              </button>
            </div>
          </div>

          {/* 时间刻度 */}
          <div className="relative mb-2">
            <div className="flex justify-between text-xs text-gray-400">
              {Array.from({ length: 11 }).map((_, i) => (
                <span key={i}>{formatTime((duration / 10) * i)}</span>
              ))}
            </div>
          </div>

          {/* 时间轴主体 */}
          <div
            ref={timelineRef}
            className="relative h-20 bg-gray-100 rounded-xl overflow-hidden cursor-pointer select-none"
            onClick={handleTimelineClick}
            style={{ userSelect: 'none' }}
          >
            {/* 刻度线 */}
            <div className="absolute inset-0 flex justify-between pointer-events-none">
              {Array.from({ length: 11 }).map((_, i) => (
                <div key={i} className="w-px h-full bg-gray-200" />
              ))}
            </div>

            {/* 句子块 */}
            {sentences.map((s, i) => {
              const left = (s.startTime / duration) * 100;
              const width = Math.max(3, ((s.endTime - s.startTime) / duration) * 100);
              const colorIdx = i % colors.length;
              const isActive = currentIndex === i;
              const isEditing = editingIndex === i;
              
              return (
                <div
                  key={s.id}
                  className={`absolute top-2 bottom-2 rounded-lg bg-gradient-to-b ${colors[colorIdx]} ${
                    isActive ? 'ring-2 ring-offset-1 ring-yellow-400' : ''
                  } ${isEditing ? 'ring-2 ring-offset-1 ring-emerald-400' : ''}`}
                  style={{
                    left: `${left}%`,
                    width: `${width}%`,
                    cursor: dragIndex === i && dragType === 'move' ? 'grabbing' : 'grab',
                    opacity: dragIndex !== null && dragIndex !== i ? 0.6 : 1,
                    zIndex: isActive || isEditing ? 5 : 1,
                  }}
                  onMouseDown={(e) => startDrag(e, i, 'move')}
                  onClick={(e) => {
                    e.stopPropagation();
                    setCurrentIndex(i);
                  }}
                >
                  {/* 左拖动手柄 */}
                  <div
                    className="absolute left-0 top-0 bottom-0 w-3 cursor-ew-resize bg-white/30 hover:bg-white/50 rounded-l-lg flex items-center justify-center"
                    onMouseDown={(e) => startDrag(e, i, 'start')}
                  >
                    <GripVertical className="w-3 h-3 text-white/80" />
                  </div>

                  {/* 中间内容 */}
                  <div className="absolute inset-x-3 top-0 bottom-0 flex items-center justify-center overflow-hidden pointer-events-none">
                    <span className="text-white font-bold text-sm truncate px-1">
                      {i + 1}. {s.text || '（未设置文本）'}
                    </span>
                  </div>

                  {/* 右拖动手柄 */}
                  <div
                    className="absolute right-0 top-0 bottom-0 w-3 cursor-ew-resize bg-white/30 hover:bg-white/50 rounded-r-lg flex items-center justify-center"
                    onMouseDown={(e) => startDrag(e, i, 'end')}
                  >
                    <GripVertical className="w-3 h-3 text-white/80" />
                  </div>
                </div>
              );
            })}

            {/* 播放头 */}
            <div
              className="absolute top-0 bottom-0 w-0.5 bg-red-500 pointer-events-none z-10"
              style={{ left: `${(currentTime / duration) * 100}%` }}
            >
              <div className="absolute -top-1 left-1/2 -translate-x-1/2 w-3 h-3 bg-red-500 rounded-full" />
            </div>
          </div>

          <div className="mt-3 flex items-center justify-center gap-6 text-xs text-gray-500">
            <span className="flex items-center gap-1">
              <GripVertical className="w-3 h-3" /> 拖动边缘调整时间
            </span>
            <span className="flex items-center gap-1">
              <MoveLeft className="w-3 h-3" /> 拖动中间移动位置
            </span>
            <span className="flex items-center gap-1">
              <MoveRight className="w-3 h-3" /> 点击空白跳转播放
            </span>
          </div>
        </div>

        {/* 选中句子详情 */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* 当前选中句子 */}
          <div className="bg-white rounded-2xl shadow-lg p-4">
            <h3 className="font-bold text-gray-700 mb-4">
              📝 当前选中：句子 {currentIndex + 1}
              {sentences[currentIndex] && (
                <span className="text-sm font-normal text-gray-400 ml-2">
                  {formatTime(sentences[currentIndex].startTime)} - {formatTime(sentences[currentIndex].endTime)}
                  （时长 {(sentences[currentIndex].endTime - sentences[currentIndex].startTime).toFixed(1)}秒）
                </span>
              )}
            </h3>

            {sentences[currentIndex] && (
              <div className="space-y-4">
                {/* 播放控制 */}
                <button
                  onClick={() => playSentence(currentIndex)}
                  className="w-full py-3 bg-emerald-500 text-white rounded-xl font-bold hover:bg-emerald-600 flex items-center justify-center gap-2"
                >
                  <PlayCircle className="w-5 h-5" />
                  播放这个句子
                </button>

                {/* 精确调整 */}
                <div className="grid grid-cols-2 gap-4">
                  <div className="bg-blue-50 rounded-xl p-3">
                    <div className="text-sm font-medium text-blue-700 mb-2 text-center">开始时间</div>
                    <div className="flex items-center justify-center gap-1 mb-2">
                      <input
                        type="number"
                        step="0.1"
                        min="0"
                        value={sentences[currentIndex].startTime.toFixed(1)}
                        onChange={(e) => {
                          const val = parseFloat(e.target.value);
                          if (!isNaN(val) && val >= 0) {
                            const updated = [...sentences];
                            let newStart = val;
                            if (currentIndex > 0) {
                              newStart = Math.max(newStart, updated[currentIndex - 1].endTime);
                            }
                            newStart = Math.min(newStart, updated[currentIndex].endTime - 0.5);
                            updated[currentIndex] = {
                              ...updated[currentIndex],
                              startTime: Math.round(newStart * 10) / 10,
                            };
                            saveSentences(updated);
                          }
                        }}
                        className="w-20 px-2 py-1 text-center text-lg font-mono font-bold text-blue-800 border-2 border-blue-200 rounded-lg focus:border-blue-500 focus:outline-none"
                      />
                      <span className="text-blue-600 font-medium">秒</span>
                    </div>
                    <div className="flex gap-1">
                      <button
                        onClick={() => nudgeTime(currentIndex, 'start', -1)}
                        className="flex-1 py-1 bg-white rounded text-sm hover:bg-blue-100"
                      >
                        -1s
                      </button>
                      <button
                        onClick={() => nudgeTime(currentIndex, 'start', -0.1)}
                        className="flex-1 py-1 bg-white rounded text-sm hover:bg-blue-100"
                      >
                        -0.1s
                      </button>
                      <button
                        onClick={setAsStartTime}
                        className="flex-1 py-1 bg-blue-500 text-white rounded text-sm hover:bg-blue-600"
                      >
                        设当前
                      </button>
                      <button
                        onClick={() => nudgeTime(currentIndex, 'start', 0.1)}
                        className="flex-1 py-1 bg-white rounded text-sm hover:bg-blue-100"
                      >
                        +0.1s
                      </button>
                      <button
                        onClick={() => nudgeTime(currentIndex, 'start', 1)}
                        className="flex-1 py-1 bg-white rounded text-sm hover:bg-blue-100"
                      >
                        +1s
                      </button>
                    </div>
                  </div>
                  <div className="bg-orange-50 rounded-xl p-3">
                    <div className="text-sm font-medium text-orange-700 mb-2 text-center">结束时间</div>
                    <div className="flex items-center justify-center gap-1 mb-2">
                      <input
                        type="number"
                        step="0.1"
                        min="0"
                        value={sentences[currentIndex].endTime.toFixed(1)}
                        onChange={(e) => {
                          const val = parseFloat(e.target.value);
                          if (!isNaN(val) && val > 0) {
                            const updated = [...sentences];
                            let newEnd = val;
                            if (currentIndex < updated.length - 1) {
                              newEnd = Math.min(newEnd, updated[currentIndex + 1].startTime);
                            }
                            newEnd = Math.max(newEnd, updated[currentIndex].startTime + 0.5);
                            updated[currentIndex] = {
                              ...updated[currentIndex],
                              endTime: Math.round(newEnd * 10) / 10,
                            };
                            saveSentences(updated);
                          }
                        }}
                        className="w-20 px-2 py-1 text-center text-lg font-mono font-bold text-orange-800 border-2 border-orange-200 rounded-lg focus:border-orange-500 focus:outline-none"
                      />
                      <span className="text-orange-600 font-medium">秒</span>
                    </div>
                    <div className="flex gap-1">
                      <button
                        onClick={() => nudgeTime(currentIndex, 'end', -1)}
                        className="flex-1 py-1 bg-white rounded text-sm hover:bg-orange-100"
                      >
                        -1s
                      </button>
                      <button
                        onClick={() => nudgeTime(currentIndex, 'end', -0.1)}
                        className="flex-1 py-1 bg-white rounded text-sm hover:bg-orange-100"
                      >
                        -0.1s
                      </button>
                      <button
                        onClick={setAsEndTime}
                        className="flex-1 py-1 bg-orange-500 text-white rounded text-sm hover:bg-orange-600"
                      >
                        设当前
                      </button>
                      <button
                        onClick={() => nudgeTime(currentIndex, 'end', 0.1)}
                        className="flex-1 py-1 bg-white rounded text-sm hover:bg-orange-100"
                      >
                        +0.1s
                      </button>
                      <button
                        onClick={() => nudgeTime(currentIndex, 'end', 1)}
                        className="flex-1 py-1 bg-white rounded text-sm hover:bg-orange-100"
                      >
                        +1s
                      </button>
                    </div>
                  </div>
                </div>

                {/* 文本编辑 */}
                {editingIndex === currentIndex ? (
                  <div className="bg-emerald-50 rounded-xl p-4 border border-emerald-200">
                    <div className="flex items-center justify-between mb-3">
                      <span className="text-sm font-bold text-emerald-700">📝 句子文本</span>
                    </div>

                    {isSpeechSupported && (
                      <div className="grid grid-cols-2 gap-2 mb-3">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            startVideoTranscribe();
                          }}
                          disabled={isTranscribing}
                          className={`flex items-center justify-center gap-1.5 text-sm py-2 rounded-lg ${
                            isTranscribing && transcribeSource === 'video'
                              ? 'bg-red-100 text-red-600 animate-pulse'
                              : 'bg-emerald-100 text-emerald-700 hover:bg-emerald-200'
                          } disabled:opacity-60`}
                        >
                          <PlayCircle className="w-4 h-4" />
                          {isTranscribing && transcribeSource === 'video' ? '识别中...' : '播放视频转文字'}
                        </button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            if (isTranscribing) {
                              stopTranscribe();
                            } else {
                              startMicTranscribe();
                            }
                          }}
                          className={`flex items-center justify-center gap-1.5 text-sm py-2 rounded-lg ${
                            isTranscribing && transcribeSource === 'mic'
                              ? 'bg-red-100 text-red-600 animate-pulse'
                              : 'bg-purple-100 text-purple-700 hover:bg-purple-200'
                          }`}
                        >
                          <Mic className="w-4 h-4" />
                          {isTranscribing && transcribeSource === 'mic' ? '停止听写' : '麦克风输入'}
                        </button>
                      </div>
                    )}

                    <textarea
                      className="w-full p-3 border-2 border-emerald-300 rounded-lg focus:border-emerald-500 focus:outline-none text-base"
                      rows={3}
                      placeholder="在这里输入句子的英文文本，或用上方的功能自动识别..."
                      value={editText}
                      onChange={(e) => setEditText(e.target.value)}
                    />

                    <div className="flex gap-2 mt-3">
                      {isTranscribing && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            stopTranscribe();
                          }}
                          className="px-4 py-2 bg-red-500 text-white rounded-lg font-bold hover:bg-red-600"
                        >
                          停止
                        </button>
                      )}
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          if (isTranscribing) stopTranscribe();
                          saveEditText();
                        }}
                        className="flex-1 py-2 bg-emerald-500 text-white rounded-lg font-bold hover:bg-emerald-600 flex items-center justify-center gap-1"
                      >
                        <Save className="w-4 h-4" />
                        保存文本
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          if (isTranscribing) stopTranscribe();
                          setEditingIndex(null);
                        }}
                        className="px-4 py-2 bg-gray-200 rounded-lg hover:bg-gray-300"
                      >
                        取消
                      </button>
                    </div>

                    <p className="text-xs text-emerald-600 mt-2">
                      💡 <strong>播放视频转文字：</strong>播放这句视频，同时用麦克风识别视频里的英文，识别完自动填进去，再手动调整
                      <br />
                      💡 <strong>麦克风输入：</strong>自己对着麦克风读句子，系统转成文字
                    </p>

                    {debugLog.length > 0 && (
                      <details className="mt-3">
                        <summary className="text-xs text-gray-500 cursor-pointer hover:text-gray-700">
                          🐛 调试日志（点击展开）
                        </summary>
                        <div className="mt-2 p-2 bg-gray-900 text-green-400 rounded-lg text-xs font-mono max-h-40 overflow-y-auto">
                          {debugLog.map((log, i) => (
                            <div key={i} className="leading-relaxed">{log}</div>
                          ))}
                        </div>
                      </details>
                    )}
                  </div>
                ) : (
                  <div className="bg-gray-50 rounded-xl p-4">
                    <div className="flex items-start justify-between gap-3">
                      <p className={`text-base flex-1 ${
                        sentences[currentIndex].text ? 'text-gray-800' : 'text-gray-400 italic'
                      }`}>
                        {sentences[currentIndex].text || '（点击编辑按钮添加句子文本）'}
                      </p>
                      <button
                        onClick={() => startEditing(currentIndex)}
                        className="px-3 py-1 bg-emerald-100 text-emerald-600 rounded-lg hover:bg-emerald-200 flex items-center gap-1 text-sm shrink-0"
                      >
                        <Edit3 className="w-4 h-4" />
                        编辑
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* 句子列表 */}
          <div className="bg-white rounded-2xl shadow-lg p-4">
            <h3 className="font-bold text-gray-700 mb-4">
              📋 句子列表
              <span className="text-sm font-normal text-gray-400 ml-2">({sentences.length}句)</span>
            </h3>

            <div className="space-y-2 max-h-[400px] overflow-y-auto pr-1">
              {sentences.map((s, i) => (
                <div
                  key={s.id}
                  className={`rounded-xl border-2 cursor-pointer transition-all ${
                    currentIndex === i
                      ? 'border-blue-400 bg-blue-50'
                      : 'border-gray-200 bg-white hover:border-gray-300'
                  }`}
                  onClick={() => setCurrentIndex(i)}
                >
                  <div className="p-3">
                    <div className="flex items-center justify-between mb-1">
                      <div className="flex items-center gap-2">
                        <span className={`w-7 h-7 rounded-full flex items-center justify-center text-sm font-bold bg-gradient-to-b ${colors[i % colors.length]} text-white`}>
                          {i + 1}
                        </span>
                        <span className="text-xs text-gray-500 font-mono">
                          {formatTime(s.startTime)} - {formatTime(s.endTime)}
                        </span>
                      </div>
                      <div className="flex gap-1">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            playSentence(i);
                          }}
                          className="p-1.5 hover:bg-blue-100 rounded text-blue-600"
                        >
                          <Play className="w-4 h-4" />
                        </button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            startEditing(i);
                          }}
                          className="p-1.5 hover:bg-emerald-100 rounded text-emerald-600"
                        >
                          <Edit3 className="w-4 h-4" />
                        </button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            deleteSentence(i);
                          }}
                          className="p-1.5 hover:bg-red-100 rounded text-red-500"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                    <p className={`text-sm ml-9 truncate ${
                      s.text ? 'text-gray-700' : 'text-gray-400 italic'
                    }`}>
                      {s.text || '（未设置文本）'}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
