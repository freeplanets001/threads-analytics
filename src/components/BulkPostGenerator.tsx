'use client';

import React, { useState, useEffect } from 'react';

interface GeneratedPost {
  id: string;
  text: string;
  scheduledTime: Date | null;
  status: 'pending' | 'scheduled' | 'posted' | 'error';
}

interface BulkPostGeneratorProps {
  apiKey?: string | null;
  accessToken: string;
  onClose?: () => void;
  onOpenSettings?: () => void;
  onSchedulePost?: (post: { text: string; scheduledTime: Date }) => void;
  onPostsScheduled?: () => void;
  embedded?: boolean;
}

// テーマプリセット（SVGアイコン使用）
const THEME_PRESETS = [
  { id: 'business', name: 'ビジネス・仕事術', icon: 'briefcase', color: 'bg-blue-100 text-blue-600', prompts: ['生産性向上のコツ', 'チーム管理の秘訣', 'キャリアアップの方法'] },
  { id: 'lifestyle', name: 'ライフスタイル', icon: 'leaf', color: 'bg-green-100 text-green-600', prompts: ['朝活のメリット', '休日の過ごし方', '自己投資のアイデア'] },
  { id: 'tech', name: 'テクノロジー', icon: 'code', color: 'bg-purple-100 text-purple-600', prompts: ['AIの活用法', '最新テックトレンド', 'プログラミングTips'] },
  { id: 'health', name: '健康・フィットネス', icon: 'heart', color: 'bg-red-100 text-red-600', prompts: ['運動習慣のコツ', '健康的な食事', 'メンタルヘルス'] },
  { id: 'motivation', name: 'モチベーション', icon: 'fire', color: 'bg-orange-100 text-orange-600', prompts: ['やる気が出る考え方', '成功者の習慣', '挫折からの立ち直り'] },
  { id: 'creative', name: 'クリエイティブ', icon: 'palette', color: 'bg-pink-100 text-pink-600', prompts: ['創造性を高める方法', 'アイデア発想法', 'アート・デザイン'] },
];

// 投稿スケジュールパターン
const SCHEDULE_PATTERNS = [
  { id: 'morning', name: '朝投稿', times: [7, 8, 9], icon: 'sunrise', color: 'bg-yellow-100 text-yellow-600' },
  { id: 'lunch', name: 'ランチタイム', times: [12, 13], icon: 'sun', color: 'bg-orange-100 text-orange-600' },
  { id: 'evening', name: '夕方投稿', times: [18, 19, 20], icon: 'sunset', color: 'bg-amber-100 text-amber-600' },
  { id: 'night', name: '夜投稿', times: [21, 22, 23], icon: 'moon', color: 'bg-indigo-100 text-indigo-600' },
  { id: 'prime', name: 'ゴールデンタイム', times: [7, 12, 19, 21], icon: 'star', color: 'bg-yellow-100 text-yellow-600' },
];

// アイコンコンポーネント
function Icon({ name, className = '' }: { name: string; className?: string }) {
  const icons: Record<string, React.ReactNode> = {
    briefcase: <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 13.255A23.931 23.931 0 0112 15c-3.183 0-6.22-.62-9-1.745M16 6V4a2 2 0 00-2-2h-4a2 2 0 00-2 2v2m4 6h.01M5 20h14a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" /></svg>,
    leaf: <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z" /></svg>,
    code: <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4" /></svg>,
    heart: <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" /></svg>,
    fire: <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 18.657A8 8 0 016.343 7.343S7 9 9 10c0-2 .5-5 2.986-7C14 5 16.09 5.777 17.656 7.343A7.975 7.975 0 0120 13a7.975 7.975 0 01-2.343 5.657z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.879 16.121A3 3 0 1012.015 11L11 14H9c0 .768.293 1.536.879 2.121z" /></svg>,
    palette: <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21a4 4 0 01-4-4V5a2 2 0 012-2h4a2 2 0 012 2v12a4 4 0 01-4 4zm0 0h12a2 2 0 002-2v-4a2 2 0 00-2-2h-2.343M11 7.343l1.657-1.657a2 2 0 012.828 0l2.829 2.829a2 2 0 010 2.828l-8.486 8.485M7 17h.01" /></svg>,
    sunrise: <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" /></svg>,
    sun: <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" /></svg>,
    sunset: <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707" /></svg>,
    moon: <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" /></svg>,
    star: <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" /></svg>,
    settings: <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /></svg>,
  };
  return icons[name] || null;
}

