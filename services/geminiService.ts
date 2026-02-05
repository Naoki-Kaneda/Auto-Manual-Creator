
import { GoogleGenAI, Type } from "@google/genai";
import { GeminiStepResponse } from "../types";

export const analyzeStep = async (
  imageData: string, 
  contextPrompt: string, 
  languages: string[]
): Promise<GeminiStepResponse> => {
  // Always initialize Gemini API using process.env.API_KEY directly as per guidelines
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  
  const langNames: Record<string, string> = {
    ja: "Japanese (日本語)",
    en: "English",
    zh: "Chinese (简体中文)",
    ko: "Korean (韓国語)"
  };

  const requestedLangs = languages.map(l => langNames[l]).join(", ");

  const response = await ai.models.generateContent({
    model: "gemini-3-flash-preview",
    contents: {
      parts: [
        {
          inlineData: {
            mimeType: "image/jpeg",
            data: imageData.split(',')[1],
          },
        },
        {
          text: `
          これはソフトウェアの操作手順動画の1フレームです。
          この画像を分析し、現在の操作ステップを抽出してください。
          動画の文脈: ${contextPrompt}

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

  // Use the .text property directly (not a method) as per SDK rules
  return JSON.parse(response.text || "{}") as GeminiStepResponse;
};
