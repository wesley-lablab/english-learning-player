export interface WaveformData {
  peaks: number[];
  duration: number;
}

export async function extractAudioWaveform(
  audioBlob: Blob,
  samples: number = 100
): Promise<WaveformData> {
  const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
  
  try {
    const arrayBuffer = await audioBlob.arrayBuffer();
    const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);
    
    const channelData = audioBuffer.getChannelData(0);
    const blockSize = Math.floor(channelData.length / samples);
    const peaks: number[] = [];
    
    for (let i = 0; i < samples; i++) {
      const start = i * blockSize;
      const end = start + blockSize;
      let max = 0;
      
      for (let j = start; j < end && j < channelData.length; j++) {
        const absVal = Math.abs(channelData[j]);
        if (absVal > max) {
          max = absVal;
        }
      }
      
      peaks.push(max);
    }
    
    const maxPeak = Math.max(...peaks, 0.01);
    const normalizedPeaks = peaks.map(p => p / maxPeak);
    
    return {
      peaks: normalizedPeaks,
      duration: audioBuffer.duration,
    };
  } finally {
    audioContext.close();
  }
}

export async function extractVideoAudioWaveform(
  videoElement: HTMLVideoElement,
  startTime: number,
  endTime: number,
  samples: number = 100
): Promise<WaveformData> {
  const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
  
  try {
    const source = audioContext.createMediaElementSource(videoElement);
    const analyser = audioContext.createAnalyser();
    analyser.fftSize = 256;
    
    source.connect(analyser);
    analyser.connect(audioContext.destination);
    
    const dataArray = new Uint8Array(analyser.frequencyBinCount);
    const peaks: number[] = new Array(samples).fill(0);
    
    const duration = endTime - startTime;
    const sampleInterval = duration / samples;
    
    videoElement.currentTime = startTime;
    await new Promise<void>((resolve) => {
      const onSeeked = () => {
        videoElement.removeEventListener('seeked', onSeeked);
        resolve();
      };
      videoElement.addEventListener('seeked', onSeeked);
    });
    
    let currentSample = 0;
    let lastSampleTime = startTime;
    
    return new Promise<WaveformData>((resolve) => {
      const collectData = () => {
        if (videoElement.currentTime >= endTime || currentSample >= samples) {
          videoElement.pause();
          
          const maxPeak = Math.max(...peaks, 1);
          const normalizedPeaks = peaks.map(p => p / maxPeak);
          
          resolve({
            peaks: normalizedPeaks,
            duration: duration,
          });
          return;
        }
        
        const elapsed = videoElement.currentTime - startTime;
        const targetSample = Math.floor(elapsed / sampleInterval);
        
        while (currentSample <= targetSample && currentSample < samples) {
          analyser.getByteTimeDomainData(dataArray);
          
          let max = 0;
          for (let i = 0; i < dataArray.length; i++) {
            const v = Math.abs(dataArray[i] - 128) / 128;
            if (v > max) max = v;
          }
          
          peaks[currentSample] = max;
          currentSample++;
        }
        
        requestAnimationFrame(collectData);
      };
      
      videoElement.play();
      collectData();
    });
    
  } finally {
    audioContext.close();
  }
}

export function calculateWaveformSimilarity(
  wave1: number[],
  wave2: number[]
): number {
  const len = Math.min(wave1.length, wave2.length);
  if (len === 0) return 0;
  
  const resampled1 = resample(wave1, len);
  const resampled2 = resample(wave2, len);
  
  let dotProduct = 0;
  let norm1 = 0;
  let norm2 = 0;
  
  for (let i = 0; i < len; i++) {
    dotProduct += resampled1[i] * resampled2[i];
    norm1 += resampled1[i] * resampled1[i];
    norm2 += resampled2[i] * resampled2[i];
  }
  
  if (norm1 === 0 || norm2 === 0) return 0;
  
  const similarity = dotProduct / (Math.sqrt(norm1) * Math.sqrt(norm2));
  return Math.max(0, Math.min(100, Math.round(similarity * 100)));
}

function resample(data: number[], targetLength: number): number[] {
  if (data.length === targetLength) return [...data];
  
  const result: number[] = [];
  const step = data.length / targetLength;
  
  for (let i = 0; i < targetLength; i++) {
    const idx = i * step;
    const lower = Math.floor(idx);
    const upper = Math.min(lower + 1, data.length - 1);
    const weight = idx - lower;
    result.push(data[lower] * (1 - weight) + data[upper] * weight);
  }
  
  return result;
}

export function drawWaveform(
  canvas: HTMLCanvasElement,
  peaks: number[],
  color: string = '#10b981',
  bgColor: string = 'rgba(16, 185, 129, 0.1)'
) {
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  
  const width = canvas.width;
  const height = canvas.height;
  const barWidth = width / peaks.length;
  const centerY = height / 2;
  
  ctx.clearRect(0, 0, width, height);
  
  ctx.fillStyle = bgColor;
  ctx.fillRect(0, 0, width, height);
  
  ctx.fillStyle = color;
  
  for (let i = 0; i < peaks.length; i++) {
    const x = i * barWidth;
    const barHeight = peaks[i] * (height * 0.9);
    const y = centerY - barHeight / 2;
    
    ctx.fillRect(
      x + 1,
      y,
      Math.max(1, barWidth - 2),
      barHeight
    );
  }
}

export function compareAudioRhythm(
  originalPeaks: number[],
  recordingPeaks: number[]
): {
  rhythmScore: number;
  volumeScore: number;
  overallScore: number;
} {
  const len = Math.min(originalPeaks.length, recordingPeaks.length);
  
  const rhythmSim = calculateWaveformSimilarity(
    originalPeaks.map(p => p > 0.2 ? 1 : 0),
    recordingPeaks.map(p => p > 0.2 ? 1 : 0)
  );
  
  const origAvg = originalPeaks.reduce((a, b) => a + b, 0) / Math.max(1, originalPeaks.length);
  const recAvg = recordingPeaks.reduce((a, b) => a + b, 0) / Math.max(1, recordingPeaks.length);
  const volumeRatio = Math.min(origAvg, recAvg) / Math.max(origAvg, recAvg, 0.001);
  const volumeScore = Math.round(volumeRatio * 100);
  
  const overallScore = Math.round(rhythmSim * 0.6 + volumeScore * 0.4);
  
  return {
    rhythmScore: rhythmSim,
    volumeScore,
    overallScore,
  };
}
