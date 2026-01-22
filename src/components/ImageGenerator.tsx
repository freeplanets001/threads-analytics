'use client';

import { useState, useCallback } from 'react';
import { ImageEditor } from './ImageEditor';

interface ImageGeneratorProps {
  apiKey: string | null;
  onImageGenerated: (imageUrl: string) => void;
  onClose: () => void;
  onOpenSettings: () => void;
}

// ワンクリック生成プリセット（人気のもの）
const QUICK_PRESETS = [
  { id: 'sns-eye', name: 'SNS映え画像', prompt: 'eye-catching social media image, vibrant colors, modern design, trending aesthetic', icon: '📱', style: 'photo' },
  { id: 'quote-bg', name: '引用背景', prompt: 'elegant quote background, soft gradient, minimalist design, text space in center', icon: '💬', style: 'minimal' },
  { id: 'product', name: '商品紹介', prompt: 'professional product photography, clean white background, soft lighting, commercial quality', icon: '🛍️', style: 'photo' },
  { id: 'landscape', name: '風景写真', prompt: 'beautiful landscape photography, golden hour lighting, scenic view, high quality nature photo', icon: '🏞️', style: 'photo' },
  { id: 'abstract', name: '抽象アート', prompt: 'abstract art, colorful gradients, flowing shapes, modern digital art', icon: '🎨', style: 'illustration' },
  { id: 'anime', name: 'アニメ風', prompt: 'anime style illustration, vibrant colors, detailed anime art, Japanese animation style', icon: '✨', style: 'anime' },
];

// 例示プロンプト（クリックで入力）
const EXAMPLE_PROMPTS = [
  '青空の下で微笑む柴犬、フォトリアル',
  'ネオン街を歩く女性のシルエット、サイバーパンク風',
  'テーブルの上のコーヒーとクロワッサン、おしゃれなカフェ風',
  '未来都市の夜景、高層ビルとネオンライト',
  '桜の木の下で本を読む少女、アニメ風イラスト',
  'ミニマルなロゴデザイン用の幾何学模様',
];

// スタイルプリセット（コンパクト版）
const STYLES = [
  { id: 'photo', name: 'フォト', icon: '📷' },
  { id: 'illustration', name: 'イラスト', icon: '🎨' },
  { id: 'anime', name: 'アニメ', icon: '✨' },
  { id: '3d', name: '3D', icon: '🎮' },
  { id: 'minimal', name: 'ミニマル', icon: '⬜' },
  { id: 'vintage', name: 'レトロ', icon: '📻' },
];

// アスペクト比
const RATIOS = [
  { id: '1:1', name: '1:1', icon: '⬛' },
  { id: '4:5', name: '4:5', icon: '📱' },
  { id: '16:9', name: '16:9', icon: '🖥️' },
  { id: '9:16', name: '9:16', icon: '📲' },
];

