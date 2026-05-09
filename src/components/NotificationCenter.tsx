'use client';

import { useState, useEffect, useCallback, type ReactElement } from 'react';

// DB の通知テーブルと一致する型（type は文字列、自由形式）
export interface DbNotification {
  id: string;
  type: string;
  title: string;
  message: string;
  isRead: boolean;
  relatedId?: string | null;
  relatedType?: string | null;
  createdAt: string;
}

// UI 表示用カテゴリ（DB type 文字列を info/success/warning/error にマップ）
type UiCategory = 'info' | 'success' | 'warning' | 'error';

function mapToUiCategory(dbType: string): UiCategory {
  const t = (dbType || '').toLowerCase();
  if (t === 'success' || t === 'post_success' || t === 'report_ready') return 'success';
  if (t === 'warning' || t === 'token_expiring' || t === 'system') return 'warning';
  if (t === 'error' || t === 'post_failed' || t === 'token_failed' || t === 'autoreply_failed') return 'error';
  return 'info';
}

interface NotificationCenterProps {
  onClose: () => void;
}

const NOTIFICATION_ICONS: Record<UiCategory, ReactElement> = {
  info: (
    <svg className="w-5 h-5 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  ),
  success: (
    <svg className="w-5 h-5 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  ),
  warning: (
    <svg className="w-5 h-5 text-yellow-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
    </svg>
  ),
  error: (
    <svg className="w-5 h-5 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  ),
};

export function NotificationCenter({ onClose }: NotificationCenterProps) {
  const [notifications, setNotifications] = useState<DbNotification[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const res = await fetch('/api/notifications', { cache: 'no-store' });
      if (!res.ok) {
        throw new Error(`Failed to load (${res.status})`);
      }
      const data = await res.json();
      setNotifications(data.notifications ?? []);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load notifications');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  // 1件既読
  const markAsRead = async (id: string) => {
    setNotifications(prev => prev.map(n => (n.id === id ? { ...n, isRead: true } : n)));
    try {
      await fetch(`/api/notifications?id=${encodeURIComponent(id)}`, { method: 'PATCH' });
      window.dispatchEvent(new CustomEvent('notifications-updated'));
    } catch {
      // 失敗時は再読込で整合性を取る
      load();
    }
  };

  // すべて既読
  const markAllAsRead = async () => {
    setNotifications(prev => prev.map(n => ({ ...n, isRead: true })));
    try {
      await fetch('/api/notifications?all=1', { method: 'PATCH' });
      window.dispatchEvent(new CustomEvent('notifications-updated'));
    } catch {
      load();
    }
  };

  // 1件削除
  const deleteNotification = async (id: string) => {
    setNotifications(prev => prev.filter(n => n.id !== id));
    try {
      await fetch(`/api/notifications?id=${encodeURIComponent(id)}`, { method: 'DELETE' });
      window.dispatchEvent(new CustomEvent('notifications-updated'));
    } catch {
      load();
    }
  };

  // すべて削除
  const clearAll = async () => {
    setNotifications([]);
    try {
      await fetch('/api/notifications?all=1', { method: 'DELETE' });
      window.dispatchEvent(new CustomEvent('notifications-updated'));
    } catch {
      load();
    }
  };

  const unreadCount = notifications.filter(n => !n.isRead).length;

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(hours / 24);

    if (hours < 1) return 'たった今';
    if (hours < 24) return `${hours}時間前`;
    if (days < 7) return `${days}日前`;
    return date.toLocaleDateString('ja-JP');
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-start justify-end z-50 p-4">
      <div className="bg-white dark:bg-slate-900 rounded-2xl max-w-md w-full max-h-[80vh] overflow-hidden shadow-xl mt-16 mr-4">
        {/* ヘッダー */}
        <div className="p-4 border-b border-slate-200 dark:border-slate-700">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <h2 className="text-lg font-bold text-slate-900 dark:text-white">通知</h2>
              {unreadCount > 0 && (
                <span className="px-2 py-0.5 text-xs font-medium bg-red-100 text-red-700 rounded-full">
                  {unreadCount}件の未読
                </span>
              )}
            </div>
            <button
              onClick={onClose}
              className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 text-xl"
            >
              ×
            </button>
          </div>
          {notifications.length > 0 && (
            <div className="flex gap-3 mt-3">
              <button
                onClick={markAllAsRead}
                className="text-xs text-violet-600 hover:text-violet-800"
              >
                すべて既読にする
              </button>
              <button
                onClick={clearAll}
                className="text-xs text-slate-500 hover:text-slate-700"
              >
                すべて削除
              </button>
            </div>
          )}
        </div>

        {/* 通知リスト */}
        <div className="overflow-y-auto max-h-[60vh]">
          {loading ? (
            <div className="p-8 text-center">
              <div className="w-8 h-8 border-2 border-violet-600 border-t-transparent rounded-full animate-spin mx-auto" />
            </div>
          ) : error ? (
            <div className="p-8 text-center">
              <p className="text-red-500 text-sm">{error}</p>
              <button
                onClick={load}
                className="mt-3 text-xs text-violet-600 hover:text-violet-800"
              >
                再読み込み
              </button>
            </div>
          ) : notifications.length === 0 ? (
            <div className="p-8 text-center">
              <div className="w-16 h-16 bg-slate-100 dark:bg-slate-800 rounded-full flex items-center justify-center mx-auto mb-4">
                <svg className="w-8 h-8 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
                </svg>
              </div>
              <p className="text-slate-600 dark:text-slate-400 font-medium">通知はありません</p>
            </div>
          ) : (
            <div className="divide-y divide-slate-200 dark:divide-slate-700">
              {notifications.map((notification) => {
                const cat = mapToUiCategory(notification.type);
                return (
                  <div
                    key={notification.id}
                    className={`p-4 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors cursor-pointer ${
                      !notification.isRead ? 'bg-blue-50/50 dark:bg-blue-900/20' : ''
                    }`}
                    onClick={() => markAsRead(notification.id)}
                  >
                    <div className="flex items-start gap-3">
                      <div className="flex-shrink-0 mt-0.5">{NOTIFICATION_ICONS[cat]}</div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between gap-2">
                          <p className={`font-medium ${!notification.isRead ? 'text-slate-900 dark:text-white' : 'text-slate-700 dark:text-slate-300'}`}>
                            {notification.title}
                          </p>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              deleteNotification(notification.id);
                            }}
                            className="text-slate-400 hover:text-red-500 flex-shrink-0"
                          >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                            </svg>
                          </button>
                        </div>
                        <p className="text-sm text-slate-600 dark:text-slate-400 mt-1 whitespace-pre-wrap">
                          {notification.message}
                        </p>
                        <p className="text-xs text-slate-400 mt-2">
                          {formatDate(notification.createdAt)}
                        </p>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// 通知ベルアイコン（ヘッダー用）DBから未読数を取得し、ポーリング+イベント連動で更新
export function NotificationBell({ onClick }: { onClick: () => void }) {
  const [unreadCount, setUnreadCount] = useState(0);

  const fetchUnread = useCallback(async () => {
    try {
      const res = await fetch('/api/notifications?unread=1&limit=1', { cache: 'no-store' });
      if (!res.ok) return;
      const data = await res.json();
      setUnreadCount(data.unreadCount ?? 0);
    } catch {
      // ignore
    }
  }, []);

  useEffect(() => {
    fetchUnread();
    // 1分ごとに最新化
    const interval = setInterval(fetchUnread, 60_000);
    // 他コンポーネントが通知を操作した時に即時反映
    const handleUpdate = () => fetchUnread();
    window.addEventListener('notifications-updated', handleUpdate);
    return () => {
      clearInterval(interval);
      window.removeEventListener('notifications-updated', handleUpdate);
    };
  }, [fetchUnread]);

  return (
    <button
      onClick={onClick}
      className="relative p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
      title="通知"
    >
      <svg className="w-5 h-5 text-slate-600 dark:text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
      </svg>
      {unreadCount > 0 && (
        <span className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 text-white text-xs font-bold rounded-full flex items-center justify-center">
          {unreadCount > 9 ? '9+' : unreadCount}
        </span>
      )}
    </button>
  );
}

// クライアント側から通知をDBへ追加するヘルパ（イベント発火付き）
export async function addNotification(notification: {
  type: string;
  title: string;
  message: string;
  relatedId?: string;
  relatedType?: string;
}) {
  try {
    const res = await fetch('/api/notifications', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(notification),
    });
    if (res.ok) {
      window.dispatchEvent(new CustomEvent('notifications-updated'));
    }
  } catch {
    // 失敗時は黙って無視（致命でない）
  }
}
