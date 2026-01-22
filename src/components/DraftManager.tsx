'use client';

import { useState, useEffect } from 'react';

interface Draft {
  id: string;
  title: string | null;
  text: string | null;
  type: string;
  mediaUrls: string | null;
  createdAt: string;
  updatedAt: string;
}

interface DraftManagerProps {
  accessToken: string;
  onSelectDraft?: (draft: Draft) => void;
  onRefresh?: () => void;
  maxDrafts?: number;
}

export function DraftManager({ accessToken, onSelectDraft, onRefresh, maxDrafts = -1 }: DraftManagerProps) {
  const [drafts, setDrafts] = useState<Draft[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // 新規作成/編集用
  const [showEditor, setShowEditor] = useState(false);
  const [editingDraft, setEditingDraft] = useState<Draft | null>(null);
  const [draftTitle, setDraftTitle] = useState('');
  const [draftText, setDraftText] = useState('');
  const [saving, setSaving] = useState(false);

  // localStorageから読み込み
  const fetchDrafts = () => {
    setLoading(true);
    setError(null);
    try {
      const saved = localStorage.getItem('drafts');
      if (saved) {
        setDrafts(JSON.parse(saved));
      } else {
        setDrafts([]);
      }
    } catch {
      setError('読み込みに失敗しました');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDrafts();
  }, [accessToken]);

  // 保存
  const saveDrafts = (newDrafts: Draft[]) => {
    setDrafts(newDrafts);
    localStorage.setItem('drafts', JSON.stringify(newDrafts));
  };

  // 下書きを保存
  const handleSave = () => {
    if (!draftText.trim()) return;

    // 制限チェック
    if (maxDrafts !== -1 && drafts.length >= maxDrafts && !editingDraft) {
      setError(`下書きは最大${maxDrafts}件までです`);
      return;
    }

    setSaving(true);
    setError(null);

    try {
      const now = new Date().toISOString();
      const newDraft: Draft = {
        id: editingDraft?.id || `draft-${Date.now()}`,
        title: draftTitle || null,
        text: draftText,
        type: 'text',
        mediaUrls: null,
        createdAt: editingDraft?.createdAt || now,
        updatedAt: now,
      };

      if (editingDraft) {
        saveDrafts(drafts.map(d => d.id === editingDraft.id ? newDraft : d));
      } else {
        saveDrafts([newDraft, ...drafts]);
      }

      setShowEditor(false);
      setEditingDraft(null);
      setDraftTitle('');
      setDraftText('');
      if (onRefresh) onRefresh();
    } catch {
      setError('保存に失敗しました');
    } finally {
      setSaving(false);
    }
  };

  // 下書きを削除
  const handleDelete = (id: string) => {
    if (!confirm('この下書きを削除しますか？')) return;
    saveDrafts(drafts.filter(d => d.id !== id));
    if (onRefresh) onRefresh();
  };

  // 編集開始
  const startEdit = (draft: Draft) => {
    setEditingDraft(draft);
    setDraftTitle(draft.title || '');
    setDraftText(draft.text || '');
    setShowEditor(true);
  };

  // 新規作成開始
  const startNew = () => {
    setEditingDraft(null);
    setDraftTitle('');
    setDraftText('');
    setShowEditor(true);
  };

  return (
    <div className="space-y-6">
      {/* ヘッダー */}
      <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-700 p-5">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-lg font-bold text-slate-900 dark:text-white">下書き管理</h2>
            <p className="text-sm text-slate-500 mt-1">
              投稿前に下書きを保存して管理できます
              {maxDrafts !== -1 && (
                <span className="ml-2 text-amber-600">
                  ({drafts.length}/{maxDrafts}件)
                </span>
              )}
            </p>
          </div>
          <div className="flex gap-2">
            <button
              onClick={startNew}
              disabled={maxDrafts !== -1 && drafts.length >= maxDrafts}
              className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 text-sm font-medium disabled:opacity-50"
            >
              + 新規下書き
            </button>
            <button
              onClick={fetchDrafts}
              disabled={loading}
              className="px-4 py-2 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 rounded-lg hover:bg-slate-200 dark:hover:bg-slate-700 text-sm disabled:opacity-50"
            >
              更新
            </button>
          </div>
        </div>

        {error && (
          <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-600">
            {error}
          </div>
        )}
      </div>

      {/* 下書きエディター */}
      {showEditor && (
        <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-700 p-5">
          <h3 className="font-semibold text-slate-900 dark:text-white mb-4">
            {editingDraft ? '下書きを編集' : '新規下書き'}
          </h3>
          <div className="space-y-4">
            <div>
              <label className="block text-sm text-slate-600 dark:text-slate-400 mb-1">タイトル（任意）</label>
              <input
                type="text"
                value={draftTitle}
                onChange={(e) => setDraftTitle(e.target.value)}
                placeholder="管理用のタイトル..."
                className="w-full px-3 py-2 border border-slate-200 dark:border-slate-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 dark:bg-slate-800"
              />
            </div>
            <div>
              <label className="block text-sm text-slate-600 dark:text-slate-400 mb-1">投稿内容</label>
              <textarea
                value={draftText}
                onChange={(e) => setDraftText(e.target.value)}
                placeholder="投稿内容を入力..."
                className="w-full px-3 py-2 border border-slate-200 dark:border-slate-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 h-32 resize-none dark:bg-slate-800"
                maxLength={500}
              />
              <p className="text-xs text-slate-400 mt-1 text-right">{draftText.length}/500</p>
            </div>
            <div className="flex justify-end gap-2">
              <button
                onClick={() => {
                  setShowEditor(false);
                  setEditingDraft(null);
                }}
                className="px-4 py-2 text-slate-600 hover:text-slate-800"
              >
                キャンセル
              </button>
              <button
                onClick={handleSave}
                disabled={saving || !draftText.trim()}
                className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50"
              >
                {saving ? '保存中...' : '保存'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 下書き一覧 */}
      <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-700 overflow-hidden">
        {loading ? (
          <div className="p-8 text-center">
            <div className="w-8 h-8 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin mx-auto" />
            <p className="text-slate-500 mt-2">読み込み中...</p>
          </div>
        ) : drafts.length === 0 ? (
          <div className="p-8 text-center">
            <div className="w-16 h-16 bg-slate-100 dark:bg-slate-800 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg className="w-8 h-8 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
            </div>
            <p className="text-slate-600 dark:text-slate-400 font-medium">下書きがありません</p>
            <p className="text-sm text-slate-500 mt-1">上の「新規下書き」ボタンから作成できます</p>
          </div>
        ) : (
          <div className="divide-y divide-slate-200 dark:divide-slate-700">
            {drafts.map((draft) => (
              <div key={draft.id} className="p-4 hover:bg-slate-50 dark:hover:bg-slate-800">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    {draft.title && (
                      <p className="font-medium text-slate-900 dark:text-white mb-1">{draft.title}</p>
                    )}
                    <p className="text-slate-600 dark:text-slate-400 whitespace-pre-wrap break-words line-clamp-3">
                      {draft.text}
                    </p>
                    <p className="text-xs text-slate-400 mt-2">
                      更新: {new Date(draft.updatedAt).toLocaleString('ja-JP')}
                    </p>
                  </div>
                  <div className="flex items-center gap-1">
                    {onSelectDraft && (
                      <button
                        onClick={() => onSelectDraft(draft)}
                        className="px-3 py-1.5 text-sm bg-indigo-100 text-indigo-700 rounded-lg hover:bg-indigo-200"
                      >
                        使用
                      </button>
                    )}
                    <button
                      onClick={() => startEdit(draft)}
                      className="p-2 text-slate-400 hover:text-slate-600"
                      title="編集"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                      </svg>
                    </button>
                    <button
                      onClick={() => handleDelete(draft.id)}
                      className="p-2 text-slate-400 hover:text-red-500"
                      title="削除"
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
