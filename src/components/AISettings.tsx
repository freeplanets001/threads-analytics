'use client';

import { useState, useEffect } from 'react';

interface AISettingsProps {
  onClose: () => void;
}

// デフォルトのシステムプロンプト
const DEFAULT_SYSTEM_PROMPT = `あなたは「Threads（スレッズ）」で10万人以上のフォロワーを持つトップインフルエンサーです。
バズる投稿、高エンゲージメントを獲得する投稿の作成に長けています。

【Threadsの特徴】
- テキスト中心のSNS（最大500文字）
- カジュアルで親しみやすい雰囲気
- 共感・気づき・学びのある投稿が伸びやすい

【バズる投稿の法則】
1. フック（冒頭）: 最初の1行で「読みたい」と思わせる
   - 数字を使う：「3つの理由」「5分で」
   - 逆説・意外性：「実は〇〇は間違い」
   - 共感：「〇〇な人、いませんか？」

2. 本文: 1文は短く、箇条書きや改行を効果的に

3. 締め（CTA）:
   - 質問で終わる：「あなたはどう思いますか？」
   - 共感を求める：「同じ人いたらいいね」

4. 絵文字: 冒頭に1つ、強調部分に1-2個、末尾に1つ（計3-5個）

5. ハッシュタグ: 関連性の高いものを2-3個、末尾に配置`;

// プリセットプロンプト
const PRESET_PROMPTS = [
  {
    name: 'バズ狙い（デフォルト）',
    prompt: DEFAULT_SYSTEM_PROMPT,
  },
  {
    name: 'プロフェッショナル',
    prompt: `あなたは業界の専門家として信頼感のある投稿を作成します。

【スタイル】
- データや根拠を示す
- 専門用語は分かりやすく説明
- 読者に価値ある情報を提供

【構成】
1. 問題提起または興味を引く事実
2. 専門的な解説・分析
3. 実践的なアドバイス
4. 行動を促す締め`,
  },
  {
    name: 'カジュアル・親しみやすい',
    prompt: `友達に話すようなフレンドリーな投稿を作成します。

【スタイル】
- 「〜だよね」「〜かも」などの口語体
- 絵文字を多めに使用
- 自分の体験談を交える

【構成】
1. 共感を呼ぶ導入
2. 自分の体験や気づき
3. 読者への問いかけ`,
  },
  {
    name: '教育・学び系',
    prompt: `読者に「学び」を提供する投稿を作成します。

【スタイル】
- 「〇〇する方法」「〇〇のコツ」形式
- 箇条書きで分かりやすく
- 具体例を必ず入れる

【構成】
1. 学びのテーマを明示
2. ポイントを3-5個に絞って解説
3. 「保存してね」で締める`,
  },
  {
    name: 'ストーリーテリング',
    prompt: `物語形式で読者を引き込む投稿を作成します。

【スタイル】
- 起承転結を意識
- 感情を込めた表現
- 最後にメッセージ

【構成】
1. 「昨日こんなことがあった」的な導入
2. 出来事の描写
3. 気づき・学び
4. 読者への問いかけ`,
  },
];

