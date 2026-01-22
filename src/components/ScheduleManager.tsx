'use client';

import { useState, useEffect, useCallback } from 'react';

interface ScheduledPost {
  id: string;
  text: string | null;
  scheduledAt: string;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  errorMessage?: string | null;
  type: string;
  mediaUrls?: string | null;
}

interface ScheduleManagerProps {
  accessToken: string;
  accountId?: string;
  onRefresh?: () => void;
}

export function ScheduleManager({ accessToken, accountId, onRefresh }: ScheduleManagerProps) {
  const [posts, setPosts] = useState<ScheduledPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [useApi, setUseApi] = useState(false);

  // 新規スケジュール投稿用
  const [showAddForm, setShowAddForm] = useState(false);
  const [newPostText, setNewPostText] = useState('');
  const [newPostDate, setNewPostDate] = useState('');
  const [newPostTime, setNewPostTime] = useState('');
  const [adding, setAdding] = useState(false);

  // ローカルの予約投稿をAPIにマイグレーション
  const migrateLocalPostsToApi = useCallback(async (localPosts: ScheduledPost[]) => {
    if (!accountId) return;

    const now = new Date();
    for (const post of localPosts) {
      // 過去の投稿はスキップ
      if (post.status !== 'pending' || new Date(post.scheduledAt) <= now) continue;

      try {
        await fetch('/api/scheduled', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            accountId,
            type: post.type || 'text',
            text: post.text,
            scheduledAt: post.scheduledAt,
          }),
        });
      } catch (e) {
        console.error('Failed to migrate scheduled post:', e);
      }
    }
    // マイグレーション完了後、ローカルストレージをクリア
    localStorage.removeItem('scheduled_posts');
  }, [accountId]);

  // データ取得
  const fetchScheduledPosts = useCallback(async () => {
    setLoading(true);
    setError(null);

    // APIから取得を試みる
    try {
      const response = await fetch('/api/scheduled');
      if (response.ok) {
        const data = await response.json();
        // isRecurring: false のみフィルタ
        const scheduled = (data.scheduledPosts || []).filter((p: { isRecurring?: boolean }) => !p.isRecurring);

        // APIが空でローカルストレージに投稿がある場合、マイグレーション
        if (scheduled.length === 0 && accountId) {
          const saved = localStorage.getItem('scheduled_posts');
          if (saved) {
            const localPosts = JSON.parse(saved) as ScheduledPost[];
            const pendingPosts = localPosts.filter(p => p.status === 'pending' && new Date(p.scheduledAt) > new Date());
            if (pendingPosts.length > 0) {
              console.log('Migrating local scheduled posts to API...');
              await migrateLocalPostsToApi(localPosts);
              // マイグレーション後、再取得
              const refreshResponse = await fetch('/api/scheduled');
              if (refreshResponse.ok) {
                const refreshData = await refreshResponse.json();
                const refreshScheduled = (refreshData.scheduledPosts || []).filter((p: { isRecurring?: boolean }) => !p.isRecurring);
                setPosts(refreshScheduled);
                setUseApi(true);
                setLoading(false);
                return;
              }
            }
          }
        }

        setPosts(scheduled);
        setUseApi(true);
        setLoading(false);
        return;
      }
    } catch (e) {
      console.log('API not available, falling back to localStorage', e);
    }

    // ローカルストレージから読み込み
    try {
      const saved = localStorage.getItem('scheduled_posts');
      if (saved) {
        const allPosts = JSON.parse(saved) as ScheduledPost[];
        const now = new Date();
        const updated = allPosts.map(post => {
          if (post.status === 'pending' && new Date(post.scheduledAt) < now) {
            return { ...post, status: 'failed' as const, errorMessage: '予約時刻を過ぎました' };
          }
          return post;
        });
        setPosts(updated);
        localStorage.setItem('scheduled_posts', JSON.stringify(updated));
      } else {
        setPosts([]);
      }
      setUseApi(false);
    } catch {
      setError('読み込みに失敗しました');
    }
    setLoading(false);
  }, [accountId, migrateLocalPostsToApi]);

  useEffect(() => {
    fetchScheduledPosts();
  }, [fetchScheduledPosts]);

  // ローカル保存
  const saveToLocal = (newPosts: ScheduledPost[]) => {
    setPosts(newPosts);
    localStorage.setItem('scheduled_posts', JSON.stringify(newPosts));
  };

  // スケジュール投稿を追加
  const handleAddPost = async () => {
    if (!newPostText.trim() || !newPostDate || !newPostTime) {
      return;
    }

    setAdding(true);
    setError(null);

    const scheduledAt = new Date(`${newPostDate}T${newPostTime}`);

    if (scheduledAt <= new Date()) {
      setError('未来の日時を指定してください');
      setAdding(false);
      return;
    }

    // APIに保存を試みる
    if (useApi && accountId) {
      try {
        const response = await fetch('/api/scheduled', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            accountId,
            type: 'text',
            text: newPostText,
            scheduledAt: scheduledAt.toISOString(),
          }),
        });

        if (response.ok) {
          await fetchScheduledPosts();
          setNewPostText('');
          setNewPostDate('');
          setNewPostTime('');
          setShowAddForm(false);
          setAdding(false);
          if (onRefresh) onRefresh();
          return;
        } else {
          const data = await response.json();
          setError(data.error || '追加に失敗しました');
          setAdding(false);
          return;
        }
      } catch (e) {
        console.error('API save failed', e);
      }
    }

    // ローカルストレージに保存
    const newPost: ScheduledPost = {
      id: `schedule-${Date.now()}`,
      text: newPostText,
      scheduledAt: scheduledAt.toISOString(),
      status: 'pending',
      type: 'text',
    };

    saveToLocal([...posts, newPost]);
    setNewPostText('');
    setNewPostDate('');
    setNewPostTime('');
    setShowAddForm(false);
    setAdding(false);
    if (onRefresh) onRefresh();
  };

  // スケジュール投稿を削除
  const handleDeletePost = async (id: string) => {
    if (!confirm('この予約投稿を削除しますか？')) return;

    // APIから削除を試みる
    if (useApi) {
      try {
        const response = await fetch(`/api/scheduled?id=${id}`, {
          method: 'DELETE',
        });
        if (response.ok) {
          await fetchScheduledPosts();
          if (onRefresh) onRefresh();
          return;
        }
      } catch (e) {
        console.error('API delete failed', e);
      }
    }

    saveToLocal(posts.filter(p => p.id !== id));
    if (onRefresh) onRefresh();
  };

  // ステータスに応じた表示
  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'pending':
        return <span className="px-2 py-1 text-xs rounded-full bg-yellow-100 text-yellow-700">予約中</span>;
      case 'processing':
        return <span className="px-2 py-1 text-xs rounded-full bg-blue-100 text-blue-700">処理中</span>;
      case 'completed':
        return <span className="px-2 py-1 text-xs rounded-full bg-green-100 text-green-700">完了</span>;
      case 'failed':
        return <span className="px-2 py-1 text-xs rounded-full bg-red-100 text-red-700">失敗</span>;
      default:
        return null;
    }
  };

  // 日時フォーマット
  const formatDateTime = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleString('ja-JP', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  // 今日以降の日付を取得
  const getMinDate = () => {
    return new Date().toISOString().split('T')[0];
  };

  return (
    <div className="space-y-6">
      {/* ヘッダー */}
      <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-700 p-5">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-lg font-bold text-slate-900 dark:text-white">予約投稿管理</h2>
            <p className="text-sm text-slate-500 mt-1">
              投稿を予約して自動的に投稿されるようにスケジュールできます
            </p>
          </div>
          <div className="flex items-center gap-2">
            {useApi && (
              <span className="px-2 py-1 text-xs bg-green-100 text-green-700 rounded-full">
                サーバー連携中
              </span>
            )}
            <button
              onClick={() => setShowAddForm(!showAddForm)}
              className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 text-sm font-medium"
            >
              + 新規予約
            </button>
            <button
              onClick={fetchScheduledPosts}
              disabled={loading}
              className="px-4 py-2 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 rounded-lg hover:bg-slate-200 dark:hover:bg-slate-700 text-sm disabled:opacity-50"
            >
              更新
            </button>
          </div>
        </div>

        {/* 新規追加フォーム */}
        {showAddForm && (
          <div className="mt-4 p-4 bg-slate-50 dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700">
            <h3 className="font-medium text-slate-900 dark:text-white mb-3">新規予約投稿</h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm text-slate-600 dark:text-slate-400 mb-1">投稿内容</label>
                <textarea
                  value={newPostText}
                  onChange={(e) => setNewPostText(e.target.value)}
                  placeholder="投稿内容を入力..."
                  className="w-full px-3 py-2 border border-slate-200 dark:border-slate-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 h-24 resize-none dark:bg-slate-900"
                  maxLength={500}
                />
                <p className="text-xs text-slate-400 mt-1 text-right">{newPostText.length}/500</p>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm text-slate-600 dark:text-slate-400 mb-1">投稿日</label>
                  <input
                    type="date"
                    value={newPostDate}
                    onChange={(e) => setNewPostDate(e.target.value)}
                    min={getMinDate()}
                    className="w-full px-3 py-2 border border-slate-200 dark:border-slate-700 rounded-lg dark:bg-slate-900"
                  />
                </div>
                <div>
                  <label className="block text-sm text-slate-600 dark:text-slate-400 mb-1">投稿時間</label>
                  <input
                    type="time"
                    value={newPostTime}
                    onChange={(e) => setNewPostTime(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-200 dark:border-slate-700 rounded-lg dark:bg-slate-900"
                  />
                </div>
              </div>
              <div className="flex justify-end gap-2">
                <button
                  onClick={() => setShowAddForm(false)}
                  className="px-4 py-2 text-slate-600 hover:text-slate-800"
                >
                  キャンセル
                </button>
                <button
                  onClick={handleAddPost}
                  disabled={adding || !newPostText.trim() || !newPostDate || !newPostTime}
                  className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50"
                >
                  {adding ? '追加中...' : '予約を追加'}
                </button>
              </div>
            </div>
          </div>
        )}

        {error && (
          <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-600">
            {error}
          </div>
        )}

        <div className="mt-4 p-3 bg-indigo-50 dark:bg-indigo-900/20 border border-indigo-200 dark:border-indigo-800 rounded-lg">
          <p className="text-sm text-indigo-700 dark:text-indigo-400">
            {useApi ? (
              <>
                <strong>サーバー連携有効:</strong> 予約投稿はサーバー側で定期的に実行されます。
              </>
            ) : (
              <>
                <strong>ローカルモード:</strong> データベースに接続されていないため、予約はブラウザに保存されます。
                実際の投稿には cron-job.org での設定が必要です。
              </>
            )}
          </p>
        </div>
      </div>

      {/* 予約投稿一覧 */}
      <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-700 overflow-hidden">
        {loading ? (
          <div className="p-8 text-center">
            <div className="w-8 h-8 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin mx-auto" />
            <p className="text-slate-500 mt-2">読み込み中...</p>
          </div>
        ) : posts.length === 0 ? (
          <div className="p-8 text-center">
            <div className="w-16 h-16 bg-slate-100 dark:bg-slate-800 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg className="w-8 h-8 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
            </div>
            <p className="text-slate-600 dark:text-slate-400 font-medium">予約投稿がありません</p>
            <p className="text-sm text-slate-500 mt-1">上の「新規予約」ボタンから投稿を予約できます</p>
          </div>
        ) : (
          <div className="divide-y divide-slate-200 dark:divide-slate-700">
            {posts
              .sort((a, b) => new Date(a.scheduledAt).getTime() - new Date(b.scheduledAt).getTime())
              .map((post) => (
                <div key={post.id} className="p-4 hover:bg-slate-50 dark:hover:bg-slate-800">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-2">
                        {getStatusBadge(post.status)}
                        <span className="text-sm text-slate-500">
                          {formatDateTime(post.scheduledAt)}
                        </span>
                      </div>
                      <p className="text-slate-900 dark:text-white whitespace-pre-wrap break-words">
                        {post.text}
                      </p>
                      {post.errorMessage && (
                        <p className="text-sm text-red-600 mt-2">
                          エラー: {post.errorMessage}
                        </p>
                      )}
                    </div>
                    {post.status === 'pending' && (
                      <button
                        onClick={() => handleDeletePost(post.id)}
                        className="p-2 text-slate-400 hover:text-red-500 transition-colors"
                        title="削除"
                      >
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                      </button>
                    )}
                  </div>
                </div>
              ))}
          </div>
        )}
      </div>
    </div>
  );
}
