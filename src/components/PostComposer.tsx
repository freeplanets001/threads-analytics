'use client';

import { useState } from 'react';

interface PostComposerProps {
  accessToken: string;
  onPostSuccess?: () => void;
}

type PostType = 'text' | 'image' | 'video' | 'carousel' | 'thread';

interface ThreadPost {
  text: string;
  imageUrl?: string;
  videoUrl?: string;
}

export function PostComposer({ accessToken, onPostSuccess }: PostComposerProps) {
  const [postType, setPostType] = useState<PostType>('text');
  const [text, setText] = useState('');
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
  const [showAiPanel, setShowAiPanel] = useState(false);

  const charCount = text.length;
  const maxChars = 500;

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

  const handleAiGenerate = async () => {
    if (!aiPrompt.trim()) return;
    setGenerating(true);
    setError(null);

    try {
      const res = await fetch('/api/ai/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'text',
          prompt: aiPrompt,
          options: { tone: 'engaging', length: 'medium' },
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || 'AI生成に失敗しました');
      } else {
        setText(data.text);
        setShowAiPanel(false);
        setAiPrompt('');
      }
    } catch {
      setError('AI生成に失敗しました');
    } finally {
      setGenerating(false);
    }
  };

  const handleAiImprove = async () => {
    if (!text.trim()) return;
    setGenerating(true);
    setError(null);

    try {
      const res = await fetch('/api/ai/generate', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text,
          targetMetric: 'engagement',
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || '改善提案の取得に失敗しました');
      } else {
        // 改善後の投稿文を抽出（簡易的な実装）
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
      <h2 className="text-lg font-semibold text-slate-900 mb-4">新規投稿</h2>

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
            <span className={`text-xs ${charCount > maxChars ? 'text-red-500' : 'text-slate-500'}`}>
              {charCount}/{maxChars}
            </span>
          </div>
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="何を投稿しますか？"
            className="w-full px-4 py-3 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-violet-500 h-32 resize-none"
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
          </div>

          {/* AI Generation Panel */}
          {showAiPanel && (
            <div className="mt-3 p-4 bg-slate-50 rounded-lg border border-slate-200">
              <label className="text-sm font-medium text-slate-700 block mb-2">
                どんな投稿を作成しますか？
              </label>
              <input
                type="text"
                value={aiPrompt}
                onChange={(e) => setAiPrompt(e.target.value)}
                placeholder="例: プログラミングの学習tips、朝の習慣について..."
                className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm"
              />
              <button
                onClick={handleAiGenerate}
                disabled={generating || !aiPrompt.trim()}
                className="mt-2 px-4 py-2 text-sm bg-violet-600 text-white rounded-lg hover:bg-violet-700 disabled:opacity-50"
              >
                {generating ? '生成中...' : '生成'}
              </button>
            </div>
          )}
        </div>
      )}

      {/* Image URL Input */}
      {postType === 'image' && (
        <div className="mb-4">
          <label className="text-sm font-medium text-slate-700 block mb-1">
            画像URL *
          </label>
          <input
            type="url"
            value={imageUrl}
            onChange={(e) => setImageUrl(e.target.value)}
            placeholder="https://example.com/image.jpg"
            className="w-full px-4 py-3 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-violet-500"
          />
          <p className="text-xs text-slate-500 mt-1">
            JPEG/PNG形式、公開URLが必要です
          </p>
        </div>
      )}

      {/* Video URL Input */}
      {postType === 'video' && (
        <div className="mb-4">
          <label className="text-sm font-medium text-slate-700 block mb-1">
            動画URL *
          </label>
          <input
            type="url"
            value={videoUrl}
            onChange={(e) => setVideoUrl(e.target.value)}
            placeholder="https://example.com/video.mp4"
            className="w-full px-4 py-3 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-violet-500"
          />
          <p className="text-xs text-slate-500 mt-1">
            MP4/MOV形式、公開URLが必要です（最大5分）
          </p>
        </div>
      )}

      {/* Carousel Items */}
      {postType === 'carousel' && (
        <div className="mb-4 space-y-3">
          <label className="text-sm font-medium text-slate-700 block">
            カルーセルアイテム（2〜20個）
          </label>
          {carouselItems.map((item, index) => (
            <div key={index} className="flex gap-2 items-center">
              <span className="text-xs text-slate-500 w-6">{index + 1}.</span>
              <span className="text-xs px-2 py-1 bg-slate-100 rounded">
                {item.type === 'IMAGE' ? '画像' : '動画'}
              </span>
              <input
                type="url"
                value={item.url}
                onChange={(e) => updateCarouselItem(index, e.target.value)}
                placeholder="URL"
                className="flex-1 px-3 py-2 border border-slate-200 rounded-lg text-sm"
              />
              <button
                onClick={() => removeCarouselItem(index)}
                className="text-red-500 hover:text-red-700"
              >
                ×
              </button>
            </div>
          ))}
          <div className="flex gap-2">
            <button
              onClick={() => addCarouselItem('IMAGE')}
              className="px-3 py-1.5 text-xs bg-slate-100 text-slate-600 rounded hover:bg-slate-200"
            >
              + 画像追加
            </button>
            <button
              onClick={() => addCarouselItem('VIDEO')}
              className="px-3 py-1.5 text-xs bg-slate-100 text-slate-600 rounded hover:bg-slate-200"
            >
              + 動画追加
            </button>
          </div>
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
                className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm h-20 resize-none mb-2"
              />
              <input
                type="url"
                value={post.imageUrl || ''}
                onChange={(e) => updateThreadPost(index, { ...post, imageUrl: e.target.value })}
                placeholder="画像URL（任意）"
                className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm"
              />
            </div>
          ))}
          <button
            onClick={addThreadPost}
            className="px-4 py-2 text-sm bg-slate-100 text-slate-600 rounded-lg hover:bg-slate-200"
          >
            + 投稿を追加
          </button>
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

      {/* Action Buttons */}
      <div className="flex gap-3">
        <button
          onClick={handlePost}
          disabled={posting || (postType === 'text' && !text.trim()) || charCount > maxChars}
          className="flex-1 py-3 bg-violet-600 text-white font-semibold rounded-lg hover:bg-violet-700 transition-colors disabled:opacity-50"
        >
          {posting ? '投稿中...' : '投稿する'}
        </button>
      </div>
    </div>
  );
}
