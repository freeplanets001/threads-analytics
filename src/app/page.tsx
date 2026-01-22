'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  KPICard,
  TopPostsList,
} from '@/components/analytics';
import { PostComposer } from '@/components/PostComposer';
import { PostsAnalyticsTable } from '@/components/PostsAnalyticsTable';
import { BulkPostGenerator } from '@/components/BulkPostGenerator';
import { ScheduleManager } from '@/components/ScheduleManager';
import { DraftManager } from '@/components/DraftManager';
import { TemplateManager } from '@/components/TemplateManager';
import { NotificationCenter, NotificationBell } from '@/components/NotificationCenter';
import { ReportGenerator } from '@/components/ReportGenerator';
import { RecurringPostManager } from '@/components/RecurringPostManager';
import { PostCalendar } from '@/components/PostCalendar';
import { AutoReplyManager } from '@/components/AutoReplyManager';
import { useTheme } from '@/contexts/ThemeContext';
import Link from 'next/link';
import { Role, hasPermission, getRoleName, getPermissions } from '@/lib/permissions';
import {
  PostingHoursChart,
  PostingDaysChart,
  TextLengthChart,
  EngagementPieChart,
  MediaTypeChart,
  ViralMetricsCard,
  ContentStrategyChart,
  PostingHeatmap,
  DailyTrendChart,
  HashtagChart,
  KeywordList,
  AIInsightsPanel,
} from '@/components/analytics/AdvancedCharts';
import { useAccountManager } from '@/hooks/useAccountManager';
import type { AnalyticsResult, HashtagAnalysis, KeywordAnalysis, HeatmapData, AIInsight, DailyTrend } from '@/lib/analytics/calculations';

type TabType = 'overview' | 'compose' | 'bulk' | 'schedule' | 'recurring' | 'autoreply' | 'drafts' | 'templates' | 'calendar' | 'posts' | 'timing' | 'content' | 'keywords' | 'engagement' | 'insights' | 'reports' | 'export';

interface ThreadWithInsights {
  id: string;
  text?: string;
  timestamp: string;
  media_type: string;
  permalink: string;
  is_quote_post?: boolean;
  insights: {
    views: number;
    likes: number;
    replies: number;
    reposts: number;
    quotes: number;
    shares: number;
  };
}

interface ReplyData {
  id: string;
  text?: string;
  timestamp: string;
  username: string;
  like_count?: number;
}

interface APIResponse {
  profile: { id: string; username: string; threads_profile_picture_url?: string };
  threads: { data: ThreadWithInsights[] };
  aggregatedStats: {
    totalViews: number;
    totalLikes: number;
    totalReplies: number;
    totalReposts: number;
    totalQuotes: number;
    totalShares: number;
    postCount: number;
    followersCount: number;
  };
  analytics: AnalyticsResult;
  engagement?: {
    topFans: Array<{ username: string; replyCount: number; totalLikes: number }>;
    recentReplies: Array<{ postId: string; postText?: string; replies: ReplyData[] }>;
    myReplies: ReplyData[];
  };
  advancedAnalysis?: {
    hashtags: HashtagAnalysis[];
    keywords: KeywordAnalysis[];
    heatmap: HeatmapData[];
    aiInsights: AIInsight[];
    dailyTrends: DailyTrend[];
  };
}

