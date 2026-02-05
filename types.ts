
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
