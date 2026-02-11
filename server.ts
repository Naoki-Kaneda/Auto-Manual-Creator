/**
 * ローカル開発用APIサーバー
 * Vercel Serverless Functionsをローカルでエミュレート
 */

import express from 'express';
import cors from 'cors';
import { config } from 'dotenv';

// .env.local から環境変数を読み込み
config({ path: '.env.local' });

const app = express();
const PORT = 3001;

// ミドルウェア
app.use(cors());
app.use(express.json({ limit: '50mb' })); // 大きな画像データを受け取るため

// Analyze APIエンドポイント
app.post('/api/analyze', async (req, res) => {
    try {
        const { imageData, contextPrompt, languages, previousStep } = req.body;

        // 入力バリデーション
        if (!imageData || !contextPrompt || !languages || languages.length === 0) {
            return res.status(400).json({ error: 'Missing required parameters' });
        }

        // 環境変数からAPIキーを取得
        const apiKey = process.env.GEMINI_API_KEY;
        if (!apiKey) {
            console.error('GEMINI_API_KEY is not set in .env.local');
            return res.status(500).json({ error: 'Server configuration error: API key not found' });
        }

        // 動的インポートでESMモジュールを読み込み
        const { GoogleGenAI, Type } = await import('@google/genai');

        const ai = new GoogleGenAI({ apiKey });

        const langNames: Record<string, string> = {
            ja: "Japanese (日本語)",
            en: "English",
            zh: "Chinese (简体中文)",
            ko: "Korean (韓国語)"
        };

        const requestedLangs = languages.map((l: string) => langNames[l] || l).join(", ");

        console.log(`Processing request for languages: ${requestedLangs}`);

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
                            properties: languages.reduce((acc: Record<string, any>, lang: string) => ({
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

        const result = JSON.parse(response.text || "{}");
        console.log('Successfully processed frame');

        return res.status(200).json(result);

    } catch (error) {
        console.error('API Error:', error);
        return res.status(500).json({
            error: 'Failed to analyze image',
            details: error instanceof Error ? error.message : 'Unknown error'
        });
    }
});

// サーバー起動
app.listen(PORT, () => {
    console.log(`🚀 開発用APIサーバーが起動しました: http://localhost:${PORT}`);
    console.log(`   APIキー設定: ${process.env.GEMINI_API_KEY ? '✅ 設定済み' : '❌ 未設定'}`);
});
