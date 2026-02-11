
import React, { useState } from 'react';
import { Upload, FileVideo, Zap, CheckCircle, Download, Loader2, ArrowRight, Languages, Globe, SlidersHorizontal, Sparkles, LayoutGrid } from 'lucide-react';
import { Step, ExtractionMode } from './types';
import { extractFrames } from './utils/videoProcessor';
import { analyzeStep } from './services/geminiService';
import StepCard from './components/StepCard';

const App: React.FC = () => {
  const [videoFile, setVideoFile] = useState<File | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [progress, setProgress] = useState(0);
  const [steps, setSteps] = useState<Step[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [selectedLangs, setSelectedLangs] = useState<string[]>(['ja', 'en']);
  const [extractionMode, setExtractionMode] = useState<ExtractionMode>('auto');
  const [maxFrames, setMaxFrames] = useState(10);
  const [processingPhase, setProcessingPhase] = useState<'scanning' | 'analyzing'>('scanning');

  const languages = [
    { id: 'ja', label: '日本語' },
    { id: 'en', label: 'English' },
    { id: 'zh', label: '简体中文' },
    { id: 'ko', label: '한국어' }
  ];

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setVideoFile(e.target.files[0]);
      setSteps([]);
      setError(null);
    }
  };

  const toggleLanguage = (id: string) => {
    setSelectedLangs(prev =>
      prev.includes(id)
        ? (prev.length > 1 ? prev.filter(l => l !== id) : prev)
        : [...prev, id]
    );
  };

  // PDFダウンロード関数 - 動画名でファイル名を自動設定
  const downloadPdf = async () => {
    // html2pdf.js がグローバルに読み込まれている
    const html2pdf = (window as any).html2pdf;
    if (!html2pdf) {
      console.error('html2pdf is not loaded');
      window.print(); // フォールバック
      return;
    }

    // PDF生成対象の要素を取得
    const element = document.querySelector('main');
    if (!element) return;

    // 動画ファイル名から拡張子を除去してPDFファイル名を生成
    const baseName = videoFile?.name.replace(/\.[^/.]+$/, '') || 'manual';
    const fileName = `${baseName}_操作手順書.pdf`;

    // PDF生成オプション
    const options = {
      margin: [10, 10, 10, 10],
      filename: fileName,
      image: { type: 'jpeg', quality: 0.95 },
      html2canvas: {
        scale: 2,
        useCORS: true,
        letterRendering: true
      },
      jsPDF: {
        unit: 'mm',
        format: 'a4',
        orientation: 'portrait'
      },
      pagebreak: {
        mode: ['avoid-all', 'css', 'legacy'],
        before: '.page-break-before',
        after: '.page-break-after',
        avoid: '.break-inside-avoid'
      }
    };

    try {
      await html2pdf().set(options).from(element).save();
    } catch (err) {
      console.error('PDF generation failed:', err);
      window.print(); // フォールバック
    }
  };

  const processVideo = async () => {
    if (!videoFile) return;

    try {
      setIsProcessing(true);
      setError(null);
      setSteps([]);
      setProgress(0);
      setProcessingPhase('scanning');

      // フェーズ1: フレームの抽出（シーン変化検出 or 等間隔）
      const frames = await extractFrames(videoFile, {
        mode: extractionMode,
        maxFrames,
        sensitivity: 0.15,
        onProgress: (p) => setProgress(Math.round(p * 0.3)), // 0-30%
      });
      setProgress(30);
      setProcessingPhase('analyzing');

      const generatedSteps: Step[] = [];

      // フェーズ2: 各フレームをGeminiで解析（前ステップの文脈を渡す）
      for (let i = 0; i < frames.length; i++) {
        const frame = frames[i];

        // 前のステップの情報を取得（2つ目以降のフレーム）
        const previousStep = generatedSteps.length > 0
          ? {
            title: Object.values(generatedSteps[generatedSteps.length - 1].translations)[0]?.title || '',
            description: Object.values(generatedSteps[generatedSteps.length - 1].translations)[0]?.description || ''
          }
          : undefined;

        const analysis = await analyzeStep(
          frame.dataUrl,
          `動画タイトル: "${videoFile.name}" のチュートリアル。ステップ ${i + 1}/${frames.length}`,
          selectedLangs,
          previousStep
        );

        generatedSteps.push({
          id: Math.random().toString(36).substr(2, 9),
          timestamp: frame.timestamp,
          translations: analysis.translations,
          image: frame.dataUrl,
          boundingBox: analysis.box_2d
        });

        setProgress(30 + ((i + 1) / frames.length) * 70); // 30-100%
      }

      setSteps(generatedSteps);
      setProgress(100);
    } catch (err) {
      console.error(err);
      setError("動画の処理に失敗しました。APIキーまたはファイル形式を確認してください。");
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="min-h-screen pb-20 bg-[#f8fafc]">
      {/* Header */}
      <header className="bg-white border-b border-slate-200 sticky top-0 z-20 shadow-sm">
        <div className="max-w-5xl mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="bg-indigo-600 p-1.5 rounded-lg shadow-indigo-200 shadow-lg">
              <Zap className="text-white w-5 h-5 fill-current" />
            </div>
            <h1 className="text-xl font-bold text-slate-900 tracking-tight">
              AutoManual <span className="text-indigo-600 italic">AI</span>
            </h1>
          </div>

          {steps.length > 0 && (
            <button
              onClick={downloadPdf}
              className="flex items-center gap-2 px-4 py-2 bg-slate-900 text-white rounded-lg hover:bg-slate-800 transition-all text-sm font-bold shadow-md active:scale-95"
            >
              <Download className="w-4 h-4" />
              PDFで保存
            </button>
          )}
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 pt-10">
        {!videoFile && !isProcessing && (
          <div className="max-w-3xl mx-auto mt-10">
            <div className="text-center mb-10">
              <div className="inline-flex items-center gap-2 px-3 py-1 bg-indigo-50 text-indigo-700 rounded-full text-xs font-bold mb-4 border border-indigo-100">
                <Globe className="w-3 h-3" />
                多言語対応 AI 手順書ジェネレーター
              </div>
              <h2 className="text-4xl font-extrabold text-slate-900 mb-4 tracking-tight leading-tight">
                動画をアップロードするだけで、<br />
                <span className="text-indigo-600 underline decoration-indigo-200">プロ級の手順書</span>を自動生成。
              </h2>
              <p className="text-slate-500 text-lg">Agentic Vision AI が操作内容を理解し、赤枠付きの画像と多言語解説を作成します。</p>
            </div>

            <label className="group relative block w-full aspect-video border-2 border-dashed border-slate-300 rounded-3xl hover:border-indigo-500 hover:bg-indigo-50/30 transition-all cursor-pointer bg-white shadow-sm overflow-hidden">
              <input type="file" className="hidden" accept="video/*" onChange={handleFileChange} />
              <div className="absolute inset-0 flex flex-col items-center justify-center p-6">
                <div className="w-20 h-20 bg-slate-50 rounded-2xl flex items-center justify-center mb-6 group-hover:scale-110 group-hover:bg-white transition-all shadow-sm">
                  <Upload className="text-slate-400 group-hover:text-indigo-600 w-10 h-10" />
                </div>
                <p className="text-slate-700 font-bold text-xl mb-2">動画ファイルをここにドロップ</p>
                <p className="text-slate-400 text-sm">または、クリックしてファイルを選択（MP4, MOV, WEBM）</p>
              </div>
            </label>

            <div className="mt-16 grid grid-cols-3 gap-8">
              {[
                { icon: <FileVideo />, title: "録画", desc: "操作画面を撮影した動画を準備します。" },
                { icon: <Zap />, title: "AI解析", desc: "Geminiが操作のキーポイントを自動で抽出。" },
                { icon: <CheckCircle />, title: "多言語出力", desc: "日本語・英語など複数言語で手順を表示。" }
              ].map((item, i) => (
                <div key={i} className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 hover:shadow-md transition-all">
                  <div className="w-12 h-12 bg-indigo-50 text-indigo-600 rounded-xl flex items-center justify-center mb-4">{item.icon}</div>
                  <h4 className="font-bold text-slate-800 text-lg mb-2">{item.title}</h4>
                  <p className="text-sm text-slate-500 leading-relaxed">{item.desc}</p>
                </div>
              ))}
            </div>
          </div>
        )}

        {videoFile && !isProcessing && steps.length === 0 && (
          <div className="max-w-xl mx-auto space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div className="bg-white p-8 rounded-3xl shadow-xl border border-slate-100 text-center">
              <div className="bg-indigo-50 w-20 h-20 rounded-2xl flex items-center justify-center mx-auto mb-6">
                <FileVideo className="text-indigo-600 w-10 h-10" />
              </div>
              <h3 className="text-2xl font-bold text-slate-900 mb-2">動画の準備ができました</h3>
              <p className="text-slate-500 mb-8">{videoFile.name} ({(videoFile.size / 1024 / 1024).toFixed(1)} MB)</p>

              <div className="space-y-6 text-left mb-8 bg-slate-50 p-6 rounded-2xl border border-slate-200">
                {/* 言語選択 */}
                <div className="flex items-center gap-2 mb-4">
                  <Languages className="w-5 h-5 text-indigo-600" />
                  <span className="font-bold text-slate-700">出力言語を選択してください:</span>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  {languages.map(lang => (
                    <button
                      key={lang.id}
                      onClick={() => toggleLanguage(lang.id)}
                      className={`flex items-center justify-between p-3 rounded-xl border-2 transition-all font-medium ${selectedLangs.includes(lang.id)
                        ? 'border-indigo-500 bg-white text-indigo-700 shadow-sm'
                        : 'border-transparent bg-white/50 text-slate-400 hover:border-slate-300'
                        }`}
                    >
                      <span>{lang.label}</span>
                      {selectedLangs.includes(lang.id) && <CheckCircle className="w-4 h-4 text-indigo-600" />}
                    </button>
                  ))}
                </div>

                {/* フレーム抽出設定 */}
                <div className="mt-6 pt-6 border-t border-slate-200">
                  <div className="flex items-center gap-2 mb-4">
                    <SlidersHorizontal className="w-5 h-5 text-indigo-600" />
                    <span className="font-bold text-slate-700">フレーム抽出設定:</span>
                  </div>

                  {/* モード切替 */}
                  <div className="grid grid-cols-2 gap-3 mb-4">
                    <button
                      onClick={() => setExtractionMode('auto')}
                      className={`flex items-center gap-2 p-3 rounded-xl border-2 transition-all font-medium ${extractionMode === 'auto'
                          ? 'border-indigo-500 bg-white text-indigo-700 shadow-sm'
                          : 'border-transparent bg-white/50 text-slate-400 hover:border-slate-300'
                        }`}
                    >
                      <Sparkles className="w-4 h-4" />
                      <div className="text-left">
                        <div className="text-sm font-bold">自動（シーン検出）</div>
                        <div className="text-[10px] opacity-70">画面変化を自動検知</div>
                      </div>
                    </button>
                    <button
                      onClick={() => setExtractionMode('manual')}
                      className={`flex items-center gap-2 p-3 rounded-xl border-2 transition-all font-medium ${extractionMode === 'manual'
                          ? 'border-indigo-500 bg-white text-indigo-700 shadow-sm'
                          : 'border-transparent bg-white/50 text-slate-400 hover:border-slate-300'
                        }`}
                    >
                      <LayoutGrid className="w-4 h-4" />
                      <div className="text-left">
                        <div className="text-sm font-bold">手動（等間隔）</div>
                        <div className="text-[10px] opacity-70">均等にフレーム分割</div>
                      </div>
                    </button>
                  </div>

                  {/* フレーム数スライダー */}
                  <div className="bg-white p-4 rounded-xl border border-slate-100">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm text-slate-600">最大フレーム数</span>
                      <span className="text-sm font-bold text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded-lg">{maxFrames}</span>
                    </div>
                    <input
                      type="range"
                      min="3"
                      max="15"
                      value={maxFrames}
                      onChange={(e) => setMaxFrames(Number(e.target.value))}
                      className="w-full h-2 bg-slate-100 rounded-lg appearance-none cursor-pointer accent-indigo-600"
                    />
                    <div className="flex justify-between text-[10px] text-slate-400 mt-1">
                      <span>3</span>
                      <span>15</span>
                    </div>
                  </div>
                </div>
              </div>

              <div className="flex gap-4">
                <button
                  onClick={() => setVideoFile(null)}
                  className="flex-1 py-4 px-6 border border-slate-200 rounded-2xl text-slate-600 font-bold hover:bg-slate-50 transition-colors"
                >
                  キャンセル
                </button>
                <button
                  onClick={processVideo}
                  className="flex-[2] py-4 px-6 bg-indigo-600 text-white rounded-2xl font-bold hover:bg-indigo-700 shadow-xl shadow-indigo-100 flex items-center justify-center gap-3 group transition-all"
                >
                  解析を開始する
                  <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
                </button>
              </div>
            </div>
          </div>
        )}

        {isProcessing && (
          <div className="max-w-xl mx-auto text-center py-20 animate-in fade-in duration-500">
            <div className="relative w-32 h-32 mx-auto mb-10">
              <div className="absolute inset-0 rounded-full border-4 border-indigo-100 border-t-indigo-600 animate-spin"></div>
              <div className="absolute inset-0 flex items-center justify-center">
                <span className="text-2xl font-black text-indigo-600">{Math.round(progress)}%</span>
              </div>
            </div>
            <h2 className="text-3xl font-bold text-slate-900 mb-4">手順書を自動生成中...</h2>
            <p className="text-slate-500 max-w-sm mx-auto leading-relaxed">
              {processingPhase === 'scanning'
                ? 'シーン変化を検出しながらキーフレームを抽出しています...'
                : 'AIが各フレームを分析し、多言語での操作手順を生成しています...'}
            </p>

            <div className="mt-12 w-full bg-slate-100 h-4 rounded-full overflow-hidden shadow-inner border border-slate-200">
              <div
                className="bg-indigo-600 h-full transition-all duration-700 ease-out relative"
                style={{ width: `${progress}%` }}
              >
                <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent animate-pulse"></div>
              </div>
            </div>
          </div>
        )}

        {error && (
          <div className="max-w-md mx-auto mt-10 p-6 bg-red-50 border border-red-200 rounded-2xl text-red-700 text-center shadow-lg shadow-red-50">
            <p className="font-bold text-lg mb-2 text-red-800">エラーが発生しました</p>
            <p className="text-sm opacity-90">{error}</p>
            <button
              onClick={() => setVideoFile(null)}
              className="mt-6 px-6 py-2 bg-red-100 text-red-700 text-sm font-bold rounded-xl hover:bg-red-200 transition-colors"
            >
              もう一度試す
            </button>
          </div>
        )}

        {steps.length > 0 && !isProcessing && (
          <div className="space-y-12 animate-in fade-in duration-1000 print:space-y-8">
            <div className="flex flex-col md:flex-row md:items-end justify-between gap-8 mb-12 pb-10 border-b-2 border-slate-100">
              <div className="flex-1">
                <div className="inline-flex items-center gap-2 px-3 py-1 bg-green-100 text-green-700 text-xs font-bold rounded-full mb-4 uppercase tracking-widest border border-green-200">
                  <CheckCircle className="w-3 h-3" />
                  解析完了
                </div>
                <h2 className="text-4xl font-black text-slate-900 tracking-tight leading-tight">操作手順マニュアル</h2>
                <p className="text-slate-500 mt-3 flex items-center gap-2">
                  <FileVideo className="w-4 h-4" />
                  参照動画: {videoFile?.name}
                </p>
              </div>
              <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex items-center gap-6 min-w-[240px]">
                <div className="text-center flex-1">
                  <p className="text-[10px] text-slate-400 font-black uppercase tracking-widest mb-1">ステップ数</p>
                  <p className="text-2xl font-black text-indigo-600">{steps.length}</p>
                </div>
                <div className="w-px h-10 bg-slate-100"></div>
                <div className="text-center flex-1">
                  <p className="text-[10px] text-slate-400 font-black uppercase tracking-widest mb-1">言語数</p>
                  <p className="text-2xl font-black text-slate-700">{selectedLangs.length}</p>
                </div>
              </div>
            </div>

            <div className="print:block">
              {steps.map((step, index) => (
                <StepCard key={step.id} step={step} index={index} />
              ))}
            </div>

            <div className="text-center py-12 border-t border-slate-100 opacity-60 print:mt-10">
              <p className="text-slate-400 text-sm font-medium">
                © {new Date().getFullYear()} AutoManual AI • Powered by Gemini 3.0 Agentic Vision
              </p>
            </div>
          </div>
        )}
      </main>
    </div>
  );
};

export default App;
