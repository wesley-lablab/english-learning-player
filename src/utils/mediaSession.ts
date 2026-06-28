export function setupMediaSession(
  title: string,
  artist: string,
  onPlay: () => void,
  onPause: () => void,
  onNext?: () => void,
  onPrevious?: () => void
): void {
  if (!('mediaSession' in navigator)) return;

  try {
    navigator.mediaSession.metadata = new MediaMetadata({
      title,
      artist,
      album: '英语学习',
    });

    navigator.mediaSession.setActionHandler('play', () => {
      onPlay();
    });

    navigator.mediaSession.setActionHandler('pause', () => {
      onPause();
    });

    if (onNext) {
      navigator.mediaSession.setActionHandler('nexttrack', () => {
        onNext();
      });
    }

    if (onPrevious) {
      navigator.mediaSession.setActionHandler('previoustrack', () => {
        onPrevious();
      });
    }
  } catch (e) {
    console.warn('Media Session API 不支持:', e);
  }
}

export function updateMediaSessionPlaybackState(isPlaying: boolean): void {
  if (!('mediaSession' in navigator)) return;
  try {
    navigator.mediaSession.playbackState = isPlaying ? 'playing' : 'paused';
  } catch (e) {}
}

export function updateMediaSessionMetadata(title: string, artist: string): void {
  if (!('mediaSession' in navigator)) return;
  try {
    navigator.mediaSession.metadata = new MediaMetadata({
      title,
      artist,
      album: '英语学习',
    });
  } catch (e) {}
}
