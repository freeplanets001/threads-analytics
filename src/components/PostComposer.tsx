'use client';

import { useState, useEffect, useRef } from 'react';
import { AISettings, getAISettings } from './AISettings';
import { ImageUpload } from './ImageUpload';
import { MediaUpload } from './MediaUpload';
import { ImageGenerator } from './ImageGenerator';

interface PostComposerProps {
  accessToken: string;
  accountId?: string;
  onPostSuccess?: () => void;
  initialText?: string;
  onInitialTextUsed?: () => void;
}

type PostType = 'text' | 'image' | 'video' | 'carousel' | 'thread';

interface ThreadPost {
  text: string;
  imageUrl?: string;
  videoUrl?: string;
}

export function PostComposer({ accessToken, accountId, onPostSuccess, initialText, onInitialTextUsed }: PostComposerProps) {
  const [postType, setPostType] = useState<PostType>('text');
  const [text, setText] = useState(initialText || '');
  const [imageUrl, setImageUrl] = useState('');
  const [videoUrl, setVideoUrl] = useState('');
  const [carouselItems, setCarouselItems] = useState<Array<{ type: 'IMAGE' | 'VIDEO'; url: string }>>([]);
  const [threadPosts, setThreadPosts] = useState<ThreadPost[]>([{ text: '' }]);

  const [posting, setPosting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  // AI生成
  const [generating, setGenerating] = useState(false);
  const [aiPrompt, setAiPrompt] = useState('');
  const [aiContext, setAiContext] = useState('');
  const [aiPostType, setAiPostType] = useState<'auto' | 'tips' | 'story' | 'opinion' | 'announcement' | 'question'>('auto');
  const [showAiPanel, setShowAiPanel] = useState(false);
  const [showAiSettings, setShowAiSettings] = useState(false);
  const [geminiApiKey, setGeminiApiKey] = useState<string | null>(null);

  // 予約投稿
  const [showSchedulePicker, setShowSchedulePicker] = useState(false);
  const [scheduleDate, setScheduleDate] = useState('');
  const [scheduleTime, setScheduleTime] = useState('');
  const [scheduling, setScheduling] = useState(false);
  const [scheduleSuccess, setScheduleSuccess] = useState(false);

  // 画像生成モーダル
  const [showImageGenerator, setShowImageGenerator] = useState(false);

  // テキストエリアの高さ
  const [textareaHeight, setTextareaHeight] = useState<'compact' | 'normal' | 'large' | 'full'>('normal');
  const heightMap = {
    compact: 'h-20',
    normal: 'h-32',
    large: 'h-48',
    full: 'h-64',
  };

  const charCount = text.length;
  const maxChars = 500;

  // APIキーの読み込み
  useEffect(() => {
    const key = localStorage.getItem('gemini_api_key');
    setGeminiApiKey(key);
  }, [showAiSettings]);

  // コールバックをrefに保存（依存配列に入れないため）
  const onInitialTextUsedRef = useRef(onInitialTextUsed);
  useEffect(() => {
    onInitialTextUsedRef.current = onInitialTextUsed;
  }, [onInitialTextUsed]);

  // 初期テキストが渡された場合にセット
  useEffect(() => {
    if (initialText && initialText.length > 0) {
      setText(initialText);
      // コールバックを呼んで親のstateをクリア
      if (onInitialTextUsedRef.current) {
        onInitialTextUsedRef.current();
      }
    }
  }, [initialText]);

  const handlePost = async () => {
    setPosting(true);
    setError(null);
    setSuccess(false);

    try {
      const body: Record<string, unknown> = { type: postType };

      if (postType === 'text') {
        body.text = text;
      } else if (postType === 'image') {
        body.imageUrl = imageUrl;
        body.text = text || undefined;
      } else if (postType === 'video') {
        body.videoUrl = videoUrl;
        body.text = text || undefined;
      } else if (postType === 'carousel') {
        body.carouselItems = carouselItems;
        body.text = text || undefined;
      } else if (postType === 'thread') {
        body.threadPosts = threadPosts;
      }

      const res = await fetch('/api/threads/post', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify(body),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || '投稿に失敗しました');
      } else {
        setSuccess(true);
        setText('');
        setImageUrl('');
        setVideoUrl('');
        setCarouselItems([]);
        setThreadPosts([{ text: '' }]);
        onPostSuccess?.();
      }
    } catch {
      setError('投稿に失敗しました');
    } finally {
      setPosting(false);
    }
  };

  const handleSchedule = async () => {
    if (!scheduleDate || !scheduleTime || !accountId) return;

    const scheduledAt = new Date(`${scheduleDate}T${scheduleTime}`);
    if (scheduledAt <= new Date()) {
      setError('未来の日時を指定してください');
      return;
    }

    setScheduling(true);
    setError(null);
    setScheduleSuccess(false);
    setSuccess(false);

    try {
      const body: Record<string, unknown> = {
        accountId,
        type: postType,
        scheduledAt: scheduledAt.toISOString(),
      };

      if (postType === 'thread') {
        body.threadPosts = threadPosts;
      } else {
        if (text) body.text = text;
        if (postType === 'image' && imageUrl) {
          body.mediaUrls = [imageUrl];
        } else if (postType === 'video' && videoUrl) {
          body.mediaUrls = [videoUrl];
        } else if (postType === 'carousel') {
          body.mediaUrls = carouselItems.map(item => item.url);
        }
      }

      const res = await fetch('/api/scheduled', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || '予約に失敗しました');
      } else {
        setScheduleSuccess(true);
        setText('');
        setImageUrl('');
        setVideoUrl('');
        setCarouselItems([]);
        setThreadPosts([{ text: '' }]);
        setShowSchedulePicker(false);
        setScheduleDate('');
        setScheduleTime('');
        onPostSuccess?.();
      }
    } catch {
      setError('予約に失敗しました');
    } finally {
      setScheduling(false);
    }
  };

  const handleAiGenerate = async () => {
    if (!aiPrompt.trim()) return;
    if (!geminiApiKey) {
      setShowAiSettings(true);
      return;
    }

    setGenerating(true);
    setError(null);

    try {
      // カスタム設定を取得
      const settings = getAISettings();

      const res = await fetch('/api/ai/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'text',
          prompt: aiPrompt,
          context: aiContext,
          postType: aiPostType,
          options: {
            tone: settings.tone,
            length: settings.length,
            customPrompt: settings.customPrompt,
          },
          apiKey: geminiApiKey,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || 'AI生成に失敗しました');
      } else {
        setText(data.text);
        setShowAiPanel(false);
        setAiPrompt('');
        setAiContext('');
      }
    } catch {
      setError('AI生成に失敗しました');
    } finally {
      setGenerating(false);
    }
  };

  const handleAiImprove = async () => {
    if (!text.trim()) return;
    if (!geminiApiKey) {
      setShowAiSettings(true);
      return;
    }

    setGenerating(true);
    setError(null);

    try {
      const res = await fetch('/api/ai/generate', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text,
          targetMetric: 'engagement',
          apiKey: geminiApiKey,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || '改善提案の取得に失敗しました');
      } else {
        // 改善後の投稿文を抽出
        const lines = data.suggestion.split('\n');
        const improvedIndex = lines.findIndex((l: string) => l.includes('改善後'));
        if (improvedIndex !== -1 && lines[improvedIndex + 1]) {
          setText(lines.slice(improvedIndex + 1).join('\n').trim());
        }
      }
    } catch {
      setError('改善提案の取得に失敗しました');
    } finally {
      setGenerating(false);
    }
  };

  // AI生成画像が完成した時のハンドラー
  const handleImageGenerated = (url: string) => {
    setPostType('image');
    setImageUrl(url);
  };

  const addCarouselItem = (type: 'IMAGE' | 'VIDEO') => {
    setCarouselItems([...carouselItems, { type, url: '' }]);
  };

  const updateCarouselItem = (index: number, url: string) => {
    const newItems = [...carouselItems];
    newItems[index].url = url;
    setCarouselItems(newItems);
  };

  const removeCarouselItem = (index: number) => {
    setCarouselItems(carouselItems.filter((_, i) => i !== index));
  };

  const addThreadPost = () => {
    setThreadPosts([...threadPosts, { text: '' }]);
  };

  const updateThreadPost = (index: number, post: ThreadPost) => {
    const newPosts = [...threadPosts];
    newPosts[index] = post;
    setThreadPosts(newPosts);
  };

  const removeThreadPost = (index: number) => {
    if (threadPosts.length > 1) {
      setThreadPosts(threadPosts.filter((_, i) => i !== index));
    }
  };

  return (
    <div className="bg-white rounded-xl border border-slate-200 p-6">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-semibold text-slate-900">新規投稿</h2>
        <button
          onClick={() => setShowAiSettings(true)}
          className={`px-3 py-1.5 text-xs rounded-lg transition-colors ${
            geminiApiKey
              ? 'bg-emerald-100 text-emerald-700'
              : 'bg-amber-100 text-amber-700'
          }`}
        >
          {geminiApiKey ? 'AI設定済み' : 'AI設定'}
        </button>
      </div>

      {/* AI Settings Modal */}
      {showAiSettings && (
        <AISettings onClose={() => setShowAiSettings(false)} />
      )}

      {/* Post Type Selector */}
      <div className="flex flex-wrap gap-2 mb-4">
        {(['text', 'image', 'video', 'carousel', 'thread'] as PostType[]).map((type) => (
          <button
            key={type}
            onClick={() => setPostType(type)}
            className={`px-3 py-1.5 text-sm rounded-lg transition-colors ${
              postType === type
                ? 'bg-violet-100 text-violet-700'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
          >
            {type === 'text' && 'テキスト'}
            {type === 'image' && '画像'}
            {type === 'video' && '動画'}
            {type === 'carousel' && 'カルーセル'}
            {type === 'thread' && 'スレッド'}
          </button>
        ))}
      </div>

      {/* Text Input (for text, image, video, carousel) */}
      {postType !== 'thread' && (
        <div className="mb-4">
          <div className="flex items-center justify-between mb-1">
            <label className="text-sm font-medium text-slate-700">
              テキスト {postType !== 'text' && '（任意）'}
            </label>
            <div className="flex items-center gap-2">
              {/* 高さ調整ボタン */}
              <div className="flex items-center gap-1 bg-slate-100 rounded-lg p-0.5">
                {[
                  { key: 'compact', icon: '▭', title: 'コンパクト' },
                  { key: 'normal', icon: '▬', title: '標準' },
                  { key: 'large', icon: '▮', title: '大きめ' },
                  { key: 'full', icon: '█', title: '最大' },
                ].map((size) => (
                  <button
                    key={size.key}
                    onClick={() => setTextareaHeight(size.key as typeof textareaHeight)}
                    title={size.title}
                    className={`px-1.5 py-0.5 text-xs rounded transition-colors ${
                      textareaHeight === size.key
                        ? 'bg-violet-500 text-white'
                        : 'text-slate-500 hover:bg-slate-200'
                    }`}
                  >
                    {size.icon}
                  </button>
                ))}
              </div>
              <span className={`text-xs ${charCount > maxChars ? 'text-red-500' : 'text-slate-500'}`}>
                {charCount}/{maxChars}
              </span>
            </div>
          </div>
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="何を投稿しますか？"
            className={`w-full px-4 py-3 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-violet-500 ${heightMap[textareaHeight]} resize-y transition-all`}
          />

          {/* AI Buttons */}
          <div className="flex gap-2 mt-2">
            <button
              onClick={() => setShowAiPanel(!showAiPanel)}
              className="px-3 py-1.5 text-xs bg-gradient-to-r from-violet-500 to-cyan-500 text-white rounded-lg hover:opacity-90"
            >
              AI生成
            </button>
            {text && (
              <button
                onClick={handleAiImprove}
                disabled={generating}
                className="px-3 py-1.5 text-xs bg-emerald-500 text-white rounded-lg hover:bg-emerald-600 disabled:opacity-50"
              >
                {generating ? '処理中...' : 'AIで改善'}
              </button>
            )}
            <button
              onClick={() => setShowImageGenerator(true)}
              className="px-3 py-1.5 text-xs bg-gradient-to-r from-pink-500 via-purple-500 to-cyan-500 text-white rounded-lg hover:opacity-90"
            >
              AI画像生成スタジオ
            </button>
          </div>

          {/* AI Generation Panel */}
          {showAiPanel && (
            <div className="mt-3 p-4 bg-gradient-to-br from-violet-50 to-cyan-50 rounded-lg border border-violet-200">
              <div className="space-y-3">
                {/* テーマ入力 */}
                <div>
                  <label className="text-sm font-medium text-slate-700 block mb-1">
                    テーマ・キーワード *
                  </label>
                  <input
                    type="text"
                    value={aiPrompt}
                    onChange={(e) => setAiPrompt(e.target.value)}
                    placeholder="例: AntiGravity、プログラミング学習、朝活..."
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm"
                  />
                </div>

                {/* 追加の説明・文脈 */}
                <div>
                  <label className="text-sm font-medium text-slate-700 block mb-1">
                    追加の説明・文脈（任意）
                  </label>
                  <textarea
                    value={aiContext}
                    onChange={(e) => setAiContext(e.target.value)}
                    placeholder="例: AntiGravityは新しいフィットネスジムの名前です。空中ヨガやトランポリンエクササイズが特徴..."
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm h-20 resize-none"
                  />
                  <p className="text-xs text-slate-500 mt-1">
                    テーマについての詳細を書くと、より適切な投稿が生成されます
                  </p>
                </div>

                {/* 投稿タイプ選択 */}
                <div>
                  <label className="text-sm font-medium text-slate-700 block mb-1">
                    投稿タイプ
                  </label>
                  <div className="flex flex-wrap gap-2">
                    {[
                      { value: 'auto', label: '自動' },
                      { value: 'tips', label: 'Tips・ノウハウ' },
                      { value: 'story', label: '体験談・ストーリー' },
                      { value: 'opinion', label: '意見・考察' },
                      { value: 'announcement', label: '告知・紹介' },
                      { value: 'question', label: '質問・問いかけ' },
                    ].map((type) => (
                      <button
                        key={type.value}
                        type="button"
                        onClick={() => setAiPostType(type.value as typeof aiPostType)}
                        className={`px-3 py-1 text-xs rounded-full transition-colors ${
                          aiPostType === type.value
                            ? 'bg-violet-600 text-white'
                            : 'bg-white text-slate-600 border border-slate-200 hover:border-violet-300'
                        }`}
                      >
                        {type.label}
                      </button>
                    ))}
                  </div>
                </div>

                <button
                  onClick={handleAiGenerate}
                  disabled={generating || !aiPrompt.trim()}
                  className="w-full mt-2 px-4 py-2.5 text-sm bg-gradient-to-r from-violet-600 to-cyan-600 text-white rounded-lg hover:opacity-90 disabled:opacity-50 font-medium"
                >
                  {generating ? '生成中...' : 'AIで投稿を生成'}
                </button>

                {!geminiApiKey && (
                  <p className="text-xs text-amber-600 text-center">
                    「AI設定」からAPIキーを設定してください
                  </p>
                )}
              </div>
            </div>
          )}

          {/* Image Generator Modal */}
          {showImageGenerator && (
            <ImageGenerator
              apiKey={geminiApiKey}
              onImageGenerated={handleImageGenerated}
              onClose={() => setShowImageGenerator(false)}
              onOpenSettings={() => setShowAiSettings(true)}
            />
          )}
        </div>
      )}

      {/* Image URL Input */}
      {postType === 'image' && (
        <div className="mb-4">
          <label className="text-sm font-medium text-slate-700 block mb-2">
            画像 *
          </label>
          <ImageUpload
            onUpload={(url) => setImageUrl(url)}
            currentUrl={imageUrl}
            onRemove={() => setImageUrl('')}
          />
          {imageUrl && (
            <p className="text-xs text-emerald-600 mt-2">
              画像がアップロードされました
            </p>
          )}
          <div className="mt-3 pt-3 border-t border-slate-200">
            <p className="text-xs text-slate-500 mb-1">または画像URLを直接入力:</p>
            <input
              type="url"
              value={imageUrl}
              onChange={(e) => setImageUrl(e.target.value)}
              placeholder="https://example.com/image.jpg"
              className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-violet-500"
            />
          </div>
        </div>
      )}

      {/* Video Upload */}
      {postType === 'video' && (
        <div className="mb-4">
          <label className="text-sm font-medium text-slate-700 block mb-2">
            動画 *
          </label>
          <MediaUpload
            accept="video"
            onUpload={(url) => setVideoUrl(url)}
            currentUrl={videoUrl}
            onRemove={() => setVideoUrl('')}
          />
          {videoUrl && (
            <p className="text-xs text-emerald-600 mt-2">
              動画がアップロードされました
            </p>
          )}
          <div className="mt-3 pt-3 border-t border-slate-200">
            <p className="text-xs text-slate-500 mb-1">または動画URLを直接入力:</p>
            <input
              type="url"
              value={videoUrl}
              onChange={(e) => setVideoUrl(e.target.value)}
              placeholder="https://example.com/video.mp4"
              className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-violet-500"
            />
          </div>
        </div>
      )}

      {/* Carousel Items */}
      {postType === 'carousel' && (
        <div className="mb-4 space-y-3">
          <label className="text-sm font-medium text-slate-700 block">
            カルーセルアイテム（2〜20個）
          </label>
          {carouselItems.map((item, index) => (
            <div key={index} className="p-3 bg-slate-50 rounded-lg border border-slate-200">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-medium text-slate-600">{index + 1}.</span>
                  <span className={`text-xs px-2 py-0.5 rounded ${item.type === 'IMAGE' ? 'bg-blue-100 text-blue-700' : 'bg-purple-100 text-purple-700'}`}>
                    {item.type === 'IMAGE' ? '画像' : '動画'}
                  </span>
                </div>
                <button
                  onClick={() => removeCarouselItem(index)}
                  className="text-red-500 hover:text-red-700 text-sm"
                >
                  削除
                </button>
              </div>
              <MediaUpload
                accept={item.type === 'IMAGE' ? 'image' : 'video'}
                onUpload={(url) => updateCarouselItem(index, url)}
                currentUrl={item.url}
                onRemove={() => updateCarouselItem(index, '')}
                compact
              />
              <div className="mt-2 pt-2 border-t border-slate-200">
                <input
                  type="url"
                  value={item.url}
                  onChange={(e) => updateCarouselItem(index, e.target.value)}
                  placeholder="またはURLを直接入力"
                  className="w-full px-2 py-1.5 border border-slate-200 rounded text-xs"
                />
              </div>
            </div>
          ))}
          <div className="flex gap-2">
            <button
              onClick={() => addCarouselItem('IMAGE')}
              className="px-3 py-1.5 text-xs bg-blue-100 text-blue-700 rounded hover:bg-blue-200"
            >
              + 画像追加
            </button>
            <button
              onClick={() => addCarouselItem('VIDEO')}
              className="px-3 py-1.5 text-xs bg-purple-100 text-purple-700 rounded hover:bg-purple-200"
            >
              + 動画追加
            </button>
          </div>
          {carouselItems.length < 2 && (
            <p className="text-xs text-amber-600">カルーセルには最低2つのアイテムが必要です</p>
          )}
        </div>
      )}

      {/* Thread Posts */}
      {postType === 'thread' && (
        <div className="mb-4 space-y-4">
          <label className="text-sm font-medium text-slate-700 block">
            スレッド投稿（2個以上）
          </label>
          {threadPosts.map((post, index) => (
            <div key={index} className="p-4 bg-slate-50 rounded-lg border border-slate-200">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium text-slate-700">投稿 {index + 1}</span>
                {threadPosts.length > 1 && (
                  <button
                    onClick={() => removeThreadPost(index)}
                    className="text-red-500 hover:text-red-700 text-sm"
                  >
                    削除
                  </button>
                )}
              </div>
              <textarea
                value={post.text}
                onChange={(e) => updateThreadPost(index, { ...post, text: e.target.value })}
                placeholder="テキスト"
                className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm h-20 resize-none mb-3"
              />

              {/* 画像アップロード */}
              <div className="mb-2">
                <p className="text-xs text-slate-500 mb-1">画像（任意）</p>
                <MediaUpload
                  accept="image"
                  onUpload={(url) => updateThreadPost(index, { ...post, imageUrl: url })}
                  currentUrl={post.imageUrl}
                  onRemove={() => updateThreadPost(index, { ...post, imageUrl: undefined })}
                  compact
                />
                <div className="mt-2">
                  <input
                    type="url"
                    value={post.imageUrl || ''}
                    onChange={(e) => updateThreadPost(index, { ...post, imageUrl: e.target.value || undefined })}
                    placeholder="またはURLを直接入力"
                    className="w-full px-2 py-1.5 border border-slate-200 rounded text-xs"
                  />
                </div>
              </div>

              {/* 動画アップロード */}
              <div>
                <p className="text-xs text-slate-500 mb-1">動画（任意）</p>
                <MediaUpload
                  accept="video"
                  onUpload={(url) => updateThreadPost(index, { ...post, videoUrl: url })}
                  currentUrl={post.videoUrl}
                  onRemove={() => updateThreadPost(index, { ...post, videoUrl: undefined })}
                  compact
                />
                <div className="mt-2">
                  <input
                    type="url"
                    value={post.videoUrl || ''}
                    onChange={(e) => updateThreadPost(index, { ...post, videoUrl: e.target.value || undefined })}
                    placeholder="またはURLを直接入力"
                    className="w-full px-2 py-1.5 border border-slate-200 rounded text-xs"
                  />
                </div>
              </div>
            </div>
          ))}
          <button
            onClick={addThreadPost}
            className="px-4 py-2 text-sm bg-slate-100 text-slate-600 rounded-lg hover:bg-slate-200"
          >
            + 投稿を追加
          </button>
          {threadPosts.length < 2 && (
            <p className="text-xs text-amber-600">スレッドには最低2つの投稿が必要です</p>
          )}
        </div>
      )}

      {/* Error/Success Messages */}
      {error && (
        <p className="text-sm text-red-600 bg-red-50 p-3 rounded-lg mb-4">{error}</p>
      )}
      {success && (
        <p className="text-sm text-emerald-600 bg-emerald-50 p-3 rounded-lg mb-4">
          投稿が完了しました！
        </p>
      )}
      {scheduleSuccess && (
        <p className="text-sm text-blue-600 bg-blue-50 p-3 rounded-lg mb-4">
          投稿が予約されました！
        </p>
      )}

      {/* Schedule Picker */}
      {showSchedulePicker && accountId && (
        <div className="mb-4 p-4 bg-indigo-50 rounded-lg border border-indigo-200">
          <h4 className="text-sm font-medium text-slate-700 mb-3">予約日時を選択</h4>
          <div className="grid grid-cols-2 gap-3 mb-3">
            <div>
              <label className="block text-xs text-slate-500 mb-1">日付</label>
              <input
                type="date"
                value={scheduleDate}
                onChange={(e) => setScheduleDate(e.target.value)}
                min={new Date().toISOString().split('T')[0]}
                className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm"
              />
            </div>
            <div>
              <label className="block text-xs text-slate-500 mb-1">時間</label>
              <input
                type="time"
                value={scheduleTime}
                onChange={(e) => setScheduleTime(e.target.value)}
                className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm"
              />
            </div>
          </div>
          <div className="flex gap-2">
            <button
              onClick={handleSchedule}
              disabled={scheduling || !scheduleDate || !scheduleTime}
              className="flex-1 py-2 bg-indigo-600 text-white text-sm font-medium rounded-lg hover:bg-indigo-700 disabled:opacity-50"
            >
              {scheduling ? '予約中...' : '予約を確定'}
            </button>
            <button
              onClick={() => setShowSchedulePicker(false)}
              className="px-4 py-2 text-sm text-slate-600 hover:text-slate-800"
            >
              キャンセル
            </button>
          </div>
        </div>
      )}

      {/* Action Buttons */}
      <div className="flex gap-3">
        <button
          onClick={handlePost}
          disabled={posting || (postType === 'text' && !text.trim()) || charCount > maxChars}
          className="flex-1 py-3 bg-violet-600 text-white font-semibold rounded-lg hover:bg-violet-700 transition-colors disabled:opacity-50"
        >
          {posting ? '投稿中...' : '投稿する'}
        </button>
        {accountId && (
          <button
            onClick={() => setShowSchedulePicker(!showSchedulePicker)}
            disabled={posting || (postType === 'text' && !text.trim()) || charCount > maxChars}
            className="px-6 py-3 bg-indigo-600 text-white font-semibold rounded-lg hover:bg-indigo-700 transition-colors disabled:opacity-50"
          >
            予約投稿
          </button>
        )}
      </div>
    </div>
  );
}
