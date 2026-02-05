
import { GeminiStepResponse } from "../types";

/**
 * サーバーサイドAPIを経由してステップを解析
 * APIキーはサーバー側で管理され、クライアントには露出しない
 */
export const analyzeStep = async (
  imageData: string,
  contextPrompt: string,
  languages: string[]
): Promise<GeminiStepResponse> => {

  // ローカル開発時とVercelデプロイ時で異なるエンドポイントを使用
  const apiEndpoint = import.meta.env.DEV
    ? '/api/analyze'   // 開発時: Vite proxy経由
    : '/api/analyze';  // 本番時: Vercel Serverless Function

  const response = await fetch(apiEndpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      imageData,
      contextPrompt,
      languages
    })
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.error || `API request failed: ${response.status}`);
  }

  const result = await response.json();
  return result as GeminiStepResponse;
};
