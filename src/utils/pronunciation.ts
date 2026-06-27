export interface Sentence {
  id: string;
  text: string;
  startTime: number;
  endTime: number;
  translation?: string;
}

export interface PronunciationResult {
  sentenceId: string;
  expectedText: string;
  recognizedText: string;
  accuracy: number;
  feedback: string;
  score: 'excellent' | 'good' | 'fair' | 'poor';
}

export interface PracticeSession {
  videoId: number;
  sentences: Sentence[];
  currentIndex: number;
  results: PronunciationResult[];
  startedAt: string;
}

// 计算两个文本的相似度
export function calculateSimilarity(text1: string, text2: string): number {
  const s1 = text1.toLowerCase().trim();
  const s2 = text2.toLowerCase().trim();
  
  if (s1 === s2) return 100;
  if (!s1 || !s2) return 0;
  
  // 使用编辑距离算法
  const len1 = s1.length;
  const len2 = s2.length;
  const matrix: number[][] = [];
  
  for (let i = 0; i <= len1; i++) {
    matrix[i] = [i];
  }
  for (let j = 0; j <= len2; j++) {
    matrix[0][j] = j;
  }
  
  for (let i = 1; i <= len1; i++) {
    for (let j = 1; j <= len2; j++) {
      const cost = s1[i - 1] === s2[j - 1] ? 0 : 1;
      matrix[i][j] = Math.min(
        matrix[i - 1][j] + 1,
        matrix[i][j - 1] + 1,
        matrix[i - 1][j - 1] + cost
      );
    }
  }
  
  const distance = matrix[len1][len2];
  const maxLen = Math.max(len1, len2);
  return Math.round((1 - distance / maxLen) * 100);
}

// 根据相似度获取评分等级
export function getScore(accuracy: number): 'excellent' | 'good' | 'fair' | 'poor' {
  if (accuracy >= 90) return 'excellent';
  if (accuracy >= 75) return 'good';
  if (accuracy >= 60) return 'fair';
  return 'poor';
}

// 生成反馈建议
export function generateFeedback(accuracy: number, expected: string, recognized: string): string {
  if (accuracy >= 95) return '太棒了！发音非常准确！🎉';
  if (accuracy >= 85) return '很好！再接再厉！💪';
  if (accuracy >= 70) {
    const diff = findDifference(expected, recognized);
    return `注意 ${diff} 的发音哦！📝`;
  }
  if (accuracy >= 50) {
    return '多听几遍原句，试着模仿语调 🐢';
  }
  return '别灰心！可以先看字幕多听几遍 🔄';
}

// 找出不同之处
function findDifference(expected: string, recognized: string): string {
  const words1 = expected.toLowerCase().split(/\s+/);
  const words2 = recognized.toLowerCase().split(/\s+/);
  
  for (let i = 0; i < words1.length; i++) {
    if (words1[i] !== words2[i]) {
      return `"${words1[i]}"`;
    }
  }
  return '';
}

// 自动分割句子（基于时间）
export function autoSplitSentences(
  duration: number,
  totalSentences: number = 5
): Sentence[] {
  const sentences: Sentence[] = [];
  const avgDuration = duration / totalSentences;
  
  for (let i = 0; i < totalSentences; i++) {
    sentences.push({
      id: `sentence_${i}`,
      text: '',
      startTime: Math.round(i * avgDuration),
      endTime: Math.round((i + 1) * avgDuration),
    });
  }
  
  return sentences;
}

// 格式化时间
export function formatTime(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}

// 检查浏览器是否支持语音识别
export function isSpeechRecognitionSupported(): boolean {
  return !!(window.SpeechRecognition || window.webkitSpeechRecognition);
}
