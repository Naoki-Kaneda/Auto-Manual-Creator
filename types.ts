
export interface Translation {
  title: string;
  description: string;
}

export interface Step {
  id: string;
  timestamp: number;
  translations: Record<string, Translation>; // key: language code (e.g., 'ja', 'en')
  image: string; // Base64
  boundingBox?: [number, number, number, number]; // [ymin, xmin, ymax, xmax] 0-1000
}

export interface Manual {
  title: string;
  steps: Step[];
}

export interface GeminiStepResponse {
  translations: Record<string, Translation>;
  box_2d?: [number, number, number, number];
}

/** フレーム抽出モード */
export type ExtractionMode = 'auto' | 'manual';

/** フレーム抽出オプション */
export interface ExtractOptions {
  /** 抽出モード: auto=シーン変化検出, manual=等間隔 */
  mode: ExtractionMode;
  /** 最大フレーム数（デフォルト: 10） */
  maxFrames: number;
  /** シーン変化検出の感度 0-1（デフォルト: 0.15） */
  sensitivity: number;
  /** 進捗コールバック（0-100） */
  onProgress?: (progress: number) => void;
}

/** 抽出されたフレーム */
export interface ExtractedFrame {
  /** フレームのタイムスタンプ（秒） */
  timestamp: number;
  /** Base64エンコードされた画像データ */
  dataUrl: string;
  /** シーン変化スコア（0-1, 高いほど大きな変化） */
  changeScore: number;
}
