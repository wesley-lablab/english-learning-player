import { PLAYBACK_RATES, type PlaybackRate } from '../types';

interface SpeedControlProps {
  currentRate: PlaybackRate;
  onChange: (rate: PlaybackRate) => void;
}

const rateLabels: Record<PlaybackRate, string> = {
  0.5: '0.5x',
  0.75: '0.75x',
  1: '1x',
  1.25: '1.25x',
  1.5: '1.5x',
  2: '2x',
};

const rateColors: Record<PlaybackRate, string> = {
  0.5: 'from-purple-400 to-purple-600',
  0.75: 'from-blue-400 to-blue-600',
  1: 'from-green-400 to-green-600',
  1.25: 'from-yellow-400 to-yellow-600',
  1.5: 'from-orange-400 to-orange-600',
  2: 'from-red-400 to-red-600',
};

export default function SpeedControl({ currentRate, onChange }: SpeedControlProps) {
  return (
    <div className="w-full">
      <div className="flex items-center justify-center gap-2 mb-3">
        <span className="text-2xl">🐢</span>
        <p className="text-lg font-bold text-gray-700">播放速度</p>
        <span className="text-2xl">🐇</span>
      </div>
      <div className="flex flex-wrap justify-center gap-3">
        {PLAYBACK_RATES.map((rate) => {
          const isActive = rate === currentRate;
          return (
            <button
              key={rate}
              onClick={() => onChange(rate)}
              className={`
                relative px-6 py-4 rounded-2xl text-xl font-bold
                transition-all duration-200 transform
                min-w-[80px] min-h-[60px]
                ${isActive
                  ? `bg-gradient-to-br ${rateColors[rate]} text-white scale-110 shadow-xl`
                  : 'bg-white text-gray-600 border-2 border-gray-200 hover:border-orange-300 hover:bg-orange-50 hover:scale-105 shadow-md'
                }
              `}
              style={{
                borderRadius: '16px',
              }}
            >
              {rateLabels[rate]}
              {isActive && (
                <span className="absolute -top-2 -right-2 w-6 h-6 bg-white rounded-full flex items-center justify-center shadow-md">
                  <span className="text-sm">✓</span>
                </span>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
