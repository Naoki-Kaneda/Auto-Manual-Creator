import { ExtractOptions, ExtractedFrame } from '../types';

/** ダウンサンプリング解像度（シーン変化検出用） */
const SAMPLE_WIDTH = 160;
const SAMPLE_HEIGHT = 90;

/** 最小フレーム間隔（秒）- これより近い変化点は統合 */
const MIN_FRAME_INTERVAL = 1.0;

/** 粗いスキャンの間隔（秒） */
const SCAN_INTERVAL = 0.5;

/** デフォルトの抽出オプション */
const DEFAULT_OPTIONS: ExtractOptions = {
  mode: 'auto',
  maxFrames: 10,
  sensitivity: 0.03,
};

/** 最低フレーム数 - これ未満の場合は等間隔で補完 */
const MIN_FRAMES = 3;

// ============================================================
// シーン変化検出
// ============================================================

/**
 * 2つのフレーム画像のピクセル差分を0-1で計算する
 * ダウンサンプリングした低解像度画像を比較して高速化
 */
function calculateFrameDifference(
  pixels1: Uint8ClampedArray,
  pixels2: Uint8ClampedArray
): number {
  let totalDiff = 0;
  const pixelCount = pixels1.length / 4; // RGBA

  for (let i = 0; i < pixels1.length; i += 4) {
    // RGB各チャンネルの差分（Alphaは無視）
    const dr = Math.abs(pixels1[i] - pixels2[i]);
    const dg = Math.abs(pixels1[i + 1] - pixels2[i + 1]);
    const db = Math.abs(pixels1[i + 2] - pixels2[i + 2]);
    totalDiff += (dr + dg + db) / (3 * 255);
  }

  return totalDiff / pixelCount;
}

/**
 * 動画の指定時刻のフレームをCanvasに描画し、ピクセルデータを取得
 */
async function seekAndCapture(
  video: HTMLVideoElement,
  time: number,
  canvas: HTMLCanvasElement,
  ctx: CanvasRenderingContext2D
): Promise<Uint8ClampedArray> {
  video.currentTime = time;
  await new Promise<void>((resolve) => {
    video.onseeked = () => resolve();
  });
  ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
  return ctx.getImageData(0, 0, canvas.width, canvas.height).data;
}

/**
 * 動画全体をスキャンしてシーン変化ポイントを検出する
 *
 * @param video - HTML Video要素
 * @param sensitivity - 感度（0-1, 低いほど敏感）
 * @param onProgress - 進捗コールバック（0-100）
 * @returns シーン変化ポイントの配列（タイムスタンプと変化スコア）
 */
async function detectSceneChanges(
  video: HTMLVideoElement,
  sensitivity: number,
  onProgress?: (progress: number) => void
): Promise<{ timestamp: number; changeScore: number }[]> {
  const duration = video.duration;
  const totalScans = Math.floor(duration / SCAN_INTERVAL);

  // ダウンサンプリング用Canvas
  const scanCanvas = document.createElement('canvas');
  scanCanvas.width = SAMPLE_WIDTH;
  scanCanvas.height = SAMPLE_HEIGHT;
  const scanCtx = scanCanvas.getContext('2d')!;

  const changes: { timestamp: number; changeScore: number }[] = [];
  let previousPixels: Uint8ClampedArray | null = null;

  for (let i = 0; i <= totalScans; i++) {
    const time = Math.min(i * SCAN_INTERVAL, duration - 0.01);
    const currentPixels = await seekAndCapture(video, time, scanCanvas, scanCtx);

    if (previousPixels) {
      const diff = calculateFrameDifference(previousPixels, currentPixels);
      if (diff >= sensitivity) {
        changes.push({ timestamp: time, changeScore: diff });
      }
    }

    previousPixels = currentPixels;

    // 進捗報告（スキャンフェーズ全体を 0-100% として報告）
    if (onProgress) {
      onProgress(Math.round((i / totalScans) * 100));
    }
  }

  return changes;
}

/**
 * 近接する変化点を統合し、最大フレーム数に絞り込む
 */
function consolidateChanges(
  changes: { timestamp: number; changeScore: number }[],
  maxFrames: number
): { timestamp: number; changeScore: number }[] {
  if (changes.length === 0) return [];

  // 1. 最小間隔でフィルタ（近い変化点をマージ）
  const merged: typeof changes = [changes[0]];
  for (let i = 1; i < changes.length; i++) {
    const last = merged[merged.length - 1];
    if (changes[i].timestamp - last.timestamp < MIN_FRAME_INTERVAL) {
      // より大きな変化スコアのフレームを採用
      if (changes[i].changeScore > last.changeScore) {
        merged[merged.length - 1] = changes[i];
      }
    } else {
      merged.push(changes[i]);
    }
  }

  // 2. maxFramesを超える場合、変化スコアが大きい順に選別
  if (merged.length <= maxFrames) return merged;

  return merged
    .sort((a, b) => b.changeScore - a.changeScore)
    .slice(0, maxFrames)
    .sort((a, b) => a.timestamp - b.timestamp);
}

