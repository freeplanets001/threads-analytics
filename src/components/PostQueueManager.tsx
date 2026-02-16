'use client';

import { useState } from 'react';

interface BestHour {
  hour: number;
  avgEngagement: number;
}

interface PostQueueManagerProps {
  accountId: string;
  bestPostingHours?: BestHour[];
  onRefresh?: () => void;
}

interface QueueItem {
  id: string;
  text: string;
  status: 'queued' | 'scheduled' | 'error';
  scheduledAt?: string;
  errorMessage?: string;
}

const DEFAULT_SLOTS = [
  { hour: 8, minute: 0 },
  { hour: 12, minute: 0 },
  { hour: 18, minute: 0 },
  { hour: 21, minute: 0 },
];

export function PostQueueManager({ accountId, bestPostingHours, onRefresh }: PostQueueManagerProps) {
  const [queueItems, setQueueItems] = useState<QueueItem[]>([]);
  const [newText, setNewText] = useState('');
  const [scheduling, setScheduling] = useState(false);
  const [slots, setSlots] = useState(() => {
    // ベストタイムがあればそれを使用、なければデフォルト
    if (bestPostingHours && bestPostingHours.length >= 3) {
      return bestPostingHours.slice(0, 4).map(h => ({ hour: h.hour, minute: 0 }));
    }
    return DEFAULT_SLOTS;
  });
  const [showSlotEditor, setShowSlotEditor] = useState(false);

  const addToQueue = () => {
    if (!newText.trim()) return;
    setQueueItems(prev => [...prev, {
      id: `q-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      text: newText.trim(),
      status: 'queued',
    }]);
    setNewText('');
  };

  const removeFromQueue = (id: string) => {
    setQueueItems(prev => prev.filter(item => item.id !== id));
  };

  const moveItem = (id: string, direction: 'up' | 'down') => {
    setQueueItems(prev => {
      const idx = prev.findIndex(i => i.id === id);
      if (idx < 0) return prev;
      const newIdx = direction === 'up' ? idx - 1 : idx + 1;
      if (newIdx < 0 || newIdx >= prev.length) return prev;
      const copy = [...prev];
      [copy[idx], copy[newIdx]] = [copy[newIdx], copy[idx]];
      return copy;
    });
  };

  // 次の空きスロットを計算
  const calculateNextSlots = (count: number): Date[] => {
    const result: Date[] = [];
    const now = new Date();
    let currentDate = new Date(now);
    // 今日のまだ来ていないスロットから埋める
    let slotsPerDay = slots.length;
    let maxDays = Math.ceil(count / slotsPerDay) + 1;

    for (let d = 0; d < maxDays && result.length < count; d++) {
      for (const slot of slots) {
        if (result.length >= count) break;
        const dt = new Date(currentDate);
        dt.setHours(slot.hour, slot.minute, 0, 0);
        // 5分以上先のスロットのみ
        if (dt.getTime() > now.getTime() + 5 * 60 * 1000) {
          result.push(dt);
        }
      }
      currentDate.setDate(currentDate.getDate() + 1);
      currentDate.setHours(0, 0, 0, 0);
    }

    return result;
  };

  const scheduleAll = async () => {
    const pendingItems = queueItems.filter(i => i.status === 'queued');
    if (pendingItems.length === 0) return;

    setScheduling(true);
    const nextSlots = calculateNextSlots(pendingItems.length);

    for (let i = 0; i < pendingItems.length; i++) {
      const item = pendingItems[i];
      const scheduledAt = nextSlots[i];

      if (!scheduledAt) {
        setQueueItems(prev => prev.map(q =>
          q.id === item.id ? { ...q, status: 'error' as const, errorMessage: 'スロット不足' } : q
        ));
        continue;
      }

      try {
        const res = await fetch('/api/scheduled', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            accountId,
            type: 'text',
            text: item.text,
            scheduledAt: scheduledAt.toISOString(),
          }),
        });

        if (res.ok) {
          setQueueItems(prev => prev.map(q =>
            q.id === item.id ? { ...q, status: 'scheduled' as const, scheduledAt: scheduledAt.toISOString() } : q
          ));
        } else {
          const data = await res.json();
          setQueueItems(prev => prev.map(q =>
            q.id === item.id ? { ...q, status: 'error' as const, errorMessage: data.error } : q
          ));
        }
      } catch {
        setQueueItems(prev => prev.map(q =>
          q.id === item.id ? { ...q, status: 'error' as const, errorMessage: '通信エラー' } : q
        ));
      }
    }

    setScheduling(false);
    onRefresh?.();
  };

  const clearCompleted = () => {
    setQueueItems(prev => prev.filter(i => i.status === 'queued'));
  };

  const pendingCount = queueItems.filter(i => i.status === 'queued').length;
  const scheduledCount = queueItems.filter(i => i.status === 'scheduled').length;

  const formatSlotTime = (hour: number, minute: number) =>
    `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;

  return (
    <div className="space-y-6">
      {/* ヘッダー */}
      <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-700 p-5">
        <h2 className="text-lg font-bold text-slate-900 dark:text-slate-100 mb-1">投稿キュー</h2>
        <p className="text-sm text-slate-500 dark:text-slate-400">
          複数の投稿をキューに追加し、最適な時間帯に自動で予約投稿します
        </p>
      </div>

      {/* タイムスロット設定 */}
      <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-700 p-5">
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-semibold text-slate-900 dark:text-slate-100">投稿スロット</h3>
          <button
            onClick={() => setShowSlotEditor(!showSlotEditor)}
            className="text-sm text-indigo-600 dark:text-indigo-400 hover:underline"
          >
            {showSlotEditor ? '閉じる' : '編集'}
          </button>
        </div>
        <div className="flex flex-wrap gap-2 mb-3">
          {slots.map((slot, i) => (
            <div key={i} className="flex items-center gap-1.5 px-3 py-1.5 bg-indigo-50 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-300 rounded-lg text-sm font-medium">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
              {formatSlotTime(slot.hour, slot.minute)}
            </div>
          ))}
        </div>
        {bestPostingHours && bestPostingHours.length > 0 && (
          <p className="text-xs text-slate-500 dark:text-slate-400">
            * 分析データに基づく最適時間帯を使用中
          </p>
        )}

        {showSlotEditor && (
          <div className="mt-3 pt-3 border-t border-slate-200 dark:border-slate-700 space-y-3">
            {slots.map((slot, i) => (
              <div key={i} className="flex items-center gap-2">
                <span className="text-sm text-slate-500 w-16">スロット {i + 1}</span>
                <input
                  type="time"
                  value={formatSlotTime(slot.hour, slot.minute)}
                  onChange={(e) => {
                    const [h, m] = e.target.value.split(':').map(Number);
                    setSlots(prev => prev.map((s, idx) => idx === i ? { hour: h, minute: m } : s));
                  }}
                  className="px-3 py-1.5 border border-slate-200 dark:border-slate-600 rounded-lg text-sm bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100"
                />
                {slots.length > 1 && (
                  <button
                    onClick={() => setSlots(prev => prev.filter((_, idx) => idx !== i))}
                    className="text-red-500 hover:text-red-700 text-sm"
                  >
                    削除
                  </button>
                )}
              </div>
            ))}
            {slots.length < 6 && (
              <button
                onClick={() => setSlots(prev => [...prev, { hour: 12, minute: 0 }])}
                className="text-sm text-indigo-600 dark:text-indigo-400 hover:underline"
              >
                + スロット追加
              </button>
            )}
          </div>
        )}
      </div>

      {/* 投稿追加 */}
      <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-700 p-5">
        <h3 className="font-semibold text-slate-900 dark:text-slate-100 mb-3">キューに追加</h3>
        <textarea
          value={newText}
          onChange={(e) => setNewText(e.target.value)}
          placeholder="投稿テキストを入力..."
          className="w-full px-3 py-2 border border-slate-200 dark:border-slate-600 rounded-lg h-24 resize-none text-sm bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500"
        />
        <div className="flex items-center justify-between mt-3">
          <span className="text-xs text-slate-500 dark:text-slate-400">{newText.length}/500</span>
          <button
            onClick={addToQueue}
            disabled={!newText.trim() || newText.length > 500}
            className="px-4 py-2 bg-indigo-600 text-white text-sm rounded-lg hover:bg-indigo-700 disabled:opacity-50"
          >
            キューに追加
          </button>
        </div>
      </div>

      {/* キュー一覧 */}
      {queueItems.length > 0 && (
        <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-700 overflow-hidden">
          <div className="px-5 py-4 border-b border-slate-200 dark:border-slate-700 flex items-center justify-between">
            <div>
              <h3 className="font-semibold text-slate-900 dark:text-slate-100">
                キュー ({pendingCount}件待機 / {scheduledCount}件予約済み)
              </h3>
            </div>
            <div className="flex gap-2">
              {scheduledCount > 0 && (
                <button
                  onClick={clearCompleted}
                  className="px-3 py-1.5 text-xs text-slate-600 dark:text-slate-300 bg-slate-100 dark:bg-slate-800 rounded-lg hover:bg-slate-200 dark:hover:bg-slate-700"
                >
                  完了を削除
                </button>
              )}
              {pendingCount > 0 && (
                <button
                  onClick={scheduleAll}
                  disabled={scheduling}
                  className="px-4 py-1.5 text-sm bg-violet-600 text-white rounded-lg hover:bg-violet-700 disabled:opacity-50"
                >
                  {scheduling ? '予約中...' : `${pendingCount}件を一括予約`}
                </button>
              )}
            </div>
          </div>

          <div className="divide-y divide-slate-100 dark:divide-slate-800">
            {queueItems.map((item, idx) => (
              <div key={item.id} className="px-5 py-3 flex items-start gap-3">
                {/* Status dot */}
                <div className={`mt-1.5 w-2.5 h-2.5 rounded-full flex-shrink-0 ${
                  item.status === 'queued' ? 'bg-amber-400' :
                  item.status === 'scheduled' ? 'bg-green-500' :
                  'bg-red-500'
                }`} />

                {/* Content */}
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-slate-800 dark:text-slate-200 whitespace-pre-wrap line-clamp-3">{item.text}</p>
                  {item.scheduledAt && (
                    <p className="text-xs text-green-600 dark:text-green-400 mt-1">
                      予約済み: {new Date(item.scheduledAt).toLocaleString('ja-JP', {
                        month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit'
                      })}
                    </p>
                  )}
                  {item.errorMessage && (
                    <p className="text-xs text-red-600 dark:text-red-400 mt-1">エラー: {item.errorMessage}</p>
                  )}
                </div>

                {/* Actions */}
                {item.status === 'queued' && (
                  <div className="flex items-center gap-1 flex-shrink-0">
                    <button
                      onClick={() => moveItem(item.id, 'up')}
                      disabled={idx === 0 || queueItems[idx - 1]?.status !== 'queued'}
                      className="p-1 text-slate-400 hover:text-slate-600 disabled:opacity-30"
                      title="上に移動"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" /></svg>
                    </button>
                    <button
                      onClick={() => moveItem(item.id, 'down')}
                      disabled={idx === queueItems.length - 1 || queueItems[idx + 1]?.status !== 'queued'}
                      className="p-1 text-slate-400 hover:text-slate-600 disabled:opacity-30"
                      title="下に移動"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
                    </button>
                    <button
                      onClick={() => removeFromQueue(item.id)}
                      className="p-1 text-slate-400 hover:text-red-500"
                      title="削除"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 空状態 */}
      {queueItems.length === 0 && (
        <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-700 p-8 text-center">
          <p className="text-slate-500 dark:text-slate-400 mb-2">キューに投稿がありません</p>
          <p className="text-xs text-slate-400 dark:text-slate-500">上のフォームから投稿テキストを追加してください</p>
        </div>
      )}
    </div>
  );
}
