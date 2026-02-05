
export const extractFrames = async (videoFile: File, count: number = 5): Promise<{timestamp: number, dataUrl: string}[]> => {
  return new Promise((resolve, reject) => {
    const video = document.createElement('video');
    video.src = URL.createObjectURL(videoFile);
    video.preload = 'auto';

    video.onloadedmetadata = async () => {
      const frames: {timestamp: number, dataUrl: string}[] = [];
      const duration = video.duration;
      const interval = duration / (count + 1);

      const canvas = document.createElement('canvas');
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      const ctx = canvas.getContext('2d');

      for (let i = 1; i <= count; i++) {
        const time = i * interval;
        video.currentTime = time;
        await new Promise(r => video.onseeked = r);
        
        if (ctx) {
          ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
          frames.push({
            timestamp: time,
            dataUrl: canvas.toDataURL('image/jpeg', 0.8)
          });
        }
      }

      URL.revokeObjectURL(video.src);
      resolve(frames);
    };

    video.onerror = reject;
  });
};

export const drawAnnotation = (canvas: HTMLCanvasElement, box: [number, number, number, number]) => {
  const ctx = canvas.getContext('2d');
  if (!ctx) return;

  const [ymin, xmin, ymax, xmax] = box;
  const width = canvas.width;
  const height = canvas.height;

  const x = (xmin / 1000) * width;
  const y = (ymin / 1000) * height;
  const w = ((xmax - xmin) / 1000) * width;
  const h = ((ymax - ymin) / 1000) * height;

  ctx.strokeStyle = '#ef4444'; // Red-500
  ctx.lineWidth = 4;
  ctx.lineJoin = 'round';
  ctx.strokeRect(x, y, w, h);

  // Add a small label
  ctx.fillStyle = '#ef4444';
  ctx.font = 'bold 16px sans-serif';
  ctx.fillText('CLICK HERE', x, y > 20 ? y - 5 : y + h + 20);
};