export function BulkPostGenerator({
  apiKey: initialApiKey,
  accessToken,
  onClose,
  onOpenSettings,
  onSchedulePost,
  onPostsScheduled,
  embedded = false
}: BulkPostGeneratorProps) {
  const [step, setStep] = useState<'config' | 'generating' | 'review' | 'scheduling'>('config');

  // API設定
  const [localApiKey, setLocalApiKey] = useState<string>('');
  const [showApiKeyInput, setShowApiKeyInput] = useState(false);

  // localStorage からAPIキーを読み込み
  useEffect(() => {
    const savedKey = localStorage.getItem('gemini_api_key');
    if (savedKey) {
      setLocalApiKey(savedKey);
    }
  }, []);

  const effectiveApiKey = initialApiKey || localApiKey;

  const saveApiKey = () => {
    if (localApiKey.trim()) {
      localStorage.setItem('gemini_api_key', localApiKey.trim());
      setShowApiKeyInput(false);
    }
  };

  // 設定
  const [selectedTheme, setSelectedTheme] = useState<string | null>(null);
  const [customTopic, setCustomTopic] = useState('');
  const [postCount, setPostCount] = useState(5);
  const [toneStyle, setToneStyle] = useState<'casual' | 'professional' | 'inspirational' | 'humorous'>('casual');
  const [includeEmoji, setIncludeEmoji] = useState(true);
  const [includeHashtags, setIncludeHashtags] = useState(true);
  const [maxLength, setMaxLength] = useState(280);

  // 生成結果
  const [generatedPosts, setGeneratedPosts] = useState<GeneratedPost[]>([]);
  const [generating, setGenerating] = useState(false);
  const [currentGenerating, setCurrentGenerating] = useState(0);
  const [error, setError] = useState<string | null>(null);

  // スケジューリング
  const [schedulePattern, setSchedulePattern] = useState<string>('prime');
  const [startDate, setStartDate] = useState(new Date().toISOString().split('T')[0]);
  const [spreadDays, setSpreadDays] = useState(7);

  // 一括生成
  const handleGenerate = async () => {
    if (!effectiveApiKey) {
      setShowApiKeyInput(true);
      setError('Gemini APIキーを入力してください。');
      return;
    }

    const topic = customTopic || (selectedTheme ? THEME_PRESETS.find(t => t.id === selectedTheme)?.prompts.join('、') : '');
    if (!topic) {
      setError('テーマまたはカスタムトピックを入力してください');
      return;
    }

    setStep('generating');
    setGenerating(true);
    setError(null);
    setGeneratedPosts([]);

    const toneDescriptions = {
      casual: 'カジュアルで親しみやすい、話しかけるような',
      professional: 'プロフェッショナルで知的な、信頼感のある',
      inspirational: '前向きで励みになる、モチベーションを高める',
      humorous: 'ユーモアがあって面白い、クスッと笑える',
    };

    try {
      const posts: GeneratedPost[] = [];

      for (let i = 0; i < postCount; i++) {
        setCurrentGenerating(i + 1);

        const prompt = `
以下の条件でThreads用の投稿を1つ生成してください：

トピック: ${topic}
トーン: ${toneDescriptions[toneStyle]}
${includeEmoji ? '絵文字を適度に使用' : '絵文字は使用しない'}
${includeHashtags ? '関連ハッシュタグを2-3個含める' : 'ハッシュタグは含めない'}
文字数: ${maxLength}文字以内

重要ルール:
- マークダウン記号（###、**、*など）は絶対に使用しない
- 改行は1-2回まで
- 投稿番号${i + 1}/${postCount}として、他の投稿と内容が被らないようにする
- 読者が共感・反応したくなる内容にする
- 冒頭で興味を引く

投稿テキストのみを出力（説明や番号は不要）:`;

        const res = await fetch('/api/ai/generate', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            type: 'text',
            prompt,
            options: { maxLength, tone: toneStyle },
            apiKey: effectiveApiKey,
          }),
        });

        const data = await res.json();

        if (res.ok && data.text) {
          posts.push({
            id: Date.now().toString() + i,
            text: data.text,
            scheduledTime: null,
            status: 'pending',
          });
        } else {
          posts.push({
            id: Date.now().toString() + i,
            text: `生成失敗: ${data.error || '不明なエラー'}`,
            scheduledTime: null,
            status: 'error',
          });
        }

        // レート制限対策
        await new Promise(r => setTimeout(r, 1000));
      }

      setGeneratedPosts(posts);
      setStep('review');
    } catch (err) {
      setError(err instanceof Error ? err.message : '生成に失敗しました');
    } finally {
      setGenerating(false);
      setCurrentGenerating(0);
    }
  };

  // 投稿を編集
  const updatePostText = (id: string, text: string) => {
    setGeneratedPosts(posts =>
      posts.map(p => p.id === id ? { ...p, text } : p)
    );
  };

  // 投稿を削除
  const removePost = (id: string) => {
    setGeneratedPosts(posts => posts.filter(p => p.id !== id));
  };

  // スケジュール計算
  const calculateSchedule = () => {
    const pattern = SCHEDULE_PATTERNS.find(p => p.id === schedulePattern);
    if (!pattern) return;

    const start = new Date(startDate);
    const updatedPosts = generatedPosts.map((post, index) => {
      if (post.status === 'error') return post;

      const dayOffset = Math.floor(index / pattern.times.length) % spreadDays;
      const timeIndex = index % pattern.times.length;
      const hour = pattern.times[timeIndex];

      const scheduledTime = new Date(start);
      scheduledTime.setDate(scheduledTime.getDate() + dayOffset);
      scheduledTime.setHours(hour, Math.floor(Math.random() * 30), 0, 0);

      return { ...post, scheduledTime, status: 'scheduled' as const };
    });

    setGeneratedPosts(updatedPosts);
  };

  // スケジュール投稿を実行
  const handleScheduleAll = async () => {
    const scheduledPosts = generatedPosts.filter(p => p.status === 'scheduled' && p.scheduledTime);

    for (const post of scheduledPosts) {
      if (post.scheduledTime && onSchedulePost) {
        onSchedulePost({ text: post.text, scheduledTime: post.scheduledTime });
      }
    }

    // 完了コールバック
    if (onPostsScheduled) {
      onPostsScheduled();
    }
    if (onClose) {
      onClose();
    } else {
      // 埋め込みモードの場合はリセット
      setStep('config');
      setGeneratedPosts([]);
      setSelectedTheme(null);
      setCustomTopic('');
    }
  };

  // 即時投稿
  const handlePostNow = async (post: GeneratedPost) => {
    try {
      const res = await fetch('/api/threads/post', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${accessToken}`,
        },
        body: JSON.stringify({ type: 'text', text: post.text }),
      });

      if (res.ok) {
        setGeneratedPosts(posts =>
          posts.map(p => p.id === post.id ? { ...p, status: 'posted' as const } : p)
        );
      } else {
        const data = await res.json();
        throw new Error(data.error);
      }
    } catch (err) {
      alert(err instanceof Error ? err.message : '投稿に失敗しました');
    }
  };

  const containerClass = embedded
    ? "bg-white rounded-2xl w-full overflow-hidden flex flex-col shadow-xl border border-slate-200"
    : "fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4";

  const innerClass = embedded
    ? ""
    : "bg-white rounded-2xl w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col shadow-2xl";

  const content = (
    <>
      {/* ヘッダー */}
      <div className="px-6 py-4 bg-gradient-to-r from-indigo-600 to-purple-600 text-white">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-xl font-bold flex items-center gap-2">
              AI一括投稿ジェネレーター
            </h2>
            <p className="text-sm text-white/70 mt-0.5">
              {step === 'config' && 'テーマを選んで一括生成'}
              {step === 'generating' && `生成中... ${currentGenerating}/${postCount}`}
              {step === 'review' && '生成結果を確認・編集'}
              {step === 'scheduling' && 'スケジュールを設定'}
            </p>
          </div>
          {onClose && (
            <button onClick={onClose} className="text-white/80 hover:text-white text-2xl">×</button>
          )}
        </div>

          {/* ステップインジケーター */}
          <div className="flex items-center gap-2 mt-4">
            {['設定', '生成', '確認', 'スケジュール'].map((label, i) => {
              const stepIndex = ['config', 'generating', 'review', 'scheduling'].indexOf(step);
              const isActive = i <= stepIndex;
              return (
                <div key={label} className="flex items-center gap-2">
                  <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${isActive ? 'bg-white text-indigo-600' : 'bg-white/30 text-white/70'}`}>
                    {i + 1}
                  </div>
                  <span className={`text-xs ${isActive ? 'text-white' : 'text-white/50'}`}>{label}</span>
                  {i < 3 && <div className={`w-8 h-0.5 ${isActive ? 'bg-white/50' : 'bg-white/20'}`} />}
                </div>
              );
            })}
          </div>
        </div>

        {/* コンテンツ */}
        <div className="flex-1 overflow-y-auto p-6">
          {/* API設定セクション */}
          {(showApiKeyInput || !effectiveApiKey) && step === 'config' && (
            <div className="mb-6 p-4 bg-amber-50 border border-amber-200 rounded-xl">
              <div className="flex items-center gap-2 mb-3">
                <Icon name="settings" className="w-5 h-5 text-amber-600" />
                <h3 className="font-medium text-amber-800">API設定</h3>
              </div>
              <p className="text-sm text-amber-700 mb-3">
                AI一括生成にはGemini APIキーが必要です。
                <a href="https://aistudio.google.com/app/apikey" target="_blank" rel="noopener noreferrer" className="underline ml-1">
                  Google AI Studioで取得
                </a>
              </p>
              <div className="flex gap-2">
                <input
                  type="password"
                  value={localApiKey}
                  onChange={(e) => setLocalApiKey(e.target.value)}
                  placeholder="AIza..."
                  className="flex-1 px-3 py-2 border border-amber-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500 text-sm"
                />
                <button
                  onClick={saveApiKey}
                  disabled={!localApiKey.trim()}
                  className="px-4 py-2 bg-amber-600 text-white rounded-lg hover:bg-amber-700 disabled:opacity-50 text-sm font-medium"
                >
                  保存
                </button>
              </div>
              {effectiveApiKey && (
                <p className="text-xs text-green-600 mt-2">APIキーが設定されています</p>
              )}
            </div>
          )}

          {/* 設定ステップ */}
          {step === 'config' && (
            <div className="space-y-6">
              {/* テーマ選択 */}
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">テーマを選択</label>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                  {THEME_PRESETS.map(theme => (
                    <button
                      key={theme.id}
                      onClick={() => { setSelectedTheme(theme.id); setCustomTopic(''); }}
                      className={`p-4 rounded-xl border-2 text-left transition-all ${
                        selectedTheme === theme.id
                          ? 'border-indigo-500 bg-indigo-50'
                          : 'border-slate-200 hover:border-slate-300'
                      }`}
                    >
                      <div className={`w-10 h-10 rounded-lg flex items-center justify-center mb-2 ${theme.color}`}>
                        <Icon name={theme.icon} className="w-5 h-5" />
                      </div>
                      <div className="font-medium text-slate-900">{theme.name}</div>
                      <div className="text-xs text-slate-500 mt-1">{theme.prompts[0]}...</div>
                    </button>
                  ))}
                </div>
              </div>

              {/* カスタムトピック */}
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  または、カスタムトピックを入力
                </label>
                <input
                  type="text"
                  value={customTopic}
                  onChange={(e) => { setCustomTopic(e.target.value); setSelectedTheme(null); }}
                  placeholder="例: プログラミング学習のコツ、副業のアイデア、etc."
                  className="w-full px-4 py-3 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              {/* 詳細設定 */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                <div>
                  <label className="block text-xs text-slate-500 mb-1">投稿数</label>
                  <select
                    value={postCount}
                    onChange={(e) => setPostCount(Number(e.target.value))}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg"
                  >
                    {[3, 5, 7, 10, 14, 21, 30].map(n => (
                      <option key={n} value={n}>{n}件</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs text-slate-500 mb-1">トーン</label>
                  <select
                    value={toneStyle}
                    onChange={(e) => setToneStyle(e.target.value as typeof toneStyle)}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg"
                  >
                    <option value="casual">カジュアル</option>
                    <option value="professional">プロフェッショナル</option>
                    <option value="inspirational">モチベーション</option>
                    <option value="humorous">ユーモア</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs text-slate-500 mb-1">最大文字数</label>
                  <select
                    value={maxLength}
                    onChange={(e) => setMaxLength(Number(e.target.value))}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg"
                  >
                    <option value={140}>140文字</option>
                    <option value={280}>280文字</option>
                    <option value={500}>500文字</option>
                  </select>
                </div>
                <div className="space-y-2">
                  <label className="flex items-center gap-2 text-xs">
                    <input type="checkbox" checked={includeEmoji} onChange={(e) => setIncludeEmoji(e.target.checked)} />
                    絵文字を含める
                  </label>
                  <label className="flex items-center gap-2 text-xs">
                    <input type="checkbox" checked={includeHashtags} onChange={(e) => setIncludeHashtags(e.target.checked)} />
                    ハッシュタグ
                  </label>
                </div>
              </div>

              {error && (
                <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-600">{error}</div>
              )}
            </div>
          )}

          {/* 生成中 */}
          {step === 'generating' && (
            <div className="flex flex-col items-center justify-center py-16">
              <div className="w-16 h-16 border-4 border-indigo-200 border-t-indigo-600 rounded-full animate-spin mb-4" />
              <p className="text-lg font-medium text-slate-900">投稿を生成中...</p>
              <p className="text-slate-500 mt-1">{currentGenerating} / {postCount} 件</p>
              <div className="w-64 h-2 bg-slate-200 rounded-full mt-4 overflow-hidden">
                <div
                  className="h-full bg-indigo-600 transition-all duration-300"
                  style={{ width: `${(currentGenerating / postCount) * 100}%` }}
                />
              </div>
            </div>
          )}

          {/* 確認ステップ */}
          {step === 'review' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <p className="text-sm text-slate-500">生成された投稿を確認・編集してください</p>
                <span className="text-sm text-slate-500">
                  {generatedPosts.filter(p => p.status !== 'error').length}件生成成功
                </span>
              </div>

              {generatedPosts.map((post, index) => (
                <div
                  key={post.id}
                  className={`p-4 rounded-xl border ${
                    post.status === 'error' ? 'border-red-200 bg-red-50' :
                    post.status === 'posted' ? 'border-green-200 bg-green-50' :
                    'border-slate-200'
                  }`}
                >
                  <div className="flex items-start gap-3">
                    <div className="w-8 h-8 rounded-full bg-indigo-100 text-indigo-600 flex items-center justify-center font-bold text-sm">
                      {index + 1}
                    </div>
                    <div className="flex-1">
                      {post.status === 'error' ? (
                        <p className="text-red-600 text-sm">{post.text}</p>
                      ) : post.status === 'posted' ? (
                        <div>
                          <p className="text-slate-900">{post.text}</p>
                          <p className="text-green-600 text-xs mt-2">✓ 投稿済み</p>
                        </div>
                      ) : (
                        <textarea
                          value={post.text}
                          onChange={(e) => updatePostText(post.id, e.target.value)}
                          className="w-full px-0 py-0 border-0 focus:outline-none focus:ring-0 resize-none bg-transparent"
                          rows={3}
                        />
                      )}
                    </div>
                    <div className="flex items-center gap-1">
                      {post.status === 'pending' && (
                        <>
                          <button
                            onClick={() => handlePostNow(post)}
                            className="px-2 py-1 text-xs bg-indigo-100 text-indigo-700 rounded hover:bg-indigo-200"
                          >
                            今すぐ投稿
                          </button>
                          <button
                            onClick={() => removePost(post.id)}
                            className="p-1 text-slate-400 hover:text-red-500"
                          >
                            ×
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                  <div className="mt-2 flex items-center justify-between text-xs text-slate-400">
                    <span>{post.text.length}文字</span>
                    {post.scheduledTime && (
                      <span className="text-indigo-600">
                        📅 {post.scheduledTime.toLocaleString('ja-JP')}
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* スケジューリングステップ */}
          {step === 'scheduling' && (
            <div className="space-y-6">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">投稿パターン</label>
                  <div className="space-y-2">
                    {SCHEDULE_PATTERNS.map(pattern => (
                      <button
                        key={pattern.id}
                        onClick={() => setSchedulePattern(pattern.id)}
                        className={`w-full p-3 rounded-lg text-left transition-all flex items-center ${
                          schedulePattern === pattern.id
                            ? 'bg-indigo-100 border-2 border-indigo-500'
                            : 'bg-slate-50 border-2 border-transparent hover:border-slate-200'
                        }`}
                      >
                        <div className={`w-8 h-8 rounded-lg flex items-center justify-center mr-3 ${pattern.color}`}>
                          <Icon name={pattern.icon} className="w-4 h-4" />
                        </div>
                        <span className="font-medium">{pattern.name}</span>
                        <span className="text-xs text-slate-500 ml-2">
                          ({pattern.times.map(t => `${t}時`).join(', ')})
                        </span>
                      </button>
                    ))}
                  </div>
                </div>

                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-2">開始日</label>
                    <input
                      type="date"
                      value={startDate}
                      onChange={(e) => setStartDate(e.target.value)}
                      min={new Date().toISOString().split('T')[0]}
                      className="w-full px-3 py-2 border border-slate-200 rounded-lg"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-2">何日間に分散</label>
                    <select
                      value={spreadDays}
                      onChange={(e) => setSpreadDays(Number(e.target.value))}
                      className="w-full px-3 py-2 border border-slate-200 rounded-lg"
                    >
                      <option value={1}>1日（同日に全て）</option>
                      <option value={3}>3日間</option>
                      <option value={7}>1週間</option>
                      <option value={14}>2週間</option>
                      <option value={30}>1ヶ月</option>
                    </select>
                  </div>
                  <button
                    onClick={calculateSchedule}
                    className="w-full py-2 bg-slate-100 text-slate-700 rounded-lg hover:bg-slate-200"
                  >
                    🗓️ スケジュールを計算
                  </button>
                </div>
              </div>

              {/* スケジュールプレビュー */}
              {generatedPosts.some(p => p.scheduledTime) && (
                <div className="mt-4 p-4 bg-slate-50 rounded-xl">
                  <h4 className="font-medium text-slate-900 mb-3">スケジュールプレビュー</h4>
                  <div className="space-y-2 max-h-48 overflow-y-auto">
                    {generatedPosts
                      .filter(p => p.scheduledTime)
                      .sort((a, b) => (a.scheduledTime?.getTime() || 0) - (b.scheduledTime?.getTime() || 0))
                      .map((post, i) => (
                        <div key={post.id} className="flex items-center gap-3 text-sm">
                          <span className="w-6 h-6 rounded-full bg-indigo-100 text-indigo-600 flex items-center justify-center text-xs font-bold">
                            {i + 1}
                          </span>
                          <span className="text-slate-500 w-36">
                            {post.scheduledTime?.toLocaleString('ja-JP', {
                              month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit'
                            })}
                          </span>
                          <span className="flex-1 truncate text-slate-700">{post.text.slice(0, 40)}...</span>
                        </div>
                      ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* フッター */}
        <div className="px-6 py-4 border-t border-slate-200 flex items-center justify-between bg-slate-50">
          {step === 'config' && (
            <>
              <div />
              <button
                onClick={handleGenerate}
                disabled={!selectedTheme && !customTopic}
                className="px-6 py-2.5 bg-indigo-600 text-white rounded-xl font-medium hover:bg-indigo-700 disabled:opacity-50"
              >
                🚀 {postCount}件を一括生成
              </button>
            </>
          )}

          {step === 'review' && (
            <>
              <button
                onClick={() => setStep('config')}
                className="px-4 py-2 text-slate-600 hover:text-slate-900"
              >
                ← 設定に戻る
              </button>
              <button
                onClick={() => setStep('scheduling')}
                disabled={generatedPosts.filter(p => p.status === 'pending').length === 0}
                className="px-6 py-2.5 bg-indigo-600 text-white rounded-xl font-medium hover:bg-indigo-700 disabled:opacity-50"
              >
                スケジュール設定へ →
              </button>
            </>
          )}

          {step === 'scheduling' && (
            <>
              <button
                onClick={() => setStep('review')}
                className="px-4 py-2 text-slate-600 hover:text-slate-900"
              >
                ← 確認に戻る
              </button>
              <button
                onClick={handleScheduleAll}
                disabled={!generatedPosts.some(p => p.scheduledTime)}
                className="px-6 py-2.5 bg-gradient-to-r from-indigo-600 to-purple-600 text-white rounded-xl font-medium hover:opacity-90 disabled:opacity-50"
              >
                スケジュール投稿を登録
              </button>
            </>
          )}
        </div>
      </>
    );

  // 埋め込みモードの場合はそのまま返す
  if (embedded) {
    return (
      <div className={containerClass}>
        {content}
      </div>
    );
  }

  // モーダルモードの場合
  return (
    <div className={containerClass}>
      <div className={innerClass}>
        {content}
      </div>
    </div>
  );
}
