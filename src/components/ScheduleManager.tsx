'use client';

import { useState, useEffect, useCallback } from 'react';
import { CsvImportModal } from './CsvImportModal';
import { exportScheduledPostsToCsv } from '@/lib/csv-utils';

interface ScheduledPost {
  id: string;
  text: string | null;
  threadPosts?: string | null;
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

type StatusFilter = 'all' | 'pending' | 'completed' | 'failed';

export function ScheduleManager({ accessToken, accountId, onRefresh }: ScheduleManagerProps) {
  const [posts, setPosts] = useState<ScheduledPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [useApi, setUseApi] = useState(false);

  // 新規スケジュール投稿用
  const [showAddForm, setShowAddForm] = useState(false);
  const [newPostType, setNewPostType] = useState<'text' | 'thread'>('text');
  const [newPostText, setNewPostText] = useState('');
  const [newThreadPosts, setNewThreadPosts] = useState<Array<{ text: string }>>([{ text: '' }, { text: '' }]);
  const [newPostDate, setNewPostDate] = useState('');
  const [newPostTime, setNewPostTime] = useState('');
  const [adding, setAdding] = useState(false);

  // CSVインポートモーダル
  const [showCsvImport, setShowCsvImport] = useState(false);

  // フィルター
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');

  // 一括選択
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [bulkDeleting, setBulkDeleting] = useState(false);

  // 編集
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editText, setEditText] = useState('');
  const [editDate, setEditDate] = useState('');
  const [editTime, setEditTime] = useState('');
  const [saving, setSaving] = useState(false);

