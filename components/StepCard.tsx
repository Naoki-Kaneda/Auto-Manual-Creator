
import React, { useEffect, useRef } from 'react';
import { Step, Translation } from '../types';
import { drawAnnotation } from '../utils/videoProcessor';

interface StepCardProps {
  step: Step;
  index: number;
}

const StepCard: React.FC<StepCardProps> = ({ step, index }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const img = new Image();
    img.src = step.image;
    img.onload = () => {
      canvas.width = img.width;
      canvas.height = img.height;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.drawImage(img, 0, 0);
        if (step.boundingBox) {
          drawAnnotation(canvas, step.boundingBox);
        }
      }
    };
  }, [step]);

  const langLabels: Record<string, string> = {
    ja: "日本語",
    en: "English",
    zh: "中国語",
    ko: "韓国語"
  };

  const primaryLang = Object.keys(step.translations)[0];

  return (
    <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden mb-8 transition-all hover:shadow-md break-inside-avoid">
      <div className="p-4 border-b border-slate-100 bg-slate-50/50 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <span className="w-8 h-8 rounded-full bg-indigo-600 text-white flex items-center justify-center font-bold text-sm">
            {index + 1}
          </span>
          <h3 className="text-lg font-semibold text-slate-800">
            {step.translations[primaryLang]?.title}
          </h3>
        </div>
        <span className="text-xs font-mono text-slate-400">
          タイムスタンプ: {step.timestamp.toFixed(2)}秒
        </span>
      </div>
      
      <div className="p-6 grid grid-cols-1 lg:grid-cols-2 gap-8 items-start">
        <div className="relative rounded-lg border border-slate-200 overflow-hidden bg-black shadow-inner">
          <canvas 
            ref={canvasRef} 
            className="w-full h-auto block"
          />
        </div>
        
        <div className="space-y-4">
          {Object.entries(step.translations).map(([lang, content]) => (
            <div key={lang} className="bg-slate-50 border-l-4 border-indigo-400 p-4 rounded-r-lg">
              <div className="flex items-center gap-2 mb-1">
                <span className="text-[10px] font-bold bg-indigo-100 text-indigo-700 px-1.5 py-0.5 rounded uppercase tracking-wider">
                  {langLabels[lang] || lang}
                </span>
                {/* Fixed: Cast content to Translation type to resolve 'unknown' property access error */}
                <h4 className="text-sm font-bold text-slate-700">{(content as Translation).title}</h4>
              </div>
              <p className="text-slate-600 leading-relaxed text-base italic">
                {/* Fixed: Cast content to Translation type to resolve 'unknown' property access error */}
                "{(content as Translation).description}"
              </p>
            </div>
          ))}
          
          <div className="pt-2 space-y-2 border-t border-slate-100">
            <h4 className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">AI解析ステータス</h4>
            <div className="flex items-center gap-2">
              <div className="h-2 w-2 rounded-full bg-green-500"></div>
              <span className="text-xs text-slate-500">操作内容の特定完了</span>
            </div>
            {step.boundingBox && (
              <div className="flex items-center gap-2">
                <div className="h-2 w-2 rounded-full bg-red-500"></div>
                <span className="text-xs text-slate-500">UI要素への赤枠アノテーション適用済み</span>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default StepCard;
