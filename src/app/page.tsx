'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  KPICard,
  TopPostsList,
} from '@/components/analytics';
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

type TabType = 'overview' | 'posts' | 'timing' | 'content' | 'keywords' | 'engagement' | 'insights' | 'export';

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
      if (!res.ok) throw new Error('Failed to fetch data');
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

  const tabs: { id: TabType; label: string }[] = [
    { id: 'overview', label: '概要' },
    { id: 'posts', label: '投稿分析' },
    { id: 'timing', label: '投稿時間' },
    { id: 'content', label: 'コンテンツ' },
    { id: 'keywords', label: 'キーワード' },
    { id: 'engagement', label: 'ファン分析' },
    { id: 'insights', label: 'AIインサイト' },
    { id: 'export', label: 'エクスポート' },
  ];

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
              Threads Analytics Pro
            </h1>
            <p className="text-slate-500">世界一の分析ツール</p>
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
              <p className="text-xs text-slate-500 mb-2">トークンの取得方法:</p>
              <ol className="text-xs text-slate-500 space-y-1 list-decimal ml-4">
                <li>Meta for Developersでアプリを作成</li>
                <li>Threads APIの権限を追加</li>
                <li>Graph API Explorerでトークンを生成</li>
                <li>長期トークンに変換</li>
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
                Threads Analytics Pro
              </h1>
              <p className="text-sm text-slate-500 mt-0.5">
                世界一の分析ツール
              </p>
            </div>
            <div className="flex items-center gap-3">
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
            <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
              {error}
            </div>
          )}

          {/* Tabs */}
          <div className="mt-4 flex gap-1 overflow-x-auto">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors whitespace-nowrap ${
                  activeTab === tab.id
                    ? 'bg-violet-100 text-violet-700'
                    : 'text-slate-600 hover:bg-slate-100'
                }`}
              >
                {tab.label}
              </button>
            ))}
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
            </div>
          </div>
        </div>
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

            {/* Posts Tab */}
            {activeTab === 'posts' && (
              <div className="space-y-6">
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
                <TopPostsList
                  posts={data.threads.data.map((t) => ({
                    id: t.id,
                    content: t.text || '',
                    publishedAt: t.timestamp,
                    metrics: {
                      impressions: t.insights.views,
                      reach: 0,
                      engagementRate: t.insights.views > 0
                        ? ((t.insights.likes + t.insights.replies) / t.insights.views) * 100
                        : 0,
                      likes: t.insights.likes,
                      comments: t.insights.replies,
                      reposts: t.insights.reposts,
                      quotes: t.insights.quotes,
                      saves: 0,
                    },
                    mediaType: 'text',
                  }))}
                />
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
        ) : !loading && (
          <div className="text-center py-12">
            <p className="text-slate-500">データを読み込み中...</p>
          </div>
        )}
      </main>

      <footer className="border-t border-slate-200 bg-white mt-8">
        <div className="max-w-7xl mx-auto px-4 py-4 flex items-center justify-between text-sm text-slate-500">
          <span>最終更新: {new Date().toLocaleString('ja-JP')}</span>
          <span>Threads Analytics Pro</span>
        </div>
      </footer>
    </div>
  );
}