export function ImageGenerator({ apiKey, onImageGenerated, onClose, onOpenSettings }: ImageGeneratorProps) {
  const [prompt, setPrompt] = useState('');
  const [selectedStyle, setSelectedStyle] = useState<string | null>(null);
  const [aspectRatio, setAspectRatio] = useState('1:1');
  const [generating, setGenerating] = useState(false);
  const [generatedImage, setGeneratedImage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [showEditor, setShowEditor] = useState(false);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [negativePrompt, setNegativePrompt] = useState('');
  const [history, setHistory] = useState<string[]>([]);
  const [provider, setProvider] = useState<string>('');

  // スタイルに応じたプロンプト修飾子
  const getStyleModifier = (styleId: string | null): string => {
    const modifiers: Record<string, string> = {
      photo: 'photorealistic, high quality photograph, professional photography, 8k',
      illustration: 'digital illustration, artwork, detailed illustration, vibrant colors',
      anime: 'anime style, Japanese animation, cel shaded, detailed anime art',
      '3d': '3D render, CGI, octane render, high quality 3D art',
      minimal: 'minimalist design, clean, simple, modern, white space',
      vintage: 'vintage style, retro, nostalgic, film grain effect',
    };
    return styleId ? modifiers[styleId] || '' : '';
  };

  // 画像生成
  const handleGenerate = async (customPrompt?: string) => {
    const finalPrompt = customPrompt || prompt;

    if (!finalPrompt.trim()) {
      setError('プロンプトを入力してください');
      return;
    }

    if (!apiKey) {
      onOpenSettings();
      return;
    }

    setGenerating(true);
    setError(null);

    try {
      const styleModifier = getStyleModifier(selectedStyle);
      const fullPrompt = styleModifier
        ? `${finalPrompt}, ${styleModifier}`
        : finalPrompt;

      const res = await fetch('/api/ai/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'image',
          prompt: fullPrompt,
          options: {
            aspectRatio,
            negativePrompt,
            autoOptimize: true,
            quality: 'high',
          },
          apiKey,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        let errorMsg = data.error || '画像生成に失敗しました';
        if (data.suggestion) errorMsg += '\n' + data.suggestion;
        setError(errorMsg);
      } else {
        setGeneratedImage(data.image);
        setProvider(data.provider || '');
        // 履歴に追加
        setHistory(prev => [data.image, ...prev.slice(0, 4)]);
      }
    } catch (err) {
      console.error('Image generation error:', err);
      setError('画像生成に失敗しました');
    } finally {
      setGenerating(false);
    }
  };

  // クイック生成
  const handleQuickGenerate = (preset: typeof QUICK_PRESETS[0]) => {
    setPrompt(preset.prompt);
    setSelectedStyle(preset.style);
    handleGenerate(preset.prompt);
  };

  // 画像を使用
  const handleUseImage = async () => {
    if (!generatedImage) return;
    setUploading(true);
    setError(null);

    try {
      const base64Data = generatedImage.split(',')[1];
      const mimeType = generatedImage.split(';')[0].split(':')[1] || 'image/png';
      const byteCharacters = atob(base64Data);
      const byteNumbers = new Array(byteCharacters.length);
      for (let i = 0; i < byteCharacters.length; i++) {
        byteNumbers[i] = byteCharacters.charCodeAt(i);
      }
      const byteArray = new Uint8Array(byteNumbers);
      const blob = new Blob([byteArray], { type: mimeType });
      const file = new File([blob], `ai-${Date.now()}.png`, { type: mimeType });

      const formData = new FormData();
      formData.append('file', file);

      const res = await fetch('/api/upload', { method: 'POST', body: formData });
      const data = await res.json();

      if (!res.ok) throw new Error(data.error);
      onImageGenerated(data.url);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'アップロード失敗');
    } finally {
      setUploading(false);
    }
  };

  // ダウンロード
  const handleDownload = () => {
    if (!generatedImage) return;
    const link = document.createElement('a');
    link.href = generatedImage;
    link.download = `ai-image-${Date.now()}.png`;
    link.click();
  };

  // 履歴から選択
  const selectFromHistory = (img: string) => {
    setGeneratedImage(img);
  };

  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-2 sm:p-4">
      <div className="bg-white rounded-2xl w-full max-w-5xl max-h-[95vh] overflow-hidden flex flex-col shadow-2xl">
        {/* Header */}
        <div className="px-4 py-3 bg-gradient-to-r from-violet-600 via-purple-600 to-pink-600 flex items-center justify-between">
          <div>
            <h2 className="text-lg font-bold text-white flex items-center gap-2">
              🎨 AI画像生成スタジオ
            </h2>
            <p className="text-xs text-white/70">Nano Banana Pro (Gemini 3 Pro)</p>
          </div>
          <button onClick={onClose} className="text-white/80 hover:text-white text-2xl leading-none">×</button>
        </div>

        <div className="flex-1 overflow-y-auto">
          <div className="flex flex-col lg:flex-row">
            {/* 左パネル - 入力 */}
            <div className="flex-1 p-4 space-y-4">
              {/* クイック生成ボタン */}
              <div>
                <label className="block text-xs font-medium text-slate-500 mb-2">ワンクリック生成</label>
                <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
                  {QUICK_PRESETS.map(preset => (
                    <button
                      key={preset.id}
                      onClick={() => handleQuickGenerate(preset)}
                      disabled={generating}
                      className="p-2 rounded-lg border border-slate-200 hover:border-violet-400 hover:bg-violet-50 transition-all text-center disabled:opacity-50"
                    >
                      <div className="text-xl">{preset.icon}</div>
                      <div className="text-xs text-slate-600 mt-1">{preset.name}</div>
                    </button>
                  ))}
                </div>
              </div>

              {/* メインプロンプト入力 */}
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  プロンプト（生成したい画像の説明）
                </label>
                <textarea
                  value={prompt}
                  onChange={(e) => setPrompt(e.target.value)}
                  placeholder="例: 夕日に照らされた富士山、雲海、フォトリアル..."
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-violet-500 h-20 resize-none text-sm"
                />
              </div>

              {/* 例示プロンプト */}
              <div>
                <label className="block text-xs font-medium text-slate-500 mb-1">プロンプト例（クリックで入力）</label>
                <div className="flex flex-wrap gap-1">
                  {EXAMPLE_PROMPTS.map((ex, i) => (
                    <button
                      key={i}
                      onClick={() => setPrompt(ex)}
                      className="text-xs px-2 py-1 bg-slate-100 text-slate-600 rounded hover:bg-violet-100 hover:text-violet-700 transition-colors"
                    >
                      {ex.slice(0, 20)}...
                    </button>
                  ))}
                </div>
              </div>

              {/* スタイル選択 */}
              <div className="flex gap-4">
                <div className="flex-1">
                  <label className="block text-xs font-medium text-slate-500 mb-1">スタイル</label>
                  <div className="flex flex-wrap gap-1">
                    {STYLES.map(style => (
                      <button
                        key={style.id}
                        onClick={() => setSelectedStyle(selectedStyle === style.id ? null : style.id)}
                        className={`px-2 py-1 text-xs rounded-full transition-all ${
                          selectedStyle === style.id
                            ? 'bg-violet-600 text-white'
                            : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                        }`}
                      >
                        {style.icon} {style.name}
                      </button>
                    ))}
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-500 mb-1">比率</label>
                  <div className="flex gap-1">
                    {RATIOS.map(ratio => (
                      <button
                        key={ratio.id}
                        onClick={() => setAspectRatio(ratio.id)}
                        className={`px-2 py-1 text-xs rounded transition-all ${
                          aspectRatio === ratio.id
                            ? 'bg-violet-600 text-white'
                            : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                        }`}
                      >
                        {ratio.icon}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {/* 詳細設定（折りたたみ） */}
              <div>
                <button
                  onClick={() => setShowAdvanced(!showAdvanced)}
                  className="text-xs text-slate-500 hover:text-violet-600 flex items-center gap-1"
                >
                  <span>{showAdvanced ? '▼' : '▶'}</span>
                  詳細設定
                </button>
                {showAdvanced && (
                  <div className="mt-2 p-3 bg-slate-50 rounded-lg space-y-2">
                    <div>
                      <label className="block text-xs text-slate-500 mb-1">除外要素（ネガティブプロンプト）</label>
                      <input
                        type="text"
                        value={negativePrompt}
                        onChange={(e) => setNegativePrompt(e.target.value)}
                        placeholder="blurry, low quality, watermark..."
                        className="w-full px-2 py-1 text-xs border border-slate-200 rounded"
                      />
                    </div>
                    <p className="text-xs text-slate-400">
                      日本語テキストを画像に入れたい場合は、プロンプトに「日本語でテキストを入れて」と明記してください。
                    </p>
                  </div>
                )}
              </div>

              {/* 生成ボタン */}
              <button
                onClick={() => handleGenerate()}
                disabled={generating || !prompt.trim()}
                className="w-full py-3 bg-gradient-to-r from-violet-600 to-pink-600 text-white font-semibold rounded-xl hover:opacity-90 disabled:opacity-50 transition-all flex items-center justify-center gap-2"
              >
                {generating ? (
                  <>
                    <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    生成中...
                  </>
                ) : (
                  <>✨ 画像を生成</>
                )}
              </button>

              {!apiKey && (
                <button
                  onClick={onOpenSettings}
                  className="w-full py-2 bg-amber-100 text-amber-700 text-sm rounded-lg hover:bg-amber-200"
                >
                  ⚠️ APIキーを設定してください
                </button>
              )}
            </div>

            {/* 右パネル - プレビュー */}
            <div className="lg:w-96 p-4 bg-slate-50 border-t lg:border-t-0 lg:border-l border-slate-200">
              {/* 生成結果 */}
              {generatedImage ? (
                <div className="space-y-3">
                  <div className="relative bg-white rounded-xl overflow-hidden border border-slate-200 shadow-sm">
                    <img src={generatedImage} alt="Generated" className="w-full h-auto" />
                    {provider && (
                      <div className="absolute bottom-2 right-2 px-2 py-0.5 bg-black/50 text-white text-xs rounded">
                        {provider}
                      </div>
                    )}
                  </div>

                  {/* アクションボタン */}
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      onClick={handleUseImage}
                      disabled={uploading}
                      className="py-2.5 bg-gradient-to-r from-violet-600 to-cyan-600 text-white font-medium rounded-lg hover:opacity-90 disabled:opacity-50 text-sm"
                    >
                      {uploading ? '...' : '✓ 投稿に使用'}
                    </button>
                    <button
                      onClick={() => setShowEditor(true)}
                      className="py-2.5 bg-gradient-to-r from-amber-500 to-orange-500 text-white font-medium rounded-lg hover:opacity-90 text-sm"
                    >
                      ✏️ 編集する
                    </button>
                    <button
                      onClick={handleDownload}
                      className="py-2 bg-slate-200 text-slate-700 rounded-lg hover:bg-slate-300 text-sm"
                    >
                      ⬇️ 保存
                    </button>
                    <button
                      onClick={() => handleGenerate()}
                      disabled={generating}
                      className="py-2 bg-violet-100 text-violet-700 rounded-lg hover:bg-violet-200 text-sm disabled:opacity-50"
                    >
                      🔄 再生成
                    </button>
                  </div>
                </div>
              ) : (
                <div className="aspect-square bg-slate-100 rounded-xl flex items-center justify-center border-2 border-dashed border-slate-300">
                  <div className="text-center text-slate-400 p-4">
                    <div className="text-5xl mb-3">🖼️</div>
                    <p className="text-sm">生成された画像が<br />ここに表示されます</p>
                    <p className="text-xs mt-2">クイック生成またはプロンプトを<br />入力して生成してください</p>
                  </div>
                </div>
              )}

              {/* エラー表示 */}
              {error && (
                <div className="mt-3 p-3 bg-red-50 border border-red-200 rounded-lg">
                  <p className="text-sm text-red-600 whitespace-pre-wrap">{error}</p>
                </div>
              )}

              {/* 履歴 */}
              {history.length > 0 && (
                <div className="mt-4">
                  <label className="block text-xs font-medium text-slate-500 mb-2">最近の生成</label>
                  <div className="grid grid-cols-5 gap-1">
                    {history.map((img, i) => (
                      <button
                        key={i}
                        onClick={() => selectFromHistory(img)}
                        className={`aspect-square rounded overflow-hidden border-2 transition-all ${
                          generatedImage === img ? 'border-violet-500' : 'border-transparent hover:border-slate-300'
                        }`}
                      >
                        <img src={img} alt="" className="w-full h-full object-cover" />
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* 外部サービスリンク */}
              <div className="mt-4 p-3 bg-white rounded-lg border border-slate-200">
                <p className="text-xs text-slate-500 mb-1">他の画像生成サービス:</p>
                <div className="flex flex-wrap gap-1">
                  {[
                    { name: 'Ideogram', url: 'https://ideogram.ai/' },
                    { name: 'Leonardo', url: 'https://leonardo.ai/' },
                    { name: 'Canva', url: 'https://www.canva.com/' },
                  ].map(s => (
                    <a
                      key={s.name}
                      href={s.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-xs px-2 py-0.5 bg-slate-100 text-slate-500 rounded hover:bg-slate-200"
                    >
                      {s.name} ↗
                    </a>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Image Editor */}
      {showEditor && generatedImage && (
        <ImageEditor
          imageUrl={generatedImage}
          onSave={(editedUrl) => {
            onImageGenerated(editedUrl);
            onClose();
          }}
          onClose={() => setShowEditor(false)}
        />
      )}
    </div>
  );
}