  // ローカルの予約投稿をAPIにマイグレーション
  const migrateLocalPostsToApi = useCallback(async (localPosts: ScheduledPost[]) => {
    if (!accountId) return;

    const now = new Date();
    for (const post of localPosts) {
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
    localStorage.removeItem('scheduled_posts');
  }, [accountId]);

  // データ取得
  const fetchScheduledPosts = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch('/api/scheduled');
      if (response.ok) {
        const data = await response.json();
        const scheduled = (data.scheduledPosts || []).filter((p: { isRecurring?: boolean }) => !p.isRecurring);

        if (scheduled.length === 0 && accountId) {
          const saved = localStorage.getItem('scheduled_posts');
          if (saved) {
            const localPosts = JSON.parse(saved) as ScheduledPost[];
            const pendingPosts = localPosts.filter(p => p.status === 'pending' && new Date(p.scheduledAt) > new Date());
            if (pendingPosts.length > 0) {
              await migrateLocalPostsToApi(localPosts);
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

  // 選択状態をリセット
  useEffect(() => {
    setSelectedIds(new Set());
  }, [statusFilter]);

  // ローカル保存
  const saveToLocal = (newPosts: ScheduledPost[]) => {
    setPosts(newPosts);
    localStorage.setItem('scheduled_posts', JSON.stringify(newPosts));
  };

  // フォームリセット
  const resetAddForm = () => {
    setNewPostText('');
    setNewPostType('text');
    setNewThreadPosts([{ text: '' }, { text: '' }]);
    setNewPostDate('');
    setNewPostTime('');
    setShowAddForm(false);
    setAdding(false);
  };

  // バリデーション
  const isAddFormValid = () => {
    if (!newPostDate || !newPostTime) return false;
    if (newPostType === 'text') return newPostText.trim().length > 0;
    if (newPostType === 'thread') return newThreadPosts.length >= 2 && newThreadPosts.every(p => p.text.trim().length > 0);
    return false;
  };

  // スケジュール投稿を追加
  const handleAddPost = async () => {
    if (!isAddFormValid()) return;

    setAdding(true);
    setError(null);

    const scheduledAt = new Date(`${newPostDate}T${newPostTime}`);

    if (scheduledAt <= new Date()) {
      setError('未来の日時を指定してください');
      setAdding(false);
      return;
    }

    if (useApi && accountId) {
      try {
        const body: Record<string, unknown> = {
          accountId,
          type: newPostType,
          scheduledAt: scheduledAt.toISOString(),
        };

        if (newPostType === 'thread') {
          body.threadPosts = newThreadPosts;
        } else {
          body.text = newPostText;
        }

        const response = await fetch('/api/scheduled', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        });

        if (response.ok) {
          await fetchScheduledPosts();
          resetAddForm();
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

    const newPost: ScheduledPost = {
      id: `schedule-${Date.now()}`,
      text: newPostType === 'text' ? newPostText : null,
      threadPosts: newPostType === 'thread' ? JSON.stringify(newThreadPosts) : null,
      scheduledAt: scheduledAt.toISOString(),
      status: 'pending',
      type: newPostType,
    };

    saveToLocal([...posts, newPost]);
    resetAddForm();
    if (onRefresh) onRefresh();
  };

  // スケジュール投稿を削除
  const handleDeletePost = async (id: string) => {
    if (!confirm('この予約投稿を削除しますか？')) return;

    if (useApi) {
      try {
        const response = await fetch(`/api/scheduled?id=${id}`, { method: 'DELETE' });
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

  // 一括削除
  const handleBulkDelete = async () => {
    if (selectedIds.size === 0) return;
    if (!confirm(`${selectedIds.size}件の予約投稿を削除しますか？`)) return;

    setBulkDeleting(true);
    setError(null);

    if (useApi) {
      try {
        const res = await fetch('/api/scheduled', {
          method: 'DELETE',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ ids: Array.from(selectedIds) }),
        });
        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          setError(data.error || '削除に失敗しました');
        }
      } catch (e) {
        console.error('Bulk delete failed', e);
        setError('削除に失敗しました');
      }
      await fetchScheduledPosts();
    } else {
      saveToLocal(posts.filter(p => !selectedIds.has(p.id)));
    }

    setSelectedIds(new Set());
    setBulkDeleting(false);
    if (onRefresh) onRefresh();
  };

  // 全件削除（pending のみ）
  const handleDeleteAll = async () => {
    const pendingPosts = posts.filter(p => p.status === 'pending');
    if (pendingPosts.length === 0) return;
    if (!confirm(`予約中の投稿 ${pendingPosts.length}件を全て削除しますか？この操作は取り消せません。`)) return;

    setBulkDeleting(true);

    if (useApi) {
      try {
        await fetch('/api/scheduled?all=pending', { method: 'DELETE' });
      } catch (e) {
        console.error('Delete all failed', e);
      }
      await fetchScheduledPosts();
    } else {
      saveToLocal(posts.filter(p => p.status !== 'pending'));
    }

    setSelectedIds(new Set());
    setBulkDeleting(false);
    if (onRefresh) onRefresh();
  };

  // 選択トグル
  const toggleSelect = (id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  // 全選択/全解除
  const toggleSelectAll = () => {
    const filteredPending = filteredPosts.filter(p => p.status === 'pending');
    if (selectedIds.size === filteredPending.length && filteredPending.length > 0) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(filteredPending.map(p => p.id)));
    }
  };

  // 編集開始
  const startEdit = (post: ScheduledPost) => {
    setEditingId(post.id);
    setEditText(post.text || '');
    const date = new Date(post.scheduledAt);
    setEditDate(date.toISOString().split('T')[0]);
    setEditTime(date.toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit', hour12: false }));
  };

  // 編集保存
  const handleSaveEdit = async () => {
    if (!editingId || !editText.trim() || !editDate || !editTime) return;

    setSaving(true);
    setError(null);

    const scheduledAt = new Date(`${editDate}T${editTime}`);
    if (scheduledAt <= new Date()) {
      setError('未来の日時を指定してください');
      setSaving(false);
      return;
    }

    if (useApi) {
      // API: 削除して再作成（既存APIにPUT/PATCHがないため）
      try {
        await fetch(`/api/scheduled?id=${editingId}`, { method: 'DELETE' });

        if (accountId) {
          const response = await fetch('/api/scheduled', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              accountId,
              type: 'text',
              text: editText,
              scheduledAt: scheduledAt.toISOString(),
            }),
          });

          if (!response.ok) {
            const data = await response.json();
            setError(data.error || '保存に失敗しました');
            setSaving(false);
            return;
          }
        }

        await fetchScheduledPosts();
      } catch (e) {
        console.error('Edit save failed', e);
        setError('保存に失敗しました');
      }
    } else {
      const updated = posts.map(p =>
        p.id === editingId
          ? { ...p, text: editText, scheduledAt: scheduledAt.toISOString() }
          : p
      );
      saveToLocal(updated);
    }

    setEditingId(null);
    setEditText('');
    setEditDate('');
    setEditTime('');
    setSaving(false);
    if (onRefresh) onRefresh();
  };

  // CSVエクスポート
  const handleExportCsv = () => {
    const csv = exportScheduledPostsToCsv(posts);
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `scheduled-posts-${new Date().toISOString().split('T')[0]}.csv`;
    a.style.display = 'none';
    document.body.appendChild(a);
    a.click();
    setTimeout(() => {
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    }, 200);
  };

  // ステータスバッジ
  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'pending':
        return <span className="px-2 py-1 text-xs rounded-full bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400">予約中</span>;
      case 'processing':
        return <span className="px-2 py-1 text-xs rounded-full bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400">処理中</span>;
      case 'completed':
        return <span className="px-2 py-1 text-xs rounded-full bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400">完了</span>;
      case 'failed':
        return <span className="px-2 py-1 text-xs rounded-full bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400">失敗</span>;
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

  const getMinDate = () => new Date().toISOString().split('T')[0];

  // 投稿内容の表示テキストを取得
  const getPostDisplayText = (post: ScheduledPost): string => {
    if (post.text) return post.text;
    if (post.type === 'thread' && post.threadPosts) {
      try {
        const threads = JSON.parse(post.threadPosts) as Array<{ text: string }>;
        const firstText = threads[0]?.text || '';
        const preview = firstText.length > 60 ? firstText.substring(0, 60) + '...' : firstText;
        return `[スレッド ${threads.length}件] ${preview}`;
      } catch {
        return '[スレッド]';
      }
    }
    return '(内容なし)';
  };

  // 投稿タイプの日本語ラベル
  const getTypeLabel = (type: string): string => {
    switch (type) {
      case 'thread': return 'スレッド';
      case 'image': return '画像';
      case 'video': return '動画';
      case 'carousel': return 'カルーセル';
      default: return type;
    }
  };

  // フィルター適用
  const filteredPosts = posts.filter(p => {
    if (statusFilter === 'all') return true;
    return p.status === statusFilter;
  });

  // ステータス別カウント
  const counts = {
    all: posts.length,
    pending: posts.filter(p => p.status === 'pending').length,
    completed: posts.filter(p => p.status === 'completed').length,
    failed: posts.filter(p => p.status === 'failed').length,
  };

  const filterTabs: { key: StatusFilter; label: string; count: number }[] = [
    { key: 'all', label: '全て', count: counts.all },
    { key: 'pending', label: '予約中', count: counts.pending },
    { key: 'completed', label: '完了', count: counts.completed },
    { key: 'failed', label: '失敗', count: counts.failed },
  ];

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
          <div className="flex items-center gap-2 flex-wrap justify-end">
            {useApi && (
              <span className="px-2 py-1 text-xs bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400 rounded-full">
                サーバー連携中
              </span>
            )}
            <button
              onClick={() => setShowAddForm(!showAddForm)}
              className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 text-sm font-medium"
            >
              + 新規予約
            </button>
            {accountId && (
              <button
                onClick={() => setShowCsvImport(true)}
                className="px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 text-sm font-medium"
              >
                CSVインポート
              </button>
            )}
            {posts.length > 0 && (
              <>
                <button
                  onClick={handleExportCsv}
                  className="px-3 py-2 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 rounded-lg hover:bg-slate-200 dark:hover:bg-slate-700 text-sm"
                  title="CSVエクスポート"
                >
                  <svg className="w-4 h-4 inline mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                  エクスポート
                </button>
                {counts.pending > 0 && (
                  <button
                    onClick={handleDeleteAll}
                    disabled={bulkDeleting}
                    className="px-3 py-2 bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 rounded-lg hover:bg-red-100 dark:hover:bg-red-900/40 text-sm disabled:opacity-50"
                    title="予約中の投稿を全件削除"
                  >
                    <svg className="w-4 h-4 inline mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                    {bulkDeleting ? '削除中...' : '全件削除'}
                  </button>
                )}
              </>
            )}
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
              {/* 投稿タイプ選択 */}
              <div>
                <label className="block text-sm text-slate-600 dark:text-slate-400 mb-2">投稿タイプ</label>
                <div className="flex gap-2">
                  <button
                    onClick={() => setNewPostType('text')}
                    className={`px-4 py-1.5 text-sm rounded-lg transition-colors ${
                      newPostType === 'text'
                        ? 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-400 font-medium'
                        : 'bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-slate-700 hover:border-indigo-300'
                    }`}
                  >
                    テキスト
                  </button>
                  <button
                    onClick={() => setNewPostType('thread')}
                    className={`px-4 py-1.5 text-sm rounded-lg transition-colors ${
                      newPostType === 'thread'
                        ? 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-400 font-medium'
                        : 'bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-slate-700 hover:border-indigo-300'
                    }`}
                  >
                    スレッド
                  </button>
                </div>
              </div>

              {/* テキスト投稿 */}
              {newPostType === 'text' && (
                <div>
                  <label className="block text-sm text-slate-600 dark:text-slate-400 mb-1">投稿内容</label>
                  <textarea
                    value={newPostText}
                    onChange={(e) => setNewPostText(e.target.value)}
                    placeholder="投稿内容を入力..."
                    className="w-full px-3 py-2 border border-slate-200 dark:border-slate-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 h-24 resize-none dark:bg-slate-900 dark:text-white"
                    maxLength={500}
                  />
                  <p className="text-xs text-slate-400 mt-1 text-right">{newPostText.length}/500</p>
                </div>
              )}

              {/* スレッド投稿 */}
              {newPostType === 'thread' && (
                <div className="space-y-3">
                  <label className="block text-sm text-slate-600 dark:text-slate-400">スレッド投稿（2個以上）</label>
                  {newThreadPosts.map((post, index) => (
                    <div key={index} className="p-3 bg-white dark:bg-slate-900 rounded-lg border border-slate-200 dark:border-slate-700">
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-xs font-medium text-slate-500">投稿 {index + 1}</span>
                        {newThreadPosts.length > 2 && (
                          <button
                            onClick={() => setNewThreadPosts(newThreadPosts.filter((_, i) => i !== index))}
                            className="text-xs text-red-500 hover:text-red-700"
                          >
                            削除
                          </button>
                        )}
                      </div>
                      <textarea
                        value={post.text}
                        onChange={(e) => {
                          const updated = [...newThreadPosts];
                          updated[index] = { text: e.target.value };
                          setNewThreadPosts(updated);
                        }}
                        placeholder={`投稿 ${index + 1} の内容...`}
                        className="w-full px-3 py-2 border border-slate-200 dark:border-slate-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 h-16 resize-none dark:bg-slate-900 dark:text-white text-sm"
                        maxLength={500}
                      />
                    </div>
                  ))}
                  <button
                    onClick={() => setNewThreadPosts([...newThreadPosts, { text: '' }])}
                    className="px-3 py-1.5 text-sm bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 rounded-lg hover:bg-slate-200 dark:hover:bg-slate-600"
                  >
                    + 投稿を追加
                  </button>
                </div>
              )}

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm text-slate-600 dark:text-slate-400 mb-1">投稿日</label>
                  <input
                    type="date"
                    value={newPostDate}
                    onChange={(e) => setNewPostDate(e.target.value)}
                    min={getMinDate()}
                    className="w-full px-3 py-2 border border-slate-200 dark:border-slate-700 rounded-lg dark:bg-slate-900 dark:text-white"
                  />
                </div>
                <div>
                  <label className="block text-sm text-slate-600 dark:text-slate-400 mb-1">投稿時間</label>
                  <input
                    type="time"
                    value={newPostTime}
                    onChange={(e) => setNewPostTime(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-200 dark:border-slate-700 rounded-lg dark:bg-slate-900 dark:text-white"
                  />
                </div>
              </div>
              <div className="flex justify-end gap-2">
                <button
                  onClick={resetAddForm}
                  className="px-4 py-2 text-slate-600 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200"
                >
                  キャンセル
                </button>
                <button
                  onClick={handleAddPost}
                  disabled={adding || !isAddFormValid()}
                  className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50"
                >
                  {adding ? '追加中...' : '予約を追加'}
                </button>
              </div>
            </div>
          </div>
        )}

        {error && (
          <div className="mt-4 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg text-sm text-red-600 dark:text-red-400">
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

      {/* 統計サマリー */}
      {posts.length > 0 && (
        <div className="grid grid-cols-4 gap-3">
          {filterTabs.map(tab => (
            <div
              key={tab.key}
              className={`bg-white dark:bg-slate-900 rounded-xl border p-3 text-center cursor-pointer transition-colors ${
                statusFilter === tab.key
                  ? 'border-indigo-500 dark:border-indigo-400'
                  : 'border-slate-200 dark:border-slate-700 hover:border-slate-300 dark:hover:border-slate-600'
              }`}
              onClick={() => setStatusFilter(tab.key)}
            >
              <p className="text-2xl font-bold text-slate-900 dark:text-white">{tab.count}</p>
              <p className="text-xs text-slate-500">{tab.label}</p>
            </div>
          ))}
        </div>
      )}

      {/* 一括操作バー */}
      {selectedIds.size > 0 && (
        <div className="bg-indigo-50 dark:bg-indigo-900/20 border border-indigo-200 dark:border-indigo-800 rounded-xl p-3 flex items-center justify-between">
          <span className="text-sm text-indigo-700 dark:text-indigo-400 font-medium">
            {selectedIds.size}件選択中
          </span>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setSelectedIds(new Set())}
              className="px-3 py-1.5 text-sm text-slate-600 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200"
            >
              選択解除
            </button>
            <button
              onClick={handleBulkDelete}
              disabled={bulkDeleting}
              className="px-3 py-1.5 text-sm bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50"
            >
              {bulkDeleting ? '削除中...' : '一括削除'}
            </button>
          </div>
        </div>
      )}

      {/* 予約投稿一覧 */}
      <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-700 overflow-hidden">
        {/* フィルタータブ（投稿がある場合のみ） */}
        {posts.length > 0 && (
          <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-700 px-4 py-2">
            <div className="flex items-center gap-1">
              {filterTabs.map(tab => (
                <button
                  key={tab.key}
                  onClick={() => setStatusFilter(tab.key)}
                  className={`px-3 py-1.5 text-xs rounded-lg transition-colors ${
                    statusFilter === tab.key
                      ? 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-400 font-medium'
                      : 'text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800'
                  }`}
                >
                  {tab.label} ({tab.count})
                </button>
              ))}
            </div>
            {filteredPosts.some(p => p.status === 'pending') && (
              <button
                onClick={toggleSelectAll}
                className="text-xs text-slate-500 hover:text-indigo-600 dark:hover:text-indigo-400"
              >
                {selectedIds.size === filteredPosts.filter(p => p.status === 'pending').length && filteredPosts.filter(p => p.status === 'pending').length > 0
                  ? '全解除'
                  : '全選択'}
              </button>
            )}
          </div>
        )}

        {loading ? (
          <div className="p-8 text-center">
            <div className="w-8 h-8 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin mx-auto" />
            <p className="text-slate-500 mt-2">読み込み中...</p>
          </div>
        ) : filteredPosts.length === 0 ? (
          <div className="p-8 text-center">
            <div className="w-16 h-16 bg-slate-100 dark:bg-slate-800 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg className="w-8 h-8 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
            </div>
            <p className="text-slate-600 dark:text-slate-400 font-medium">
              {statusFilter === 'all' ? '予約投稿がありません' : `${filterTabs.find(t => t.key === statusFilter)?.label}の投稿はありません`}
            </p>
            {statusFilter === 'all' && (
              <p className="text-sm text-slate-500 mt-1">
                「新規予約」ボタンまたは「CSVインポート」から投稿を予約できます
              </p>
            )}
          </div>
        ) : (
          <div className="divide-y divide-slate-200 dark:divide-slate-700">
            {filteredPosts
              .sort((a, b) => new Date(a.scheduledAt).getTime() - new Date(b.scheduledAt).getTime())
              .map((post) => (
                <div key={post.id} className="p-4 hover:bg-slate-50 dark:hover:bg-slate-800">
                  {/* 編集モード */}
                  {editingId === post.id ? (
                    <div className="space-y-3">
                      <textarea
                        value={editText}
                        onChange={(e) => setEditText(e.target.value)}
                        className="w-full px-3 py-2 border border-slate-200 dark:border-slate-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 h-24 resize-none dark:bg-slate-900 dark:text-white"
                        maxLength={500}
                      />
                      <p className="text-xs text-slate-400 text-right">{editText.length}/500</p>
                      <div className="grid grid-cols-2 gap-3">
                        <input
                          type="date"
                          value={editDate}
                          onChange={(e) => setEditDate(e.target.value)}
                          min={getMinDate()}
                          className="px-3 py-2 border border-slate-200 dark:border-slate-700 rounded-lg dark:bg-slate-900 dark:text-white text-sm"
                        />
                        <input
                          type="time"
                          value={editTime}
                          onChange={(e) => setEditTime(e.target.value)}
                          className="px-3 py-2 border border-slate-200 dark:border-slate-700 rounded-lg dark:bg-slate-900 dark:text-white text-sm"
                        />
                      </div>
                      <div className="flex justify-end gap-2">
                        <button
                          onClick={() => setEditingId(null)}
                          className="px-3 py-1.5 text-sm text-slate-600 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200"
                        >
                          キャンセル
                        </button>
                        <button
                          onClick={handleSaveEdit}
                          disabled={saving || !editText.trim() || !editDate || !editTime}
                          className="px-3 py-1.5 text-sm bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50"
                        >
                          {saving ? '保存中...' : '保存'}
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex items-start gap-3 flex-1 min-w-0">
                        {/* チェックボックス（pending のみ） */}
                        {post.status === 'pending' && (
                          <input
                            type="checkbox"
                            checked={selectedIds.has(post.id)}
                            onChange={() => toggleSelect(post.id)}
                            className="mt-1 w-4 h-4 text-indigo-600 rounded border-slate-300 dark:border-slate-600 focus:ring-indigo-500"
                          />
                        )}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-2">
                            {getStatusBadge(post.status)}
                            <span className="text-sm text-slate-500">
                              {formatDateTime(post.scheduledAt)}
                            </span>
                            {post.type && post.type !== 'text' && (
                              <span className="px-2 py-0.5 text-xs rounded bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400">
                                {getTypeLabel(post.type)}
                              </span>
                            )}
                          </div>
                          <p className="text-slate-900 dark:text-white whitespace-pre-wrap break-words">
                            {getPostDisplayText(post)}
                          </p>
                          {post.errorMessage && (
                            <p className="text-sm text-red-600 dark:text-red-400 mt-2">
                              エラー: {post.errorMessage}
                            </p>
                          )}
                        </div>
                      </div>
                      {post.status === 'pending' && (
                        <div className="flex items-center gap-1">
                          <button
                            onClick={() => startEdit(post)}
                            className="p-2 text-slate-400 hover:text-indigo-500 transition-colors"
                            title="編集"
                          >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                            </svg>
                          </button>
                          <button
                            onClick={() => handleDeletePost(post.id)}
                            className="p-2 text-slate-400 hover:text-red-500 transition-colors"
                            title="削除"
                          >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                            </svg>
                          </button>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              ))}
          </div>
        )}
      </div>

      {/* CSVインポートモーダル */}
      {accountId && (
        <CsvImportModal
          isOpen={showCsvImport}
          onClose={() => setShowCsvImport(false)}
          accountId={accountId}
          onImportComplete={() => {
            fetchScheduledPosts();
            if (onRefresh) onRefresh();
          }}
        />
      )}
    </div>
  );
}
