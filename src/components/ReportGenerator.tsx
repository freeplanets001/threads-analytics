'use client';

import { useState } from 'react';

interface ReportGeneratorProps {
  data: {
    profile: { username: string };
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
    analytics: {
      averageEngagementRate: number;
      viralMetrics: {
        viralCoefficient: number;
        shareRate: number;
        replyRate: number;
      };
      bestPostingHours: Array<{ hour: number; avgEngagement: number }>;
      topPosts: Array<{
        id: string;
        text?: string;
        insights: {
          views: number;
          likes: number;
          replies: number;
          reposts: number;
        };
      }>;
    };
    threads: {
      data: Array<{
        id: string;
        text?: string;
        timestamp: string;
        insights: {
          views: number;
          likes: number;
          replies: number;
          reposts: number;
        };
      }>;
    };
  };
  weeklyEnabled?: boolean;
  monthlyEnabled?: boolean;
}

type ReportPeriod = 'week' | 'month' | 'custom';

export function ReportGenerator({ data, weeklyEnabled = true, monthlyEnabled = true }: ReportGeneratorProps) {
  const [period, setPeriod] = useState<ReportPeriod>('week');
  const [generating, setGenerating] = useState(false);
  const [customStart, setCustomStart] = useState('');
  const [customEnd, setCustomEnd] = useState('');

  const filterPostsByPeriod = () => {
    const now = new Date();
    let startDate: Date;
    let endDate = now;

    if (period === 'week') {
      startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    } else if (period === 'month') {
      startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    } else {
      startDate = customStart ? new Date(customStart) : new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      endDate = customEnd ? new Date(customEnd) : now;
    }

    return data.threads.data.filter(post => {
      const postDate = new Date(post.timestamp);
      return postDate >= startDate && postDate <= endDate;
    });
  };

  const generateReport = () => {
    setGenerating(true);

    const posts = filterPostsByPeriod();
    const stats = {
      totalViews: posts.reduce((sum, p) => sum + p.insights.views, 0),
      totalLikes: posts.reduce((sum, p) => sum + p.insights.likes, 0),
      totalReplies: posts.reduce((sum, p) => sum + p.insights.replies, 0),
      totalReposts: posts.reduce((sum, p) => sum + p.insights.reposts, 0),
      postCount: posts.length,
    };

    const engagementRate = stats.totalViews > 0
      ? ((stats.totalLikes + stats.totalReplies + stats.totalReposts) / stats.totalViews * 100)
      : 0;

    const topPosts = [...posts]
      .sort((a, b) => b.insights.likes - a.insights.likes)
      .slice(0, 5);

    const periodLabel = period === 'week' ? '週間' : period === 'month' ? '月間' : 'カスタム期間';
    const dateRange = period === 'custom' && customStart && customEnd
      ? `${customStart} - ${customEnd}`
      : period === 'week'
        ? `${new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toLocaleDateString('ja-JP')} - ${new Date().toLocaleDateString('ja-JP')}`
        : `${new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toLocaleDateString('ja-JP')} - ${new Date().toLocaleDateString('ja-JP')}`;

    const reportContent = `
# Threads ${periodLabel}レポート
## @${data.profile.username}

**期間**: ${dateRange}
**レポート生成日**: ${new Date().toLocaleDateString('ja-JP')}

---

## サマリー

| 指標 | 数値 |
|------|------|
| 投稿数 | ${stats.postCount}件 |
| 総閲覧数 | ${stats.totalViews.toLocaleString()} |
| 総いいね | ${stats.totalLikes.toLocaleString()} |
| 総リプライ | ${stats.totalReplies.toLocaleString()} |
| 総リポスト | ${stats.totalReposts.toLocaleString()} |
| エンゲージメント率 | ${engagementRate.toFixed(2)}% |

---

## トップ投稿

${topPosts.map((post, i) => `
### ${i + 1}.
**テキスト**: ${(post.text || '(メディアのみ)').substring(0, 100)}${(post.text?.length || 0) > 100 ? '...' : ''}

- 閲覧数: ${post.insights.views.toLocaleString()}
- いいね: ${post.insights.likes.toLocaleString()}
- リプライ: ${post.insights.replies.toLocaleString()}
- リポスト: ${post.insights.reposts.toLocaleString()}
`).join('\n')}

---

## 推奨アクション

${engagementRate < 1 ? '- エンゲージメント率が低めです。より対話的なコンテンツを検討してください。' : '- エンゲージメント率は良好です。この調子を維持しましょう。'}
${stats.postCount < 7 ? '- 投稿頻度を上げることで、より多くのリーチを獲得できる可能性があります。' : ''}
${topPosts[0] ? `- 最もパフォーマンスの良かった投稿のスタイルを参考にしてみてください。` : ''}

---

*このレポートはThreads Studioで自動生成されました*
`.trim();

    // Markdownとしてダウンロード
    const blob = new Blob([reportContent], { type: 'text/markdown;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `threads-report-${data.profile.username}-${period}-${new Date().toISOString().split('T')[0]}.md`;
    a.click();
    URL.revokeObjectURL(url);

    setGenerating(false);
  };

  const generatePDFReport = () => {
    setGenerating(true);

    const posts = filterPostsByPeriod();
    const stats = {
      totalViews: posts.reduce((sum, p) => sum + p.insights.views, 0),
      totalLikes: posts.reduce((sum, p) => sum + p.insights.likes, 0),
      totalReplies: posts.reduce((sum, p) => sum + p.insights.replies, 0),
      totalReposts: posts.reduce((sum, p) => sum + p.insights.reposts, 0),
      postCount: posts.length,
    };

    const engagementRate = stats.totalViews > 0
      ? ((stats.totalLikes + stats.totalReplies + stats.totalReposts) / stats.totalViews * 100)
      : 0;

    const topPosts = [...posts]
      .sort((a, b) => b.insights.likes - a.insights.likes)
      .slice(0, 5);

    const periodLabel = period === 'week' ? '週間' : period === 'month' ? '月間' : 'カスタム期間';

    // HTML形式でレポートを生成（印刷用）
    const htmlContent = `
<!DOCTYPE html>
<html lang="ja">
<head>
  <meta charset="UTF-8">
  <title>Threads ${periodLabel}レポート - @${data.profile.username}</title>
  <style>
    body { font-family: 'Hiragino Sans', 'Yu Gothic', sans-serif; max-width: 800px; margin: 0 auto; padding: 40px; }
    h1 { color: #7c3aed; border-bottom: 2px solid #7c3aed; padding-bottom: 10px; }
    h2 { color: #334155; margin-top: 30px; }
    table { width: 100%; border-collapse: collapse; margin: 20px 0; }
    th, td { border: 1px solid #e2e8f0; padding: 12px; text-align: left; }
    th { background: #f8fafc; }
    .stat-card { display: inline-block; background: #f8fafc; padding: 15px 25px; margin: 5px; border-radius: 8px; }
    .stat-value { font-size: 24px; font-weight: bold; color: #7c3aed; }
    .stat-label { font-size: 12px; color: #64748b; }
    .post-card { background: #f8fafc; padding: 15px; margin: 10px 0; border-radius: 8px; border-left: 3px solid #7c3aed; }
    .post-text { margin-bottom: 10px; }
    .post-stats { display: flex; gap: 15px; font-size: 14px; color: #64748b; }
    @media print { body { padding: 20px; } }
  </style>
</head>
<body>
  <h1>Threads ${periodLabel}レポート</h1>
  <p><strong>@${data.profile.username}</strong></p>
  <p>レポート生成日: ${new Date().toLocaleDateString('ja-JP')}</p>

  <h2>サマリー</h2>
  <div style="display: flex; flex-wrap: wrap; gap: 10px; margin: 20px 0;">
    <div class="stat-card">
      <div class="stat-value">${stats.postCount}</div>
      <div class="stat-label">投稿数</div>
    </div>
    <div class="stat-card">
      <div class="stat-value">${stats.totalViews.toLocaleString()}</div>
      <div class="stat-label">総閲覧数</div>
    </div>
    <div class="stat-card">
      <div class="stat-value">${stats.totalLikes.toLocaleString()}</div>
      <div class="stat-label">総いいね</div>
    </div>
    <div class="stat-card">
      <div class="stat-value">${stats.totalReplies.toLocaleString()}</div>
      <div class="stat-label">総リプライ</div>
    </div>
    <div class="stat-card">
      <div class="stat-value">${engagementRate.toFixed(2)}%</div>
      <div class="stat-label">エンゲージメント率</div>
    </div>
  </div>

  <h2>トップ投稿</h2>
  ${topPosts.map((post, i) => `
    <div class="post-card">
      <strong>#${i + 1}</strong>
      <div class="post-text">${(post.text || '(メディアのみ)').substring(0, 150)}${(post.text?.length || 0) > 150 ? '...' : ''}</div>
      <div class="post-stats">
        <span>閲覧 ${post.insights.views.toLocaleString()}</span>
        <span>いいね ${post.insights.likes.toLocaleString()}</span>
        <span>リプライ ${post.insights.replies.toLocaleString()}</span>
        <span>リポスト ${post.insights.reposts.toLocaleString()}</span>
      </div>
    </div>
  `).join('')}

  <h2>アカウント情報</h2>
  <table>
    <tr><th>フォロワー数</th><td>${data.aggregatedStats.followersCount.toLocaleString()}</td></tr>
    <tr><th>総投稿数</th><td>${data.aggregatedStats.postCount}</td></tr>
    <tr><th>平均エンゲージメント率</th><td>${data.analytics.averageEngagementRate.toFixed(2)}%</td></tr>
  </table>

  <p style="margin-top: 40px; font-size: 12px; color: #94a3b8; text-align: center;">
    このレポートはThreads Studioで自動生成されました
  </p>
</body>
</html>
`.trim();

    // 新しいウィンドウで開いて印刷
    const printWindow = window.open('', '_blank');
    if (printWindow) {
      printWindow.document.write(htmlContent);
      printWindow.document.close();
      printWindow.print();
    }

    setGenerating(false);
  };

  return (
    <div className="space-y-6">
      {/* レポート設定 */}
      <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-700 p-5">
        <h2 className="text-lg font-bold text-slate-900 dark:text-white mb-4">レポート生成</h2>

        <div className="space-y-4">
          {/* 期間選択 */}
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
              レポート期間
            </label>
            <div className="flex flex-wrap gap-2">
              {weeklyEnabled && (
                <button
                  onClick={() => setPeriod('week')}
                  className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                    period === 'week'
                      ? 'bg-violet-100 text-violet-700'
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-400'
                  }`}
                >
                  週間レポート
                </button>
              )}
              {monthlyEnabled && (
                <button
                  onClick={() => setPeriod('month')}
                  className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                    period === 'month'
                      ? 'bg-violet-100 text-violet-700'
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-400'
                  }`}
                >
                  月間レポート
                </button>
              )}
              <button
                onClick={() => setPeriod('custom')}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                  period === 'custom'
                    ? 'bg-violet-100 text-violet-700'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-400'
                }`}
              >
                カスタム期間
              </button>
            </div>
          </div>

          {/* カスタム期間入力 */}
          {period === 'custom' && (
            <div className="flex gap-4">
              <div className="flex-1">
                <label className="block text-sm text-slate-600 dark:text-slate-400 mb-1">開始日</label>
                <input
                  type="date"
                  value={customStart}
                  onChange={(e) => setCustomStart(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-200 dark:border-slate-700 rounded-lg dark:bg-slate-800"
                />
              </div>
              <div className="flex-1">
                <label className="block text-sm text-slate-600 dark:text-slate-400 mb-1">終了日</label>
                <input
                  type="date"
                  value={customEnd}
                  onChange={(e) => setCustomEnd(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-200 dark:border-slate-700 rounded-lg dark:bg-slate-800"
                />
              </div>
            </div>
          )}

          {/* 生成ボタン */}
          <div className="flex gap-3 pt-4">
            <button
              onClick={generateReport}
              disabled={generating}
              className="px-6 py-2.5 bg-violet-600 text-white rounded-lg hover:bg-violet-700 disabled:opacity-50 font-medium"
            >
              {generating ? '生成中...' : 'Markdownでダウンロード'}
            </button>
            <button
              onClick={generatePDFReport}
              disabled={generating}
              className="px-6 py-2.5 bg-slate-600 text-white rounded-lg hover:bg-slate-700 disabled:opacity-50 font-medium"
            >
              印刷用HTMLを開く
            </button>
          </div>
        </div>
      </div>

      {/* プレビュー */}
      <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-700 p-5">
        <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-300 mb-4">プレビュー</h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="bg-slate-50 dark:bg-slate-800 rounded-lg p-4 text-center">
            <p className="text-2xl font-bold text-violet-600">{filterPostsByPeriod().length}</p>
            <p className="text-xs text-slate-500">投稿数</p>
          </div>
          <div className="bg-slate-50 dark:bg-slate-800 rounded-lg p-4 text-center">
            <p className="text-2xl font-bold text-violet-600">
              {filterPostsByPeriod().reduce((sum, p) => sum + p.insights.views, 0).toLocaleString()}
            </p>
            <p className="text-xs text-slate-500">閲覧数</p>
          </div>
          <div className="bg-slate-50 dark:bg-slate-800 rounded-lg p-4 text-center">
            <p className="text-2xl font-bold text-violet-600">
              {filterPostsByPeriod().reduce((sum, p) => sum + p.insights.likes, 0).toLocaleString()}
            </p>
            <p className="text-xs text-slate-500">いいね</p>
          </div>
          <div className="bg-slate-50 dark:bg-slate-800 rounded-lg p-4 text-center">
            <p className="text-2xl font-bold text-violet-600">
              {filterPostsByPeriod().reduce((sum, p) => sum + p.insights.replies, 0).toLocaleString()}
            </p>
            <p className="text-xs text-slate-500">リプライ</p>
          </div>
        </div>
      </div>
    </div>
  );
}