// ============================================================
// フレーム抽出（メインAPI）
// ============================================================

/**
 * 動画からフレームを抽出する（シーン変化検出モード / 等間隔モード対応）
 *
 * @param videoFile - 動画ファイル
 * @param options - 抽出オプション（省略時はシーン検出・最大10フレーム）
 * @returns 抽出フレームの配列
 */
export const extractFrames = async (
  videoFile: File,
  options?: Partial<ExtractOptions>
): Promise<ExtractedFrame[]> => {
  const opts: ExtractOptions = { ...DEFAULT_OPTIONS, ...options };

  return new Promise((resolve, reject) => {
    const video = document.createElement('video');
    video.src = URL.createObjectURL(videoFile);
    video.preload = 'auto';

    video.onloadedmetadata = async () => {
      try {
        let frameTimestamps: { timestamp: number; changeScore: number }[];

        if (opts.mode === 'auto') {
          // ========== シーン変化検出モード ==========
          const rawChanges = await detectSceneChanges(
            video,
            opts.sensitivity,
            opts.onProgress
          );
          frameTimestamps = consolidateChanges(rawChanges, opts.maxFrames);

          // 変化点が少なすぎる場合は等間隔フレームで補完
          if (frameTimestamps.length < MIN_FRAMES) {
            const equalFrames = generateEqualIntervals(
              video.duration,
              opts.maxFrames
            );
            // 検出済みの変化点と等間隔フレームをマージ（重複排除）
            const existingTimes = new Set(frameTimestamps.map(f => Math.round(f.timestamp * 10)));
            for (const eq of equalFrames) {
              if (!existingTimes.has(Math.round(eq.timestamp * 10))) {
                frameTimestamps.push(eq);
              }
            }
            // 時系列順に並べ替え、maxFramesに制限
            frameTimestamps.sort((a, b) => a.timestamp - b.timestamp);
            frameTimestamps = frameTimestamps.slice(0, opts.maxFrames);
          }
        } else {
          // ========== 等間隔モード ==========
          frameTimestamps = generateEqualIntervals(
            video.duration,
            opts.maxFrames
          );
        }

        // フレーム画像を高解像度でキャプチャ
        const captureCanvas = document.createElement('canvas');
        captureCanvas.width = video.videoWidth;
        captureCanvas.height = video.videoHeight;
        const captureCtx = captureCanvas.getContext('2d')!;

        const frames: ExtractedFrame[] = [];

        for (let i = 0; i < frameTimestamps.length; i++) {
          const { timestamp, changeScore } = frameTimestamps[i];
          video.currentTime = timestamp;
          await new Promise<void>((r) => (video.onseeked = () => r()));

          captureCtx.drawImage(
            video,
            0,
            0,
            captureCanvas.width,
            captureCanvas.height
          );

          frames.push({
            timestamp,
            dataUrl: captureCanvas.toDataURL('image/jpeg', 0.8),
            changeScore,
          });
        }

        URL.revokeObjectURL(video.src);
        resolve(frames);
      } catch (err) {
        URL.revokeObjectURL(video.src);
        reject(err);
      }
    };

    video.onerror = () => {
      URL.revokeObjectURL(video.src);
      reject(new Error('動画ファイルの読み込みに失敗しました'));
    };
  });
};

/**
 * 等間隔のフレームタイムスタンプを生成する
 */
function generateEqualIntervals(
  duration: number,
  count: number
): { timestamp: number; changeScore: number }[] {
  const interval = duration / (count + 1);
  const results: { timestamp: number; changeScore: number }[] = [];
  for (let i = 1; i <= count; i++) {
    results.push({ timestamp: i * interval, changeScore: 0 });
  }
  return results;
}

// ============================================================
// アノテーション描画（既存機能を維持）
// ============================================================

/**
 * Canvas上にバウンディングボックスのアノテーションを描画する
 */
export const drawAnnotation = (
  canvas: HTMLCanvasElement,
  box: [number, number, number, number]
) => {
  const ctx = canvas.getContext('2d');
  if (!ctx) return;

  const [ymin, xmin, ymax, xmax] = box;
  const width = canvas.width;
  const height = canvas.height;

  const x = (xmin / 1000) * width;
  const y = (ymin / 1000) * height;
  const w = ((xmax - xmin) / 1000) * width;
  const h = ((ymax - ymin) / 1000) * height;

  // 赤枠のスタイル
  ctx.strokeStyle = '#ef4444';
  ctx.lineWidth = 4;
  ctx.lineJoin = 'round';
  ctx.strokeRect(x, y, w, h);

  // ラベルの描画
  ctx.fillStyle = '#ef4444';
  ctx.font = 'bold 16px sans-serif';
  ctx.fillText('CLICK HERE', x, y > 20 ? y - 5 : y + h + 20);
};