export default function AnalyticsDashboard() {
  const [activeTab, setActiveTab] = useState<TabType>('overview');
  const [data, setData] = useState<APIResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // アカウント管理
  const {
    accounts,
    currentAccount,
    isLoading: accountsLoading,
    addAccount,
    removeAccount,
    switchAccount,
  } = useAccountManager();

  const [showAccountModal, setShowAccountModal] = useState(false);
  const [newToken, setNewToken] = useState('');
  const [addingAccount, setAddingAccount] = useState(false);

  // トークン変換用
  const [showTokenConverter, setShowTokenConverter] = useState(false);
  const [shortToken, setShortToken] = useState('');
  const [convertedToken, setConvertedToken] = useState('');
  const [converting, setConverting] = useState(false);
  const [convertError, setConvertError] = useState<string | null>(null);
  const [tokenExpiresIn, setTokenExpiresIn] = useState<number | null>(null);

  // ロール管理（開発用: デフォルトでADMIN）
  const [userRole, setUserRole] = useState<Role>('ADMIN');
  const permissions = getPermissions(userRole);

  // テーマ管理
  const { theme, setTheme, actualTheme } = useTheme();

  // 投稿作成用の初期テキスト（テンプレート・下書きから）
  const [initialComposeText, setInitialComposeText] = useState<string>('');
  const [composerKey, setComposerKey] = useState(0);

  // 通知センター
  const [showNotifications, setShowNotifications] = useState(false);

  // ロールをサーバーから取得（localStorageはフォールバック）
  useEffect(() => {
    const fetchUserRole = async () => {
      try {
        const res = await fetch('/api/admin/setup');
        if (res.ok) {
          const data = await res.json();
          if (data.user?.role && ['ADMIN', 'PRO', 'STANDARD'].includes(data.user.role)) {
            setUserRole(data.user.role as Role);
            localStorage.setItem('user_role', data.user.role);
            return;
          }
        }
      } catch (e) {
        console.log('Failed to fetch user role from server', e);
      }

      // フォールバック: localStorageから読み込み
      const savedRole = localStorage.getItem('user_role') as Role | null;
      if (savedRole && ['ADMIN', 'PRO', 'STANDARD'].includes(savedRole)) {
        setUserRole(savedRole);
      }
    };

    fetchUserRole();
  }, []);

  const fetchData = useCallback(async () => {
    if (!currentAccount) return;

    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/threads/me', {
        headers: {
          Authorization: `Bearer ${currentAccount.accessToken}`,
        },
      });

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        if (res.status === 401 || errorData.code === 'NOT_AUTHENTICATED') {
          throw new Error('アクセストークンが無効または期限切れです。アカウントを削除して再登録してください。');
        }
        throw new Error(errorData.error || 'データの取得に失敗しました');
      }

      const json = await res.json();
      setData(json);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  }, [currentAccount]);

  useEffect(() => {
    if (currentAccount) {
      fetchData();
    } else {
      setData(null);
    }
  }, [currentAccount, fetchData]);

  const handleAddAccount = async () => {
    if (!newToken.trim()) return;
    setAddingAccount(true);
    setError(null);
    const result = await addAccount(newToken.trim());
    setAddingAccount(false);

    if (result.success) {
      setNewToken('');
      setShowAccountModal(false);
    } else {
      setError(result.error || 'Failed to add account');
    }
  };

  const handleConvertToken = async () => {
    if (!shortToken.trim()) return;
    setConverting(true);
    setConvertError(null);
    setConvertedToken('');
    setTokenExpiresIn(null);

    try {
      const res = await fetch('/api/threads/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ shortLivedToken: shortToken.trim() }),
      });
      const data = await res.json();

      if (!res.ok || !data.success) {
        setConvertError(data.error || '変換に失敗しました');
      } else {
        setConvertedToken(data.accessToken);
        setTokenExpiresIn(data.expiresIn);
      }
    } catch {
      setConvertError('通信エラーが発生しました');
    } finally {
      setConverting(false);
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
  };

  const exportData = (format: 'json' | 'csv') => {
    if (!data) return;

    if (format === 'json') {
      const exportObj = {
        exportedAt: new Date().toISOString(),
        account: data.profile,
        stats: data.aggregatedStats,
        analytics: data.analytics,
        posts: data.threads.data,
      };
      const blob = new Blob([JSON.stringify(exportObj, null, 2)], {
        type: 'application/json',
      });
      downloadBlob(blob, `threads-analytics-${data.profile.username}.json`);
    } else {
      const rows = [
        ['投稿ID', 'テキスト', '日時', '閲覧数', 'いいね', 'リプライ', 'リポスト', '引用', 'シェア'],
        ...data.threads.data.map((p) => [
          p.id,
          `"${(p.text || '').replace(/"/g, '""')}"`,
          p.timestamp,
          p.insights.views,
          p.insights.likes,
          p.insights.replies,
          p.insights.reposts,
          p.insights.quotes,
          p.insights.shares,
        ]),
      ];
      const csv = rows.map((r) => r.join(',')).join('\n');
      const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8' });
      downloadBlob(blob, `threads-analytics-${data.profile.username}.csv`);
    }
  };

  const downloadBlob = (blob: Blob, filename: string) => {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  };

  const allTabs: { id: TabType; label: string; permission?: keyof typeof permissions }[] = [
    { id: 'overview', label: '概要' },
    { id: 'compose', label: '投稿作成' },
    { id: 'bulk', label: 'AI一括生成', permission: 'aiBulkGeneration' },
    { id: 'schedule', label: '予約投稿', permission: 'scheduledPosts' },
    { id: 'recurring', label: '定期投稿', permission: 'recurringPosts' },
    { id: 'autoreply', label: '自動リプライ', permission: 'recurringPosts' },
    { id: 'drafts', label: '下書き', permission: 'drafts' },
    { id: 'templates', label: 'テンプレート', permission: 'templates' },
    { id: 'calendar', label: 'カレンダー' },
    { id: 'posts', label: '投稿一覧' },
    { id: 'timing', label: '投稿時間' },
    { id: 'content', label: 'コンテンツ' },
    { id: 'keywords', label: 'キーワード' },
    { id: 'engagement', label: 'ファン分析' },
    { id: 'insights', label: 'AIインサイト', permission: 'advancedAnalytics' },
    { id: 'reports', label: 'レポート', permission: 'weeklyReports' },
    { id: 'export', label: 'エクスポート', permission: 'exportData' },
  ];

  // 権限に基づいてタブをフィルター
  const tabs = allTabs.filter(tab => {
    if (!tab.permission) return true;
    return permissions[tab.permission];
  });

  const analytics = data?.analytics;
  const stats = data?.aggregatedStats;

  // アカウント読み込み中
  if (accountsLoading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="flex items-center gap-3 bg-white px-6 py-4 rounded-xl shadow-lg">
          <div className="w-5 h-5 border-2 border-violet-600 border-t-transparent rounded-full animate-spin" />
          <span className="text-slate-600">読み込み中...</span>
        </div>
      </div>
    );
  }

  // アカウント未設定
  if (accounts.length === 0) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-white rounded-2xl shadow-xl p-8">
          <div className="text-center mb-8">
            <h1 className="text-2xl font-bold text-slate-900 mb-2">
              Threads Studio
            </h1>
            <p className="text-slate-500">分析・投稿スタジオ</p>
          </div>

          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">
                アクセストークンを入力
              </label>
              <textarea
                value={newToken}
                onChange={(e) => setNewToken(e.target.value)}
                placeholder="THQWxxxxxx..."
                className="w-full px-4 py-3 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-violet-500 h-24 resize-none"
              />
            </div>

            {error && (
              <p className="text-sm text-red-600">{error}</p>
            )}

            <button
              onClick={handleAddAccount}
              disabled={addingAccount || !newToken.trim()}
              className="w-full py-3 bg-violet-600 text-white font-semibold rounded-lg hover:bg-violet-700 transition-colors disabled:opacity-50"
            >
              {addingAccount ? '確認中...' : 'アカウントを追加'}
            </button>

            <div className="pt-4 border-t border-slate-200">
              <button
                onClick={() => setShowTokenConverter(!showTokenConverter)}
                className="w-full text-left text-sm font-medium text-violet-600 hover:text-violet-700 flex items-center justify-between"
              >
                <span>短期トークン → 長期トークン変換ツール</span>
                <span className="text-lg">{showTokenConverter ? '−' : '+'}</span>
              </button>

              {showTokenConverter && (
                <div className="mt-4 space-y-3">
                  <div>
                    <label className="block text-xs font-medium text-slate-600 mb-1">
                      短期トークン（Graph API Explorerで取得）
                    </label>
                    <textarea
                      value={shortToken}
                      onChange={(e) => setShortToken(e.target.value)}
                      placeholder="短期トークンを貼り付け..."
                      className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-violet-500 h-16 resize-none"
                    />
                  </div>

                  <button
                    onClick={handleConvertToken}
                    disabled={converting || !shortToken.trim()}
                    className="w-full py-2 bg-cyan-600 text-white text-sm font-medium rounded-lg hover:bg-cyan-700 transition-colors disabled:opacity-50"
                  >
                    {converting ? '変換中...' : '長期トークンに変換'}
                  </button>

                  {convertError && (
                    <p className="text-xs text-red-600">{convertError}</p>
                  )}

                  {convertedToken && (
                    <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-lg">
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-xs font-medium text-emerald-700">長期トークン（約60日間有効）</span>
                        <button
                          onClick={() => copyToClipboard(convertedToken)}
                          className="text-xs text-emerald-600 hover:text-emerald-800"
                        >
                          コピー
                        </button>
                      </div>
                      <p className="text-xs text-emerald-800 break-all font-mono bg-emerald-100 p-2 rounded">
                        {convertedToken.substring(0, 50)}...
                      </p>
                      {tokenExpiresIn && (
                        <p className="text-xs text-emerald-600 mt-1">
                          有効期限: {Math.floor(tokenExpiresIn / 86400)}日
                        </p>
                      )}
                      <button
                        onClick={() => {
                          setNewToken(convertedToken);
                          setConvertedToken('');
                          setShortToken('');
                        }}
                        className="mt-2 w-full py-1.5 bg-emerald-600 text-white text-xs font-medium rounded hover:bg-emerald-700"
                      >
                        このトークンを上の入力欄にセット
                      </button>
                    </div>
                  )}

                  <p className="text-xs text-slate-500">
                    ※ THREADS_APP_SECRETがサーバーに設定されている必要があります
                  </p>
                </div>
              )}
            </div>

            <div className="pt-4 border-t border-slate-200">
              <p className="text-xs text-slate-500 mb-2">トークンの取得方法:</p>
              <ol className="text-xs text-slate-500 space-y-1 list-decimal ml-4">
                <li>Meta for Developersでアプリを作成</li>
                <li>Threads APIの権限を追加</li>
                <li>Graph API Explorerでトークンを生成</li>
                <li>上の変換ツールで長期トークンに変換</li>
              </ol>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Header */}
      <header className="bg-white border-b border-slate-200 sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-xl font-bold text-slate-900">
                Threads Studio
              </h1>
              <p className="text-sm text-slate-500 mt-0.5">
                分析・投稿スタジオ
              </p>
            </div>
            <div className="flex items-center gap-3">
              {/* Theme Toggle */}
              <button
                onClick={() => setTheme(actualTheme === 'dark' ? 'light' : 'dark')}
                className="p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                title={actualTheme === 'dark' ? 'ライトモードに切替' : 'ダークモードに切替'}
              >
                {actualTheme === 'dark' ? (
                  <svg className="w-5 h-5 text-yellow-500" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M10 2a1 1 0 011 1v1a1 1 0 11-2 0V3a1 1 0 011-1zm4 8a4 4 0 11-8 0 4 4 0 018 0zm-.464 4.95l.707.707a1 1 0 001.414-1.414l-.707-.707a1 1 0 00-1.414 1.414zm2.12-10.607a1 1 0 010 1.414l-.706.707a1 1 0 11-1.414-1.414l.707-.707a1 1 0 011.414 0zM17 11a1 1 0 100-2h-1a1 1 0 100 2h1zm-7 4a1 1 0 011 1v1a1 1 0 11-2 0v-1a1 1 0 011-1zM5.05 6.464A1 1 0 106.465 5.05l-.708-.707a1 1 0 00-1.414 1.414l.707.707zm1.414 8.486l-.707.707a1 1 0 01-1.414-1.414l.707-.707a1 1 0 011.414 1.414zM4 11a1 1 0 100-2H3a1 1 0 000 2h1z" clipRule="evenodd" />
                  </svg>
                ) : (
                  <svg className="w-5 h-5 text-slate-600" fill="currentColor" viewBox="0 0 20 20">
                    <path d="M17.293 13.293A8 8 0 016.707 2.707a8.001 8.001 0 1010.586 10.586z" />
                  </svg>
                )}
              </button>

              {/* Notification Bell */}
              {permissions.notifications && (
                <NotificationBell onClick={() => setShowNotifications(true)} />
              )}

              {/* Role Switcher (開発用) */}
              <select
                value={userRole}
                onChange={(e) => {
                  const newRole = e.target.value as Role;
                  setUserRole(newRole);
                  localStorage.setItem('user_role', newRole);
                }}
                className={`px-2 py-1 text-xs rounded-lg font-medium border-0 cursor-pointer ${
                  userRole === 'ADMIN' ? 'bg-red-100 text-red-700' :
                  userRole === 'PRO' ? 'bg-blue-100 text-blue-700' :
                  'bg-slate-100 text-slate-700'
                }`}
              >
                <option value="ADMIN">Admin</option>
                <option value="PRO">Pro</option>
                <option value="STANDARD">Standard</option>
              </select>

              {/* Admin Link */}
              {permissions.adminPanel && (
                <Link
                  href="/admin"
                  className="px-3 py-1.5 text-sm text-red-600 hover:text-red-700 hover:bg-red-50 rounded-lg"
                >
                  管理
                </Link>
              )}

              <Link
                href="/guide"
                className="px-3 py-1.5 text-sm text-slate-500 hover:text-slate-700"
              >
                ガイド
              </Link>

              {/* Account Switcher */}
              <button
                onClick={() => setShowAccountModal(true)}
                className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-violet-50 hover:bg-violet-100 transition-colors"
              >
                <span className="w-6 h-6 rounded-full bg-violet-200 flex items-center justify-center text-xs font-bold text-violet-700">
                  {currentAccount?.username?.[0]?.toUpperCase() || '?'}
                </span>
                <span className="text-sm font-medium text-violet-700">
                  @{currentAccount?.username}
                </span>
                {accounts.length > 1 && (
                  <span className="text-xs bg-violet-200 text-violet-700 px-1.5 py-0.5 rounded-full">
                    {accounts.length}
                  </span>
                )}
              </button>

              <button
                onClick={fetchData}
                disabled={loading}
                className="px-3 py-1.5 text-sm text-slate-600 hover:text-slate-800 hover:bg-slate-100 rounded-lg transition-colors disabled:opacity-50"
              >
                更新
              </button>
            </div>
          </div>

          {error && (
            <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-lg">
              <p className="text-sm text-red-700">{error}</p>
              {currentAccount && (
                <div className="mt-2 flex gap-2">
                  <button
                    onClick={() => {
                      removeAccount(currentAccount.id);
                      setError(null);
                    }}
                    className="px-3 py-1 text-xs bg-red-600 text-white rounded hover:bg-red-700"
                  >
                    このアカウントを削除
                  </button>
                  <button
                    onClick={() => setShowAccountModal(true)}
                    className="px-3 py-1 text-xs bg-violet-600 text-white rounded hover:bg-violet-700"
                  >
                    トークンを更新
                  </button>
                </div>
              )}
            </div>
          )}

          {/* Tabs - 2行表示 */}
          <div className="mt-4 space-y-2">
            {/* 1行目: メイン機能 */}
            <div className="flex flex-wrap gap-1">
              {tabs.filter(t => ['overview', 'compose', 'bulk', 'schedule', 'recurring', 'autoreply', 'drafts', 'templates'].includes(t.id)).map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`px-3 py-1.5 text-sm font-medium rounded-lg transition-colors whitespace-nowrap ${
                    activeTab === tab.id
                      ? 'bg-violet-100 text-violet-700'
                      : 'text-slate-600 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>
            {/* 2行目: 分析・その他 */}
            <div className="flex flex-wrap gap-1">
              {tabs.filter(t => ['calendar', 'posts', 'timing', 'content', 'keywords', 'engagement', 'insights', 'reports', 'export'].includes(t.id)).map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`px-3 py-1.5 text-sm font-medium rounded-lg transition-colors whitespace-nowrap ${
                    activeTab === tab.id
                      ? 'bg-cyan-100 text-cyan-700'
                      : 'text-slate-600 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>
          </div>
        </div>
      </header>

      {/* Account Modal */}
      {showAccountModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl max-w-md w-full max-h-[80vh] overflow-y-auto">
            <div className="p-6 border-b border-slate-200">
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-bold text-slate-900">アカウント管理</h2>
                <button
                  onClick={() => setShowAccountModal(false)}
                  className="text-slate-400 hover:text-slate-600 text-xl"
                >
                  ×
                </button>
              </div>
            </div>

            <div className="p-6 space-y-4">
              {/* Account List */}
              <div className="space-y-2">
                {accounts.map((account) => (
                  <div
                    key={account.id}
                    className={`flex items-center justify-between p-3 rounded-lg border ${
                      currentAccount?.id === account.id
                        ? 'border-violet-300 bg-violet-50'
                        : 'border-slate-200 hover:bg-slate-50'
                    }`}
                  >
                    <button
                      onClick={() => {
                        switchAccount(account.id);
                        setShowAccountModal(false);
                      }}
                      className="flex items-center gap-3 flex-1"
                    >
                      <span className="w-10 h-10 rounded-full bg-violet-200 flex items-center justify-center text-lg font-bold text-violet-700">
                        {account.username[0].toUpperCase()}
                      </span>
                      <div className="text-left">
                        <p className="font-medium text-slate-900">@{account.username}</p>
                        {account.name && (
                          <p className="text-sm text-slate-500">{account.name}</p>
                        )}
                      </div>
                    </button>
                    <button
                      onClick={() => removeAccount(account.id)}
                      className="p-2 text-slate-400 hover:text-red-500 transition-colors"
                      title="削除"
                    >
                      ×
                    </button>
                  </div>
                ))}
              </div>

              {/* Add Account */}
              <div className="pt-4 border-t border-slate-200">
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  アカウントを追加
                </label>
                <textarea
                  value={newToken}
                  onChange={(e) => setNewToken(e.target.value)}
                  placeholder="アクセストークンを入力..."
                  className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-violet-500 h-20 resize-none"
                />
                <button
                  onClick={handleAddAccount}
                  disabled={addingAccount || !newToken.trim()}
                  className="mt-2 w-full py-2 bg-violet-600 text-white text-sm font-medium rounded-lg hover:bg-violet-700 transition-colors disabled:opacity-50"
                >
                  {addingAccount ? '確認中...' : '追加'}
                </button>
              </div>

              {/* Token Converter */}
              <div className="pt-4 border-t border-slate-200">
                <button
                  onClick={() => setShowTokenConverter(!showTokenConverter)}
                  className="w-full text-left text-sm font-medium text-cyan-600 hover:text-cyan-700 flex items-center justify-between"
                >
                  <span>トークン変換ツール</span>
                  <span>{showTokenConverter ? '−' : '+'}</span>
                </button>

                {showTokenConverter && (
                  <div className="mt-3 space-y-2">
                    <textarea
                      value={shortToken}
                      onChange={(e) => setShortToken(e.target.value)}
                      placeholder="短期トークンを貼り付け..."
                      className="w-full px-3 py-2 text-xs border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-cyan-500 h-16 resize-none"
                    />
                    <button
                      onClick={handleConvertToken}
                      disabled={converting || !shortToken.trim()}
                      className="w-full py-1.5 bg-cyan-600 text-white text-xs font-medium rounded-lg hover:bg-cyan-700 transition-colors disabled:opacity-50"
                    >
                      {converting ? '変換中...' : '長期トークンに変換'}
                    </button>

                    {convertError && (
                      <p className="text-xs text-red-600">{convertError}</p>
                    )}

                    {convertedToken && (
                      <div className="p-2 bg-emerald-50 border border-emerald-200 rounded">
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-xs font-medium text-emerald-700">変換完了</span>
                          <button
                            onClick={() => copyToClipboard(convertedToken)}
                            className="text-xs text-emerald-600 hover:text-emerald-800"
                          >
                            コピー
                          </button>
                        </div>
                        <p className="text-xs text-emerald-800 break-all font-mono">
                          {convertedToken.substring(0, 40)}...
                        </p>
                        <button
                          onClick={() => {
                            setNewToken(convertedToken);
                            setConvertedToken('');
                            setShortToken('');
                          }}
                          className="mt-1 w-full py-1 bg-emerald-600 text-white text-xs rounded hover:bg-emerald-700"
                        >
                          上の入力欄にセット
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Notification Center */}
      {showNotifications && (
        <NotificationCenter onClose={() => setShowNotifications(false)} />
      )}

      {/* Loading */}
      {loading && (
        <div className="fixed inset-0 bg-white/50 flex items-center justify-center z-20">
          <div className="flex items-center gap-3 bg-white px-6 py-4 rounded-xl shadow-lg">
            <div className="w-5 h-5 border-2 border-violet-600 border-t-transparent rounded-full animate-spin" />
            <span className="text-slate-600">データを取得中...</span>
          </div>
        </div>
      )}

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 py-6">
        {data && analytics && stats ? (
          <>
            {/* Compose Tab */}
            {activeTab === 'compose' && currentAccount && (
              <div className="space-y-6">
                <PostComposer
                  key={`compose-${composerKey}`}
                  accessToken={currentAccount.accessToken}
                  onPostSuccess={fetchData}
                  initialText={initialComposeText}
                  onInitialTextUsed={() => setInitialComposeText('')}
                />
              </div>
            )}

            {/* Overview Tab */}
            {activeTab === 'overview' && (
              <div className="space-y-6">
                <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
                  <KPICard title="フォロワー" value={stats.followersCount} />
                  <KPICard title="総閲覧数" value={stats.totalViews} />
                  <KPICard title="総いいね" value={stats.totalLikes} />
                  <KPICard title="総リプライ" value={stats.totalReplies} />
                  <KPICard title="総リポスト" value={stats.totalReposts} />
                  <KPICard title="総シェア" value={stats.totalShares} />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="bg-white rounded-xl border border-slate-200 p-5">
                    <h3 className="text-sm font-semibold text-slate-700 mb-2">エンゲージメント率</h3>
                    <p className="text-4xl font-bold text-violet-600">
                      {analytics.averageEngagementRate.toFixed(2)}%
                    </p>
                  </div>
                  <div className="bg-white rounded-xl border border-slate-200 p-5">
                    <h3 className="text-sm font-semibold text-slate-700 mb-2">バイラル係数</h3>
                    <p className="text-4xl font-bold text-cyan-600">
                      {analytics.viralMetrics.viralCoefficient.toFixed(3)}%
                    </p>
                  </div>
                  <div className="bg-white rounded-xl border border-slate-200 p-5">
                    <h3 className="text-sm font-semibold text-slate-700 mb-2">成長トレンド</h3>
                    <p className={`text-4xl font-bold ${
                      analytics.growthMetrics.engagementTrend === 'up' ? 'text-emerald-600' :
                      analytics.growthMetrics.engagementTrend === 'down' ? 'text-red-600' : 'text-slate-600'
                    }`}>
                      {analytics.growthMetrics.engagementTrend === 'up' ? '↑ 上昇' :
                       analytics.growthMetrics.engagementTrend === 'down' ? '↓ 下降' : '→ 安定'}
                    </p>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <EngagementPieChart
                    likes={stats.totalLikes}
                    replies={stats.totalReplies}
                    reposts={stats.totalReposts}
                    quotes={stats.totalQuotes}
                    shares={stats.totalShares}
                  />
                  <ViralMetricsCard
                    viralCoefficient={analytics.viralMetrics.viralCoefficient}
                    shareRate={analytics.viralMetrics.shareRate}
                    replyRate={analytics.viralMetrics.replyRate}
                  />
                </div>
              </div>
            )}

            {/* Bulk Generation Tab */}
            {activeTab === 'bulk' && currentAccount && (
              <div className="space-y-6">
                <BulkPostGenerator
                  accessToken={currentAccount.accessToken}
                  embedded={true}
                  onPostsScheduled={() => {
                    fetchData();
                  }}
                />
              </div>
            )}

            {/* Schedule Tab */}
            {activeTab === 'schedule' && currentAccount && (
              <ScheduleManager
                accessToken={currentAccount.accessToken}
                accountId={currentAccount.id}
                onRefresh={fetchData}
              />
            )}

            {/* Drafts Tab */}
            {activeTab === 'drafts' && currentAccount && (
              <DraftManager
                accessToken={currentAccount.accessToken}
                onSelectDraft={(draft) => {
                  // 下書きを選択したら投稿作成タブに移動
                  setInitialComposeText(draft.text || '');
                  setComposerKey(prev => prev + 1);
                  setActiveTab('compose');
                }}
                maxDrafts={permissions.maxDrafts}
              />
            )}

            {/* Templates Tab */}
            {activeTab === 'templates' && (
              <TemplateManager
                onSelectTemplate={(template) => {
                  // テンプレートを選択したら投稿作成タブに移動
                  console.log('Template selected:', template);
                  console.log('Template text:', template.text);
                  const textToSet = template.text || '';
                  console.log('Setting initialComposeText to:', textToSet);
                  setInitialComposeText(textToSet);
                  setComposerKey(prev => prev + 1);
                  setActiveTab('compose');
                }}
                maxTemplates={permissions.maxTemplates}
              />
            )}

            {/* Recurring Posts Tab */}
            {activeTab === 'recurring' && currentAccount && (
              <RecurringPostManager
                accessToken={currentAccount.accessToken}
                accountId={currentAccount.id}
                onRefresh={fetchData}
              />
            )}

            {/* Auto Reply Tab */}
            {activeTab === 'autoreply' && currentAccount && (
              <AutoReplyManager
                accessToken={currentAccount.accessToken}
                accountId={currentAccount.id}
                onRefresh={fetchData}
              />
            )}

            {/* Calendar Tab */}
            {activeTab === 'calendar' && (
              <PostCalendar
                posts={data.threads.data.map(t => ({
                  id: t.id,
                  text: t.text,
                  timestamp: t.timestamp,
                  insights: t.insights,
                }))}
              />
            )}

            {/* Posts Tab - Analytics Table */}
            {activeTab === 'posts' && (
              <div className="space-y-6">
                <PostsAnalyticsTable
                  posts={data.threads.data.map((t) => ({
                    id: t.id,
                    text: t.text || '',
                    timestamp: t.timestamp,
                    media_type: t.media_type,
                    likes: t.insights.likes,
                    replies: t.insights.replies,
                    reposts: t.insights.reposts,
                    views: t.insights.views,
                  }))}
                />

                {/* Top/Worst Posts Quick View */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  <div className="bg-white rounded-xl border border-slate-200 p-5">
                    <h3 className="text-sm font-semibold text-slate-700 mb-4">トップ投稿</h3>
                    <div className="space-y-3">
                      {analytics.topPosts.slice(0, 5).map((post, i) => (
                        <div key={post.id} className="p-3 bg-slate-50 rounded-lg">
                          <div className="flex items-start gap-2">
                            <span className="text-lg font-bold text-violet-600">#{i + 1}</span>
                            <div className="flex-1 min-w-0">
                              <p className="text-sm text-slate-700 line-clamp-2">{post.text}</p>
                              <div className="mt-2 flex flex-wrap gap-2 text-xs text-slate-500">
                                <span>閲覧 {post.insights.views}</span>
                                <span>いいね {post.insights.likes}</span>
                              </div>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                  <div className="bg-white rounded-xl border border-slate-200 p-5">
                    <h3 className="text-sm font-semibold text-slate-700 mb-4">改善が必要な投稿</h3>
                    <div className="space-y-3">
                      {analytics.worstPosts.slice(0, 5).map((post, i) => (
                        <div key={post.id} className="p-3 bg-red-50 rounded-lg">
                          <div className="flex items-start gap-2">
                            <span className="text-lg font-bold text-red-400">#{i + 1}</span>
                            <div className="flex-1 min-w-0">
                              <p className="text-sm text-slate-700 line-clamp-2">{post.text}</p>
                              <div className="mt-2 flex flex-wrap gap-2 text-xs text-slate-500">
                                <span>閲覧 {post.insights.views}</span>
                                <span>いいね {post.insights.likes}</span>
                              </div>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Timing Tab */}
            {activeTab === 'timing' && (
              <div className="space-y-6">
                <div className="bg-white rounded-xl border border-slate-200 p-5">
                  <h3 className="text-sm font-semibold text-slate-700 mb-4">最適な投稿時間</h3>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    {analytics.bestPostingHours.slice(0, 3).map((h, i) => (
                      <div key={h.hour} className={`p-4 rounded-lg ${
                        i === 0 ? 'bg-violet-50 border-2 border-violet-200' : 'bg-slate-50'
                      }`}>
                        <p className="text-xs text-slate-500">{i === 0 ? 'ベスト' : `${i + 1}位`}</p>
                        <p className="text-2xl font-bold text-slate-900">{h.hour}:00</p>
                        <p className="text-sm text-slate-600">
                          平均エンゲージメント: {h.avgEngagement.toFixed(1)}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  <PostingHoursChart data={analytics.bestPostingHours} />
                  <PostingDaysChart data={analytics.bestPostingDays} />
                </div>
              </div>
            )}

            {/* Content Tab */}
            {activeTab === 'content' && (
              <div className="space-y-6">
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  <TextLengthChart data={analytics.contentAnalysis.textLengthCorrelation} />
                  <MediaTypeChart data={analytics.contentAnalysis.mediaTypePerformance} />
                </div>
                <ContentStrategyChart
                  emojiImpact={analytics.contentAnalysis.emojiUsageImpact}
                  quotePerformance={analytics.contentAnalysis.quotePostPerformance}
                />
              </div>
            )}

            {/* Keywords Tab */}
            {activeTab === 'keywords' && data.advancedAnalysis && (
              <div className="space-y-6">
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  <HashtagChart data={data.advancedAnalysis.hashtags} />
                  <KeywordList data={data.advancedAnalysis.keywords} />
                </div>
              </div>
            )}

            {/* Engagement Tab */}
            {activeTab === 'engagement' && (
              <div className="space-y-6">
                <div className="bg-white rounded-xl border border-slate-200 p-5">
                  <h3 className="text-sm font-semibold text-slate-700 mb-4">
                    トップファン（最もリプライしてくれるユーザー）
                  </h3>
                  {data.engagement?.topFans && data.engagement.topFans.length > 0 ? (
                    <div className="space-y-3">
                      {data.engagement.topFans.map((fan, i) => (
                        <div key={fan.username} className="flex items-center justify-between p-3 bg-slate-50 rounded-lg">
                          <div className="flex items-center gap-3">
                            <span className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold ${
                              i === 0 ? 'bg-yellow-100 text-yellow-700' :
                              i === 1 ? 'bg-slate-200 text-slate-700' :
                              i === 2 ? 'bg-orange-100 text-orange-700' : 'bg-slate-100 text-slate-600'
                            }`}>
                              {i + 1}
                            </span>
                            <div>
                              <p className="font-medium text-slate-900">@{fan.username}</p>
                              <p className="text-xs text-slate-500">{fan.replyCount}回リプライ</p>
                            </div>
                          </div>
                          <a
                            href={`https://threads.net/@${fan.username}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-xs text-violet-600 hover:underline"
                          >
                            プロフィール →
                          </a>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-slate-500 text-sm">リプライデータがありません</p>
                  )}
                </div>
              </div>
            )}

            {/* Insights Tab */}
            {activeTab === 'insights' && data.advancedAnalysis && (
              <div className="space-y-6">
                <AIInsightsPanel insights={data.advancedAnalysis.aiInsights} />
                <DailyTrendChart data={data.advancedAnalysis.dailyTrends} />
                <PostingHeatmap data={data.advancedAnalysis.heatmap} />
              </div>
            )}

            {/* Reports Tab */}
            {activeTab === 'reports' && (
              <ReportGenerator
                data={{
                  profile: data.profile,
                  aggregatedStats: stats,
                  analytics: analytics,
                  threads: data.threads,
                }}
                weeklyEnabled={permissions.weeklyReports}
                monthlyEnabled={permissions.monthlyReports}
              />
            )}

            {/* Export Tab */}
            {activeTab === 'export' && (
              <div className="space-y-6">
                <div className="bg-white rounded-xl border border-slate-200 p-5">
                  <h3 className="text-sm font-semibold text-slate-700 mb-4">データエクスポート</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <button
                      onClick={() => exportData('json')}
                      className="p-6 border-2 border-dashed border-slate-300 rounded-xl hover:border-violet-400 hover:bg-violet-50 transition-colors"
                    >
                      <div className="text-center">
                        <p className="font-semibold text-slate-700">JSON形式</p>
                        <p className="text-sm text-slate-500 mt-1">全データを構造化形式で出力</p>
                      </div>
                    </button>
                    <button
                      onClick={() => exportData('csv')}
                      className="p-6 border-2 border-dashed border-slate-300 rounded-xl hover:border-cyan-400 hover:bg-cyan-50 transition-colors"
                    >
                      <div className="text-center">
                        <p className="font-semibold text-slate-700">CSV形式</p>
                        <p className="text-sm text-slate-500 mt-1">Excelで開ける表形式で出力</p>
                      </div>
                    </button>
                  </div>
                </div>
              </div>
            )}
          </>
        ) : !loading && !error && (
          <div className="text-center py-12">
            <p className="text-slate-500">データを読み込み中...</p>
          </div>
        )}
      </main>

      <footer className="border-t border-slate-200 bg-white mt-8">
        <div className="max-w-7xl mx-auto px-4 py-4 flex items-center justify-between text-sm text-slate-500">
          <span>最終更新: {new Date().toLocaleString('ja-JP')}</span>
          <span>Threads Studio</span>
        </div>
      </footer>
    </div>
  );
}
