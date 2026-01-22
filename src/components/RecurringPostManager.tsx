'use client';

import { useState, useEffect, useCallback } from 'react';

interface RecurringPost {
  id: string;
  text: string | null;
  scheduledAt: string;
  status: string;
  recurringType: string | null;
  recurringDays: string | null;
}

interface LocalRecurringPost {
  id: string;
  name: string;
  text: string;
  frequency: 'daily' | 'weekly' | 'monthly';
  dayOfWeek?: number;
  dayOfMonth?: number;
  time: string;
  isActive: boolean;
  lastPosted?: string;
  nextScheduled?: string;
  createdAt: string;
}

interface RecurringPostManagerProps {
  accessToken: string;
  accountId?: string;
  onRefresh?: () => void;
}

const DAYS_OF_WEEK = ['日', '月', '火', '水', '木', '金', '土'];

// API形式からローカル形式への変換
function apiToLocal(post: RecurringPost): LocalRecurringPost {
  const days = post.recurringDays ? JSON.parse(post.recurringDays) : [];
  const scheduledDate = new Date(post.scheduledAt);
  const time = `${scheduledDate.getHours().toString().padStart(2, '0')}:${scheduledDate.getMinutes().toString().padStart(2, '0')}`;

  return {
    id: post.id,
    name: post.text?.slice(0, 20) || '定期投稿',
    text: post.text || '',
    frequency: (post.recurringType as 'daily' | 'weekly' | 'monthly') || 'weekly',
    dayOfWeek: post.recurringType === 'weekly' ? days[0] : undefined,
    dayOfMonth: post.recurringType === 'monthly' ? days[0] : undefined,
    time,
    isActive: post.status === 'pending',
    nextScheduled: post.scheduledAt,
    createdAt: post.scheduledAt,
  };
}

