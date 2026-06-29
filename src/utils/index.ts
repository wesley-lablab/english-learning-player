export function formatDuration(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}

export function formatDate(dateStr: string): string {
  const date = new Date(dateStr);
  return date.toLocaleDateString('zh-CN', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
}

export function getCategoryColor(categoryId: string): string {
  const colors: Record<string, string> = {
    all: '#FF9F43',
    course: '#54A0FF',
    extension: '#FF6B6B',
  };
  return colors[categoryId] || '#FF9F43';
}

export function getCategoryEmoji(categoryId: string): string {
  const emojis: Record<string, string> = {
    all: '🌟',
    course: '📘',
    extension: '🚀',
  };
  return emojis[categoryId] || '🎬';
}
