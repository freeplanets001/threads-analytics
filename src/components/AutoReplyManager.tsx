'use client';

import { useState, useEffect, useCallback } from 'react';

interface AutoReplyRule {
  id: string;
  name: string;
  isActive: boolean;
  accountId: string;
  triggerType: 'keyword' | 'mention' | 'all';
  triggerKeywords: string | null;
  responseType: string;
  responseText: string;
  responseDelay: number;
  onlyNewFollowers: boolean;
  excludeFollowing: boolean;
  maxRepliesPerDay: number;
  totalReplies: number;
  todayReplies: number;
  lastReplyAt: string | null;
  createdAt: string;
}

// ローカル用の形式
interface LocalAutoReplyRule {
  id: string;
  name: string;
  isActive: boolean;
  trigger: {
    type: 'keyword' | 'mention' | 'all';
    keywords?: string[];
  };
  response: {
    type: 'fixed' | 'template';
    text: string;
    delay: number;
  };
  conditions: {
    onlyNewFollowers?: boolean;
    excludeFollowing?: boolean;
    maxRepliesPerDay?: number;
  };
  stats: {
    totalReplies: number;
    todayReplies: number;
    lastReplyAt?: string;
  };
  createdAt: string;
}

interface AutoReplyManagerProps {
  accessToken: string;
  accountId?: string;
  onRefresh?: () => void;
}

// API形式とローカル形式の変換
function apiToLocal(rule: AutoReplyRule): LocalAutoReplyRule {
  return {
    id: rule.id,
    name: rule.name,
    isActive: rule.isActive,
    trigger: {
      type: rule.triggerType,
      keywords: rule.triggerKeywords ? JSON.parse(rule.triggerKeywords) : undefined,
    },
    response: {
      type: rule.responseType as 'fixed' | 'template',
      text: rule.responseText,
      delay: rule.responseDelay,
    },
    conditions: {
      onlyNewFollowers: rule.onlyNewFollowers,
      excludeFollowing: rule.excludeFollowing,
      maxRepliesPerDay: rule.maxRepliesPerDay,
    },
    stats: {
      totalReplies: rule.totalReplies,
      todayReplies: rule.todayReplies,
      lastReplyAt: rule.lastReplyAt || undefined,
    },
    createdAt: rule.createdAt,
  };
}