export function RecurringPostManager({ accessToken, accountId, onRefresh }: RecurringPostManagerProps) {
  const [posts, setPosts] = useState<LocalRecurringPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showEditor, setShowEditor] = useState(false);
  const [editingPost, setEditingPost] = useState<LocalRecurringPost | null>(null);
  const [saving, setSaving] = useState(false);
  const [useApi, setUseApi] = useState(false);

  // フォーム状態
  const [name, setName] = useState('');
  const [text, setText] = useState('');
  const [frequency, setFrequency] = useState<'daily' | 'weekly' | 'monthly'>('weekly');
  const [dayOfWeek, setDayOfWeek] = useState(1);
  const [dayOfMonth, setDayOfMonth] = useState(1);
  const [time, setTime] = useState('09:00');

  // 次の投稿日時を計算（マイグレーション用）
  const calculateNextScheduledForMigration = useCallback((post: LocalRecurringPost): Date => {
    const now = new Date();
    const [hours, minutes] = post.time.split(':').map(Number);
    const next = new Date();
    next.setHours(hours, minutes, 0, 0);

    if (post.frequency === 'daily') {
      if (next <= now) {
        next.setDate(next.getDate() + 1);
      }
    } else if (post.frequency === 'weekly') {
      const currentDay = now.getDay();
      const targetDay = post.dayOfWeek || 0;
      let daysUntil = targetDay - currentDay;
      if (daysUntil < 0 || (daysUntil === 0 && next <= now)) {
        daysUntil += 7;
      }
      next.setDate(next.getDate() + daysUntil);
    } else if (post.frequency === 'monthly') {
      next.setDate(post.dayOfMonth || 1);
      if (next <= now) {
        next.setMonth(next.getMonth() + 1);
      }
    }
    return next;
  }, []);

  // ローカルの定期投稿をAPIにマイグレーション
  const migrateLocalPostsToApi = useCallback(async (localPosts: LocalRecurringPost[]) => {
    if (!accountId) return;

    for (const post of localPosts) {
      if (!post.isActive) continue;

      try {
        const nextScheduled = calculateNextScheduledForMigration(post);
        const recurringDays = post.frequency === 'weekly'
          ? [post.dayOfWeek]
          : post.frequency === 'monthly'
            ? [post.dayOfMonth]
            : [];

        await fetch('/api/recurring', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            accountId,
            text: post.text,
            recurringType: post.frequency,
            recurringDays,
            scheduledAt: nextScheduled.toISOString(),
          }),
        });
      } catch (e) {
        console.error('Failed to migrate recurring post:', e);
      }
    }
    // マイグレーション完了後、ローカルストレージをクリア
    localStorage.removeItem('recurring_posts');
  }, [accountId, calculateNextScheduledForMigration]);

  // データ取得
  const fetchPosts = useCallback(async () => {
    setLoading(true);
    setError(null);

    // APIから取得を試みる
    try {
      const response = await fetch('/api/recurring');
      if (response.ok) {
        const data = await response.json();
        const apiPosts = (data.recurringPosts || []).map(apiToLocal);

        // APIが空でローカルストレージに投稿がある場合、マイグレーション
        if (apiPosts.length === 0 && accountId) {
          const saved = localStorage.getItem('recurring_posts');
          if (saved) {
            const localPosts = JSON.parse(saved) as LocalRecurringPost[];
            const activePosts = localPosts.filter(p => p.isActive);
            if (activePosts.length > 0) {
              console.log('Migrating local recurring posts to API...');
              await migrateLocalPostsToApi(localPosts);
              // マイグレーション後、再取得
              const refreshResponse = await fetch('/api/recurring');
              if (refreshResponse.ok) {
                const refreshData = await refreshResponse.json();
                setPosts((refreshData.recurringPosts || []).map(apiToLocal));
                setUseApi(true);
                setLoading(false);
                return;
              }
            }
          }
        }

        setPosts(apiPosts);
        setUseApi(true);
        setLoading(false);
        return;
      }
    } catch (e) {
      console.log('API not available, falling back to localStorage', e);
    }

    // ローカルストレージから読み込み
    try {
      const saved = localStorage.getItem('recurring_posts');
      if (saved) {
        setPosts(JSON.parse(saved));
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
    fetchPosts();
  }, [fetchPosts]);

  // ローカル保存
  const saveToLocal = (newPosts: LocalRecurringPost[]) => {
    setPosts(newPosts);
    localStorage.setItem('recurring_posts', JSON.stringify(newPosts));
  };

  // 次の投稿日時を計算
  const calculateNextScheduled = (post: { frequency: string; dayOfWeek?: number; dayOfMonth?: number; time: string }): Date => {
    const now = new Date();
    const [hours, minutes] = post.time.split(':').map(Number);
    const next = new Date();
    next.setHours(hours, minutes, 0, 0);

    if (post.frequency === 'daily') {
      if (next <= now) {
        next.setDate(next.getDate() + 1);
      }
    } else if (post.frequency === 'weekly') {
      const currentDay = now.getDay();
      const targetDay = post.dayOfWeek || 0;
      let daysUntil = targetDay - currentDay;
      if (daysUntil < 0 || (daysUntil === 0 && next <= now)) {
        daysUntil += 7;
      }
      next.setDate(next.getDate() + daysUntil);
    } else if (post.frequency === 'monthly') {
      next.setDate(post.dayOfMonth || 1);
      if (next <= now) {
        next.setMonth(next.getMonth() + 1);
      }
    }

    return next;
  };

  // 保存
  const handleSave = async () => {
    if (!name.trim() || !text.trim()) return;

    setSaving(true);
    setError(null);

    const nextScheduled = calculateNextScheduled({ frequency, dayOfWeek, dayOfMonth, time });
    const recurringDays = frequency === 'weekly' ? [dayOfWeek] : frequency === 'monthly' ? [dayOfMonth] : [];

    // APIに保存を試みる
    if (useApi && accountId) {
      try {
        const body = {
          accountId,
          text,
          recurringType: frequency,
          recurringDays,
          scheduledAt: nextScheduled.toISOString(),
        };

        let response;
        if (editingPost) {
          response = await fetch('/api/recurring', {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ id: editingPost.id, ...body }),
          });
        } else {
          response = await fetch('/api/recurring', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body),
          });
        }

        if (response.ok) {
          await fetchPosts();
          resetForm();
          setShowEditor(false);
          setSaving(false);
          if (onRefresh) onRefresh();
          return;
        } else {
          const data = await response.json();
          setError(data.error || '保存に失敗しました');
        }
      } catch (e) {
        console.error('API save failed', e);
      }
    }

    // ローカルストレージに保存
    const newPost: LocalRecurringPost = {
      id: editingPost?.id || `recurring-${Date.now()}`,
      name,
      text,
      frequency,
      dayOfWeek: frequency === 'weekly' ? dayOfWeek : undefined,
      dayOfMonth: frequency === 'monthly' ? dayOfMonth : undefined,
      time,
      isActive: true,
      nextScheduled: nextScheduled.toISOString(),
      createdAt: editingPost?.createdAt || new Date().toISOString(),
    };

    if (editingPost) {
      saveToLocal(posts.map(p => p.id === editingPost.id ? newPost : p));
    } else {
      saveToLocal([...posts, newPost]);
    }

    resetForm();
    setShowEditor(false);
    setSaving(false);
    if (onRefresh) onRefresh();
  };

  // 削除
  const handleDelete = async (id: string) => {
    if (!confirm('この定期投稿を削除しますか？')) return;

    if (useApi) {
      try {
        const response = await fetch(`/api/recurring?id=${id}`, {
          method: 'DELETE',
        });
        if (response.ok) {
          await fetchPosts();
          return;
        }
      } catch (e) {
        console.error('API delete failed', e);
      }
    }

    saveToLocal(posts.filter(p => p.id !== id));
  };

  // 有効/無効切替
  const toggleActive = async (id: string) => {
    const post = posts.find(p => p.id === id);
    if (!post) return;

    if (useApi) {
      try {
        const newStatus = post.isActive ? 'paused' : 'pending';
        const response = await fetch('/api/recurring', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ id, status: newStatus }),
        });
        if (response.ok) {
          await fetchPosts();
          return;
        }
      } catch (e) {
        console.error('API toggle failed', e);
      }
    }

    saveToLocal(posts.map(p => {
      if (p.id === id) {
        const isActive = !p.isActive;
        let nextScheduled = p.nextScheduled;
        if (isActive) {
          nextScheduled = calculateNextScheduled(p).toISOString();
        }
        return { ...p, isActive, nextScheduled };
      }
      return p;
    }));
  };

  // フォームリセット
  const resetForm = () => {
    setName('');
    setText('');
    setFrequency('weekly');
    setDayOfWeek(1);
    setDayOfMonth(1);
    setTime('09:00');
    setEditingPost(null);
  };

  // 編集開始
  const startEdit = (post: LocalRecurringPost) => {
    setEditingPost(post);
    setName(post.name);
    setText(post.text);
    setFrequency(post.frequency);
    setDayOfWeek(post.dayOfWeek || 1);
    setDayOfMonth(post.dayOfMonth || 1);
    setTime(post.time);
    setShowEditor(true);
  };

  // 頻度のラベル
  const getFrequencyLabel = (post: LocalRecurringPost) => {
    if (post.frequency === 'daily') {
      return `毎日 ${post.time}`;
    } else if (post.frequency === 'weekly') {
      return `毎週${DAYS_OF_WEEK[post.dayOfWeek || 0]}曜日 ${post.time}`;
    } else {
      return `毎月${post.dayOfMonth}日 ${post.time}`;
    }
  };

  return (
    <div className="space-y-6">
      {/* ヘッダー */}
      <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-700 p-5">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-lg font-bold text-slate-900 dark:text-white">定期投稿</h2>
            <p className="text-sm text-slate-500 mt-1">
              毎日・毎週・毎月の自動投稿を設定できます
            </p>
          </div>
          <div className="flex items-center gap-2">
            {useApi && (
              <span className="px-2 py-1 text-xs bg-green-100 text-green-700 rounded-full">
                サーバー連携中
              </span>
            )}
            <button
              onClick={() => {
                resetForm();
                setShowEditor(true);
              }}
              className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 text-sm font-medium"
            >
              + 新規定期投稿
            </button>
          </div>
        </div>

        {error && (
          <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-600">
            {error}
          </div>
        )}

        <div className="p-3 bg-indigo-50 dark:bg-indigo-900/20 border border-indigo-200 dark:border-indigo-800 rounded-lg">
          <p className="text-sm text-indigo-700 dark:text-indigo-400">
            {useApi ? (
              <>
                <strong>サーバー連携有効:</strong> 定期投稿はサーバー側で自動実行されます。
              </>
            ) : (
              <>
                <strong>ローカルモード:</strong> 設定はブラウザに保存されます。
                実際の投稿には cron-job.org での設定が必要です。
              </>
            )}
          </p>
        </div>
      </div>

      {/* エディター */}
      {showEditor && (
        <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-700 p-5">
          <h3 className="font-semibold text-slate-900 dark:text-white mb-4">
            {editingPost ? '定期投稿を編集' : '新規定期投稿'}
          </h3>
          <div className="space-y-4">
            <div>
              <label className="block text-sm text-slate-600 dark:text-slate-400 mb-1">名前</label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="例: 朝の挨拶"
                className="w-full px-3 py-2 border border-slate-200 dark:border-slate-700 rounded-lg dark:bg-slate-800"
              />
            </div>

            <div>
              <label className="block text-sm text-slate-600 dark:text-slate-400 mb-1">投稿内容</label>
              <textarea
                value={text}
                onChange={(e) => setText(e.target.value)}
                placeholder="投稿テキストを入力..."
                className="w-full px-3 py-2 border border-slate-200 dark:border-slate-700 rounded-lg dark:bg-slate-800 h-24 resize-none"
                maxLength={500}
              />
              <p className="text-xs text-slate-400 mt-1 text-right">{text.length}/500</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-sm text-slate-600 dark:text-slate-400 mb-1">頻度</label>
                <select
                  value={frequency}
                  onChange={(e) => setFrequency(e.target.value as 'daily' | 'weekly' | 'monthly')}
                  className="w-full px-3 py-2 border border-slate-200 dark:border-slate-700 rounded-lg dark:bg-slate-800"
                >
                  <option value="daily">毎日</option>
                  <option value="weekly">毎週</option>
                  <option value="monthly">毎月</option>
                </select>
              </div>

              {frequency === 'weekly' && (
                <div>
                  <label className="block text-sm text-slate-600 dark:text-slate-400 mb-1">曜日</label>
                  <select
                    value={dayOfWeek}
                    onChange={(e) => setDayOfWeek(Number(e.target.value))}
                    className="w-full px-3 py-2 border border-slate-200 dark:border-slate-700 rounded-lg dark:bg-slate-800"
                  >
                    {DAYS_OF_WEEK.map((day, i) => (
                      <option key={i} value={i}>{day}曜日</option>
                    ))}
                  </select>
                </div>
              )}

              {frequency === 'monthly' && (
                <div>
                  <label className="block text-sm text-slate-600 dark:text-slate-400 mb-1">日付</label>
                  <select
                    value={dayOfMonth}
                    onChange={(e) => setDayOfMonth(Number(e.target.value))}
                    className="w-full px-3 py-2 border border-slate-200 dark:border-slate-700 rounded-lg dark:bg-slate-800"
                  >
                    {Array.from({ length: 28 }, (_, i) => i + 1).map(day => (
                      <option key={day} value={day}>{day}日</option>
                    ))}
                  </select>
                </div>
              )}

              <div>
                <label className="block text-sm text-slate-600 dark:text-slate-400 mb-1">時間</label>
                <input
                  type="time"
                  value={time}
                  onChange={(e) => setTime(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-200 dark:border-slate-700 rounded-lg dark:bg-slate-800"
                />
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button
                onClick={() => {
                  setShowEditor(false);
                  resetForm();
                }}
                className="px-4 py-2 text-slate-600 hover:text-slate-800"
              >
                キャンセル
              </button>
              <button
                onClick={handleSave}
                disabled={saving || !name.trim() || !text.trim()}
                className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50"
              >
                {saving ? '保存中...' : '保存'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 一覧 */}
      <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-700 overflow-hidden">
        {loading ? (
          <div className="p-8 text-center">
            <div className="w-8 h-8 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin mx-auto" />
          </div>
        ) : posts.length === 0 ? (
          <div className="p-8 text-center">
            <div className="w-16 h-16 bg-slate-100 dark:bg-slate-800 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg className="w-8 h-8 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <p className="text-slate-600 dark:text-slate-400 font-medium">定期投稿がありません</p>
          </div>
        ) : (
          <div className="divide-y divide-slate-200 dark:divide-slate-700">
            {posts.map((post) => (
              <div key={post.id} className="p-4 hover:bg-slate-50 dark:hover:bg-slate-800">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className={`w-2 h-2 rounded-full ${post.isActive ? 'bg-green-500' : 'bg-slate-300'}`} />
                      <p className="font-medium text-slate-900 dark:text-white">{post.name}</p>
                      <span className="text-xs bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-400 px-2 py-0.5 rounded">
                        {getFrequencyLabel(post)}
                      </span>
                    </div>
                    <p className="text-sm text-slate-600 dark:text-slate-400 line-clamp-2 mb-2">
                      {post.text}
                    </p>
                    {post.nextScheduled && post.isActive && (
                      <p className="text-xs text-slate-500">
                        次回: {new Date(post.nextScheduled).toLocaleString('ja-JP')}
                      </p>
                    )}
                  </div>
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => toggleActive(post.id)}
                      className={`px-3 py-1.5 text-sm rounded-lg ${
                        post.isActive
                          ? 'bg-green-100 text-green-700 hover:bg-green-200'
                          : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                      }`}
                    >
                      {post.isActive ? '有効' : '無効'}
                    </button>
                    <button
                      onClick={() => startEdit(post)}
                      className="p-2 text-slate-400 hover:text-slate-600"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                      </svg>
                    </button>
                    <button
                      onClick={() => handleDelete(post.id)}
                      className="p-2 text-slate-400 hover:text-red-500"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