export function AISettings({ onClose }: AISettingsProps) {
  const [geminiKey, setGeminiKey] = useState('');
  const [customPrompt, setCustomPrompt] = useState(DEFAULT_SYSTEM_PROMPT);
  const [tone, setTone] = useState<'engaging' | 'professional' | 'casual'>('engaging');
  const [length, setLength] = useState<'short' | 'medium' | 'long'>('medium');
  const [saved, setSaved] = useState(false);
  const [activeTab, setActiveTab] = useState<'api' | 'prompt' | 'presets'>('api');

  useEffect(() => {
    const storedKey = localStorage.getItem('gemini_api_key');
    const storedPrompt = localStorage.getItem('ai_custom_prompt');
    const storedTone = localStorage.getItem('ai_tone');
    const storedLength = localStorage.getItem('ai_length');

    if (storedKey) setGeminiKey(storedKey);
    if (storedPrompt) setCustomPrompt(storedPrompt);
    if (storedTone) setTone(storedTone as typeof tone);
    if (storedLength) setLength(storedLength as typeof length);
  }, []);

  const handleSave = () => {
    if (geminiKey.trim()) {
      localStorage.setItem('gemini_api_key', geminiKey.trim());
    } else {
      localStorage.removeItem('gemini_api_key');
    }

    localStorage.setItem('ai_custom_prompt', customPrompt);
    localStorage.setItem('ai_tone', tone);
    localStorage.setItem('ai_length', length);

    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  const handleClear = () => {
    setGeminiKey('');
    setCustomPrompt(DEFAULT_SYSTEM_PROMPT);
    setTone('engaging');
    setLength('medium');
    localStorage.removeItem('gemini_api_key');
    localStorage.removeItem('ai_custom_prompt');
    localStorage.removeItem('ai_tone');
    localStorage.removeItem('ai_length');
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  const applyPreset = (preset: typeof PRESET_PROMPTS[0]) => {
    setCustomPrompt(preset.prompt);
    setActiveTab('prompt');
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl max-w-2xl w-full max-h-[90vh] overflow-hidden flex flex-col">
        <div className="p-6 border-b border-slate-200">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-bold text-slate-900">AI設定</h2>
            <button
              onClick={onClose}
              className="text-slate-400 hover:text-slate-600 text-xl"
            >
              ×
            </button>
          </div>

          {/* Tabs */}
          <div className="flex gap-1 mt-4">
            <button
              onClick={() => setActiveTab('api')}
              className={`px-4 py-2 text-sm rounded-lg ${
                activeTab === 'api'
                  ? 'bg-violet-100 text-violet-700'
                  : 'text-slate-600 hover:bg-slate-100'
              }`}
            >
              APIキー
            </button>
            <button
              onClick={() => setActiveTab('prompt')}
              className={`px-4 py-2 text-sm rounded-lg ${
                activeTab === 'prompt'
                  ? 'bg-violet-100 text-violet-700'
                  : 'text-slate-600 hover:bg-slate-100'
              }`}
            >
              カスタムプロンプト
            </button>
            <button
              onClick={() => setActiveTab('presets')}
              className={`px-4 py-2 text-sm rounded-lg ${
                activeTab === 'presets'
                  ? 'bg-violet-100 text-violet-700'
                  : 'text-slate-600 hover:bg-slate-100'
              }`}
            >
              プリセット
            </button>
          </div>
        </div>

        <div className="p-6 space-y-4 overflow-y-auto flex-1">
          {/* API Tab */}
          {activeTab === 'api' && (
            <>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  Gemini API キー
                </label>
                <input
                  type="password"
                  value={geminiKey}
                  onChange={(e) => setGeminiKey(e.target.value)}
                  placeholder="AIza..."
                  className="w-full px-4 py-3 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-violet-500"
                />
                <p className="text-xs text-slate-500 mt-2">
                  <a
                    href="https://aistudio.google.com/apikey"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-violet-600 hover:underline"
                  >
                    Google AI Studio
                  </a>
                  でAPIキーを取得できます（無料枠あり）
                </p>
              </div>

              {/* Tone Selection */}
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  トーン
                </label>
                <div className="grid grid-cols-3 gap-2">
                  {[
                    { value: 'engaging', label: 'エンゲージ重視', desc: '共感・反応を促す' },
                    { value: 'professional', label: 'プロフェッショナル', desc: '信頼感・専門性' },
                    { value: 'casual', label: 'カジュアル', desc: '親しみやすい' },
                  ].map((option) => (
                    <button
                      key={option.value}
                      onClick={() => setTone(option.value as typeof tone)}
                      className={`p-3 rounded-lg border text-left ${
                        tone === option.value
                          ? 'border-violet-500 bg-violet-50'
                          : 'border-slate-200 hover:border-slate-300'
                      }`}
                    >
                      <p className="text-sm font-medium">{option.label}</p>
                      <p className="text-xs text-slate-500">{option.desc}</p>
                    </button>
                  ))}
                </div>
              </div>

              {/* Length Selection */}
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  文字数
                </label>
                <div className="grid grid-cols-3 gap-2">
                  {[
                    { value: 'short', label: 'ショート', desc: '50-100文字' },
                    { value: 'medium', label: 'ミディアム', desc: '150-250文字' },
                    { value: 'long', label: 'ロング', desc: '300-450文字' },
                  ].map((option) => (
                    <button
                      key={option.value}
                      onClick={() => setLength(option.value as typeof length)}
                      className={`p-3 rounded-lg border text-left ${
                        length === option.value
                          ? 'border-violet-500 bg-violet-50'
                          : 'border-slate-200 hover:border-slate-300'
                      }`}
                    >
                      <p className="text-sm font-medium">{option.label}</p>
                      <p className="text-xs text-slate-500">{option.desc}</p>
                    </button>
                  ))}
                </div>
              </div>

              <div className="bg-slate-50 rounded-lg p-4">
                <h3 className="text-sm font-medium text-slate-700 mb-2">利用可能な機能</h3>
                <ul className="text-xs text-slate-600 space-y-1">
                  <li>・ 投稿文の自動生成（<span className="font-medium text-violet-600">Gemini 2.5 Flash</span>）</li>
                  <li>・ 投稿文の改善提案</li>
                  <li>・ 画像生成（<span className="font-medium text-pink-600">Nano Banana Pro</span>）</li>
                </ul>
              </div>
            </>
          )}

          {/* Custom Prompt Tab */}
          {activeTab === 'prompt' && (
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">
                カスタムシステムプロンプト
              </label>
              <p className="text-xs text-slate-500 mb-2">
                AIがどのような投稿を生成するかを指示するプロンプトです。自由にカスタマイズできます。
              </p>
              <textarea
                value={customPrompt}
                onChange={(e) => setCustomPrompt(e.target.value)}
                className="w-full px-4 py-3 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-violet-500 h-80 font-mono text-sm resize-none"
                placeholder="システムプロンプトを入力..."
              />
              <div className="flex justify-between items-center mt-2">
                <p className="text-xs text-slate-500">
                  {customPrompt.length} 文字
                </p>
                <button
                  onClick={() => setCustomPrompt(DEFAULT_SYSTEM_PROMPT)}
                  className="text-xs text-violet-600 hover:text-violet-700"
                >
                  デフォルトに戻す
                </button>
              </div>
            </div>
          )}

          {/* Presets Tab */}
          {activeTab === 'presets' && (
            <div className="space-y-3">
              <p className="text-sm text-slate-600">
                プリセットを選択すると、カスタムプロンプトに適用されます。
              </p>
              {PRESET_PROMPTS.map((preset, index) => (
                <div
                  key={index}
                  className="p-4 border border-slate-200 rounded-lg hover:border-violet-300 cursor-pointer"
                  onClick={() => applyPreset(preset)}
                >
                  <div className="flex items-center justify-between mb-2">
                    <h3 className="font-medium text-slate-900">{preset.name}</h3>
                    <button className="text-xs text-violet-600 hover:text-violet-700">
                      適用
                    </button>
                  </div>
                  <p className="text-xs text-slate-500 line-clamp-3 font-mono">
                    {preset.prompt.substring(0, 150)}...
                  </p>
                </div>
              ))}
            </div>
          )}

          {saved && (
            <p className="text-sm text-emerald-600 bg-emerald-50 p-3 rounded-lg">
              設定を保存しました
            </p>
          )}
        </div>

        {/* Footer */}
        <div className="p-6 border-t border-slate-200 bg-slate-50">
          <div className="flex gap-3">
            <button
              onClick={handleSave}
              className="flex-1 py-3 bg-violet-600 text-white font-semibold rounded-lg hover:bg-violet-700 transition-colors"
            >
              保存
            </button>
            <button
              onClick={handleClear}
              className="px-4 py-3 bg-slate-200 text-slate-600 font-medium rounded-lg hover:bg-slate-300 transition-colors"
            >
              リセット
            </button>
          </div>
          <p className="text-xs text-slate-400 text-center mt-3">
            設定はブラウザにのみ保存されます
          </p>
        </div>
      </div>
    </div>
  );
}

// 設定を取得するヘルパー
export function getAISettings() {
  if (typeof window === 'undefined') {
    return {
      apiKey: null,
      customPrompt: null,
      tone: 'engaging',
      length: 'medium',
    };
  }

  return {
    apiKey: localStorage.getItem('gemini_api_key'),
    customPrompt: localStorage.getItem('ai_custom_prompt'),
    tone: localStorage.getItem('ai_tone') || 'engaging',
    length: localStorage.getItem('ai_length') || 'medium',
  };
}