export function AutoReplyManager({ accessToken, accountId, onRefresh }: AutoReplyManagerProps) {
  const [rules, setRules] = useState<LocalAutoReplyRule[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showEditor, setShowEditor] = useState(false);
  const [editingRule, setEditingRule] = useState<LocalAutoReplyRule | null>(null);
  const [saving, setSaving] = useState(false);
  const [useApi, setUseApi] = useState(false);

  // フォーム状態
  const [name, setName] = useState('');
  const [triggerType, setTriggerType] = useState<'keyword' | 'mention' | 'all'>('keyword');
  const [keywords, setKeywords] = useState('');
  const [responseText, setResponseText] = useState('');
  const [delay, setDelay] = useState(60);
  const [onlyNewFollowers, setOnlyNewFollowers] = useState(false);
  const [excludeFollowing, setExcludeFollowing] = useState(false);
  const [maxRepliesPerDay, setMaxRepliesPerDay] = useState(50);

  // ローカルルールをAPIにマイグレーション
  const migrateLocalRulesToApi = useCallback(async (localRules: LocalAutoReplyRule[]) => {
    if (!accountId) return;

    for (const rule of localRules) {
      try {
        await fetch('/api/autoreply/rules', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            accountId,
            name: rule.name,
            isActive: rule.isActive,
            triggerType: rule.trigger.type,
            triggerKeywords: rule.trigger.keywords,
            responseType: rule.response.type,
            responseText: rule.response.text,
            responseDelay: rule.response.delay,
            onlyNewFollowers: rule.conditions.onlyNewFollowers,
            excludeFollowing: rule.conditions.excludeFollowing,
            maxRepliesPerDay: rule.conditions.maxRepliesPerDay,
          }),
        });
      } catch (e) {
        console.error('Failed to migrate rule:', e);
      }
    }
    // マイグレーション完了後、ローカルストレージをクリア
    localStorage.removeItem('auto_reply_rules');
  }, [accountId]);

  // 読み込み
  const fetchRules = useCallback(async () => {
    setLoading(true);
    setError(null);

    // APIから取得を試みる
    if (accountId) {
      try {
        const response = await fetch(`/api/autoreply/rules?accountId=${accountId}`);
        if (response.ok) {
          const data = await response.json();
          const apiRules = data.map(apiToLocal);

          // APIが空でローカルストレージにルールがある場合、マイグレーション
          if (apiRules.length === 0) {
            const saved = localStorage.getItem('auto_reply_rules');
            if (saved) {
              const localRules = JSON.parse(saved) as LocalAutoReplyRule[];
              if (localRules.length > 0) {
                console.log('Migrating local rules to API...');
                await migrateLocalRulesToApi(localRules);
                // マイグレーション後、再取得
                const refreshResponse = await fetch(`/api/autoreply/rules?accountId=${accountId}`);
                if (refreshResponse.ok) {
                  const refreshData = await refreshResponse.json();
                  setRules(refreshData.map(apiToLocal));
                  setUseApi(true);
                  setLoading(false);
                  return;
                }
              }
            }
          }

          setRules(apiRules);
          setUseApi(true);
          setLoading(false);
          return;
        }
      } catch (e) {
        console.log('API not available, falling back to localStorage', e);
      }
    }

    // ローカルストレージから読み込み
    try {
      const saved = localStorage.getItem('auto_reply_rules');
      if (saved) {
        setRules(JSON.parse(saved));
      }
      setUseApi(false);
    } catch (e) {
      setError('読み込みに失敗しました');
      console.error(e);
    }
    setLoading(false);
  }, [accountId, migrateLocalRulesToApi]);

  useEffect(() => {
    fetchRules();
  }, [fetchRules]);

  // ローカル保存
  const saveToLocal = (newRules: LocalAutoReplyRule[]) => {
    setRules(newRules);
    localStorage.setItem('auto_reply_rules', JSON.stringify(newRules));
  };

  // ルールを保存
  const handleSave = async () => {
    if (!name.trim() || !responseText.trim()) return;

    setSaving(true);
    setError(null);

    const keywordsList = triggerType === 'keyword'
      ? keywords.split(',').map(k => k.trim()).filter(Boolean)
      : undefined;

    // APIに保存を試みる
    if (useApi && accountId) {
      try {
        const body = {
          accountId,
          name,
          isActive: editingRule?.isActive ?? true,
          triggerType,
          triggerKeywords: keywordsList,
          responseType: 'fixed',
          responseText,
          responseDelay: delay,
          onlyNewFollowers,
          excludeFollowing,
          maxRepliesPerDay,
        };

        let response;
        if (editingRule) {
          response = await fetch(`/api/autoreply/rules/${editingRule.id}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body),
          });
        } else {
          response = await fetch('/api/autoreply/rules', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body),
          });
        }

        if (response.ok) {
          await fetchRules();
          resetForm();
          setShowEditor(false);
          setSaving(false);
          if (onRefresh) onRefresh();
          return;
        }
      } catch (e) {
        console.error('API save failed, falling back to localStorage', e);
      }
    }

    // ローカルストレージに保存
    const newRule: LocalAutoReplyRule = {
      id: editingRule?.id || `rule-${Date.now()}`,
      name,
      isActive: editingRule?.isActive ?? true,
      trigger: {
        type: triggerType,
        keywords: keywordsList,
      },
      response: {
        type: 'fixed',
        text: responseText,
        delay,
      },
      conditions: {
        onlyNewFollowers,
        excludeFollowing,
        maxRepliesPerDay,
      },
      stats: editingRule?.stats || {
        totalReplies: 0,
        todayReplies: 0,
      },
      createdAt: editingRule?.createdAt || new Date().toISOString(),
    };

    if (editingRule) {
      saveToLocal(rules.map(r => r.id === editingRule.id ? newRule : r));
    } else {
      saveToLocal([...rules, newRule]);
    }

    resetForm();
    setShowEditor(false);
    setSaving(false);
    if (onRefresh) onRefresh();
  };

  // 削除
  const handleDelete = async (id: string) => {
    if (!confirm('このルールを削除しますか？')) return;

    // APIから削除を試みる
    if (useApi) {
      try {
        const response = await fetch(`/api/autoreply/rules/${id}`, {
          method: 'DELETE',
        });
        if (response.ok) {
          await fetchRules();
          return;
        }
      } catch (e) {
        console.error('API delete failed', e);
      }
    }

    saveToLocal(rules.filter(r => r.id !== id));
  };

  // 有効/無効切替
  const toggleActive = async (id: string) => {
    const rule = rules.find(r => r.id === id);
    if (!rule) return;

    // APIで更新を試みる
    if (useApi) {
      try {
        const response = await fetch(`/api/autoreply/rules/${id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ isActive: !rule.isActive }),
        });
        if (response.ok) {
          await fetchRules();
          return;
        }
      } catch (e) {
        console.error('API toggle failed', e);
      }
    }

    saveToLocal(rules.map(r =>
      r.id === id ? { ...r, isActive: !r.isActive } : r
    ));
  };

  // フォームリセット
  const resetForm = () => {
    setName('');
    setTriggerType('keyword');
    setKeywords('');
    setResponseText('');
    setDelay(60);
    setOnlyNewFollowers(false);
    setExcludeFollowing(false);
    setMaxRepliesPerDay(50);
    setEditingRule(null);
  };

  // 編集開始
  const startEdit = (rule: LocalAutoReplyRule) => {
    setEditingRule(rule);
    setName(rule.name);
    setTriggerType(rule.trigger.type);
    setKeywords(rule.trigger.keywords?.join(', ') || '');
    setResponseText(rule.response.text);
    setDelay(rule.response.delay);
    setOnlyNewFollowers(rule.conditions.onlyNewFollowers || false);
    setExcludeFollowing(rule.conditions.excludeFollowing || false);
    setMaxRepliesPerDay(rule.conditions.maxRepliesPerDay || 50);
    setShowEditor(true);
  };

  // トリガータイプのラベル
  const getTriggerLabel = (rule: LocalAutoReplyRule) => {
    switch (rule.trigger.type) {
      case 'keyword':
        return `キーワード: ${rule.trigger.keywords?.slice(0, 3).join(', ')}${(rule.trigger.keywords?.length || 0) > 3 ? '...' : ''}`;
      case 'mention':
        return 'メンション時';
      case 'all':
        return '全てのリプライ';
      default:
        return '';
    }
  };

  return (
    <div className="space-y-6">
      {/* ヘッダー */}
      <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-700 p-5">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-lg font-bold text-slate-900 dark:text-white">自動リプライ</h2>
            <p className="text-sm text-slate-500 mt-1">
              特定の条件に一致するリプライに自動で返信します
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
              + 新規ルール
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
                <strong>サーバー連携有効:</strong> 自動リプライはサーバー側で定期実行されます。
                Vercel Pro プランにアップグレードすると、5分ごとの自動実行が可能になります。
              </>
            ) : (
              <>
                <strong>ローカルモード:</strong> データベースに接続されていないため、ルールはブラウザに保存されます。
                本番運用にはデータベース接続が必要です。
              </>
            )}
          </p>
        </div>
      </div>

      {/* エディター */}
      {showEditor && (
        <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-700 p-5">
          <h3 className="font-semibold text-slate-900 dark:text-white mb-4">
            {editingRule ? 'ルールを編集' : '新規ルール'}
          </h3>
          <div className="space-y-4">
            <div>
              <label className="block text-sm text-slate-600 dark:text-slate-400 mb-1">ルール名</label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="例: ありがとう自動返信"
                className="w-full px-3 py-2 border border-slate-200 dark:border-slate-700 rounded-lg dark:bg-slate-800"
              />
            </div>

            <div>
              <label className="block text-sm text-slate-600 dark:text-slate-400 mb-1">トリガー条件</label>
              <select
                value={triggerType}
                onChange={(e) => setTriggerType(e.target.value as 'keyword' | 'mention' | 'all')}
                className="w-full px-3 py-2 border border-slate-200 dark:border-slate-700 rounded-lg dark:bg-slate-800"
              >
                <option value="keyword">特定のキーワードを含む</option>
                <option value="mention">メンションされた時</option>
                <option value="all">全てのリプライ（注意）</option>
              </select>
            </div>

            {triggerType === 'keyword' && (
              <div>
                <label className="block text-sm text-slate-600 dark:text-slate-400 mb-1">
                  キーワード（カンマ区切り）
                </label>
                <input
                  type="text"
                  value={keywords}
                  onChange={(e) => setKeywords(e.target.value)}
                  placeholder="ありがとう, 感謝, thanks"
                  className="w-full px-3 py-2 border border-slate-200 dark:border-slate-700 rounded-lg dark:bg-slate-800"
                />
              </div>
            )}

            <div>
              <label className="block text-sm text-slate-600 dark:text-slate-400 mb-1">
                返信メッセージ
                <span className="text-slate-400 ml-2">（{'{username}'} で相手の名前を挿入）</span>
              </label>
              <textarea
                value={responseText}
                onChange={(e) => setResponseText(e.target.value)}
                placeholder="@{username} リプライありがとうございます！"
                className="w-full px-3 py-2 border border-slate-200 dark:border-slate-700 rounded-lg dark:bg-slate-800 h-24 resize-none"
                maxLength={500}
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-sm text-slate-600 dark:text-slate-400 mb-1">
                  返信遅延（秒）
                </label>
                <input
                  type="number"
                  value={delay}
                  onChange={(e) => setDelay(Number(e.target.value))}
                  min={30}
                  max={300}
                  className="w-full px-3 py-2 border border-slate-200 dark:border-slate-700 rounded-lg dark:bg-slate-800"
                />
                <p className="text-xs text-slate-400 mt-1">30〜300秒</p>
              </div>

              <div>
                <label className="block text-sm text-slate-600 dark:text-slate-400 mb-1">
                  1日の最大返信数
                </label>
                <input
                  type="number"
                  value={maxRepliesPerDay}
                  onChange={(e) => setMaxRepliesPerDay(Number(e.target.value))}
                  min={1}
                  max={100}
                  className="w-full px-3 py-2 border border-slate-200 dark:border-slate-700 rounded-lg dark:bg-slate-800"
                />
              </div>
            </div>

            <div className="space-y-2">
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={onlyNewFollowers}
                  onChange={(e) => setOnlyNewFollowers(e.target.checked)}
                  className="w-4 h-4 rounded border-slate-300"
                />
                <span className="text-sm text-slate-600 dark:text-slate-400">
                  新規フォロワーのみに返信
                </span>
              </label>
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={excludeFollowing}
                  onChange={(e) => setExcludeFollowing(e.target.checked)}
                  className="w-4 h-4 rounded border-slate-300"
                />
                <span className="text-sm text-slate-600 dark:text-slate-400">
                  フォロー中のユーザーを除外
                </span>
              </label>
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
                disabled={saving || !name.trim() || !responseText.trim()}
                className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50"
              >
                {saving ? '保存中...' : '保存'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ルール一覧 */}
      <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-700 overflow-hidden">
        {loading ? (
          <div className="p-8 text-center">
            <div className="w-8 h-8 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin mx-auto" />
          </div>
        ) : rules.length === 0 ? (
          <div className="p-8 text-center">
            <div className="w-16 h-16 bg-slate-100 dark:bg-slate-800 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg className="w-8 h-8 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
              </svg>
            </div>
            <p className="text-slate-600 dark:text-slate-400 font-medium">自動リプライルールがありません</p>
            <p className="text-sm text-slate-500 mt-1">上の「新規ルール」ボタンから作成できます</p>
          </div>
        ) : (
          <div className="divide-y divide-slate-200 dark:divide-slate-700">
            {rules.map((rule) => (
              <div key={rule.id} className="p-4 hover:bg-slate-50 dark:hover:bg-slate-800">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className={`w-2 h-2 rounded-full ${rule.isActive ? 'bg-green-500' : 'bg-slate-300'}`} />
                      <p className="font-medium text-slate-900 dark:text-white">{rule.name}</p>
                    </div>
                    <p className="text-sm text-slate-500 mb-2">{getTriggerLabel(rule)}</p>
                    <div className="p-2 bg-slate-50 dark:bg-slate-800 rounded text-sm text-slate-600 dark:text-slate-400 line-clamp-2">
                      {rule.response.text}
                    </div>
                    <div className="mt-2 flex gap-4 text-xs text-slate-500">
                      <span>累計: {rule.stats.totalReplies}件</span>
                      <span>今日: {rule.stats.todayReplies}件</span>
                      <span>遅延: {rule.response.delay}秒</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => toggleActive(rule.id)}
                      className={`px-3 py-1.5 text-sm rounded-lg ${
                        rule.isActive
                          ? 'bg-green-100 text-green-700 hover:bg-green-200'
                          : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                      }`}
                    >
                      {rule.isActive ? '有効' : '無効'}
                    </button>
                    <button
                      onClick={() => startEdit(rule)}
                      className="p-2 text-slate-400 hover:text-slate-600"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                      </svg>
                    </button>
                    <button
                      onClick={() => handleDelete(rule.id)}
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

      {/* 使い方ガイド */}
      <div className="bg-slate-50 dark:bg-slate-800 rounded-xl p-5">
        <h3 className="font-medium text-slate-900 dark:text-white mb-3">使い方</h3>
        <ul className="text-sm text-slate-600 dark:text-slate-400 space-y-2">
          <li>1. 「新規ルール」でルールを作成</li>
          <li>2. トリガー条件を設定（キーワード、メンションなど）</li>
          <li>3. 返信メッセージを設定（{'{username}'} で相手の名前を挿入可能）</li>
          <li>4. ルールを有効にすると自動返信が開始</li>
        </ul>
        <div className="mt-4 p-3 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg">
          <p className="text-xs text-amber-700 dark:text-amber-400">
            <strong>ポーリング方式:</strong> 5分ごとに新着リプライをチェックし、条件に合致するものに自動返信します。
            Threads APIの制限により、短時間での大量リプライは制限される場合があります。
          </p>
        </div>
      </div>
    </div>
  );
}
