import type { VercelRequest, VercelResponse } from '@vercel/node';
import { GoogleGenAI, Type } from '@google/genai';

/**
 * Gemini API を呼び出すサーバーサイドAPI
 * APIキーはサーバー側の環境変数に保持され、クライアントには露出しない
 */

interface AnalyzeRequest {
    imageData: string;      // Base64エンコードされた画像データ
    contextPrompt: string;  // 文脈情報
    languages: string[];    // 出力言語リスト
    previousStep?: {        // 前のステップの情報（文脈強化用）
        title: string;
        description: string;
    };
}

interface Translation {
    title: string;
    description: string;
}

interface AnalyzeResponse {
    translations: Record<string, Translation>;
    box_2d?: [number, number, number, number];
}

// 言語コードと表示名のマッピング
const langNames: Record<string, string> = {
    ja: "Japanese (日本語)",
    en: "English",
    zh: "Chinese (简体中文)",
    ko: "Korean (韓国語)"
};

export default async function handler(
    req: VercelRequest,
    res: VercelResponse
) {
    // CORSヘッダーの設定
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    // OPTIONSリクエスト（プリフライト）への対応
    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    // POSTメソッドのみ許可
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    try {
        const { imageData, contextPrompt, languages, previousStep } = req.body as AnalyzeRequest;

        // 入力バリデーション
        if (!imageData || !contextPrompt || !languages || languages.length === 0) {
            return res.status(400).json({ error: 'Missing required parameters' });
        }

        // 環境変数からAPIキーを取得
        const apiKey = process.env.GEMINI_API_KEY;
        if (!apiKey) {
            console.error('GEMINI_API_KEY is not set');
            return res.status(500).json({ error: 'Server configuration error' });
        }

        // Gemini API クライアントを初期化
        const ai = new GoogleGenAI({ apiKey });

        const requestedLangs = languages.map(l => langNames[l] || l).join(", ");

        // Gemini API リクエスト
        const response = await ai.models.generateContent({
            model: "gemini-3-flash-preview",
            contents: {
                parts: [
                    {
                        inlineData: {
                            mimeType: "image/jpeg",
                            data: imageData.includes(',') ? imageData.split(',')[1] : imageData,
                        },
                    },
                    {
                        text: `
            これはソフトウェアの操作手順動画の1フレームです。
            この画像を分析し、現在の操作ステップを抽出してください。
            動画の文脈: ${contextPrompt}
${previousStep ? `
            前のステップのタイトル: "${previousStep.title}"
            前のステップの説明: "${previousStep.description}"
            このステップでは、前のステップからどのような変化が起きたかに注目して、新しい操作内容を記述してください。
` : ''}
            以下の言語ですべて翻訳を提供してください: ${requestedLangs}

            出力はJSON形式で行い、各言語コードをキーにしてください。
            "box_2d" は操作対象のUI要素（ボタンや入力欄など）がある場合のみ、[ymin, xmin, ymax, xmax] (0-1000スケール) で含めてください。
            `
                    }
                ],
            },
            config: {
                responseMimeType: "application/json",
                responseSchema: {
                    type: Type.OBJECT,
                    properties: {
                        translations: {
                            type: Type.OBJECT,
                            properties: languages.reduce((acc, lang) => ({
                                ...acc,
                                [lang]: {
                                    type: Type.OBJECT,
                                    properties: {
                                        title: { type: Type.STRING },
                                        description: { type: Type.STRING }
                                    },
                                    required: ["title", "description"]
                                }
                            }), {})
                        },
                        box_2d: {
                            type: Type.ARRAY,
                            items: { type: Type.NUMBER },
                            description: "[ymin, xmin, ymax, xmax] normalized 0-1000"
                        }
                    },
                    required: ["translations"]
                }
            }
        });

        // レスポンスをパース
        const result: AnalyzeResponse = JSON.parse(response.text || "{}");

        return res.status(200).json(result);

    } catch (error) {
        console.error('API Error:', error);
        return res.status(500).json({
            error: 'Failed to analyze image',
            details: error instanceof Error ? error.message : 'Unknown error'
        });
    }
}
