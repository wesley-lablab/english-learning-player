import { PlayCircle } from 'lucide-react';
import type { Video } from '../types';
import { formatDuration, getCategoryEmoji, getCategoryColor } from '../utils';

interface VideoCardProps {
  video: Video;
  onClick: () => void;
}

export default function VideoCard({ video, onClick }: VideoCardProps) {
  const categoryEmoji = getCategoryEmoji(video.category);
  const categoryColor = getCategoryColor(video.category);

  return (
    <div
      onClick={onClick}
      className="group relative bg-white rounded-3xl overflow-hidden shadow-lg cursor-pointer transform transition-all duration-300 hover:scale-105 hover:shadow-2xl"
    >
      <div className="relative aspect-video bg-gradient-to-br from-orange-100 to-yellow-100 overflow-hidden">
        <div 
          className="absolute inset-0 flex items-center justify-center"
          style={{ backgroundColor: `${categoryColor}20` }}
        >
          <span className="text-7xl transform group-hover:scale-125 transition-transform duration-300">
            {categoryEmoji}
          </span>
        </div>
        
        <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-all duration-300 flex items-center justify-center">
          <div className="w-20 h-20 bg-white/0 group-hover:bg-white/90 rounded-full flex items-center justify-center transform scale-75 group-hover:scale-100 transition-all duration-300 opacity-0 group-hover:opacity-100">
            <PlayCircle className="w-12 h-12 text-orange-500" fill="currentColor" />
          </div>
        </div>

        <div className="absolute bottom-3 right-3 bg-black/70 text-white text-sm font-bold px-3 py-1 rounded-full">
          {formatDuration(video.duration)}
        </div>

        <div 
          className="absolute top-3 left-3 px-3 py-1 rounded-full text-white text-sm font-bold shadow-lg"
          style={{ backgroundColor: categoryColor }}
        >
          {categoryEmoji}
        </div>
      </div>

      <div className="p-5">
        <h3 className="text-xl font-bold text-gray-800 mb-2 line-clamp-2 leading-tight">
          {video.title}
        </h3>
        <p className="text-gray-500 text-sm line-clamp-2">
          {video.description || '点击开始学习吧！'}
        </p>
      </div>
    </div>
  );
}
