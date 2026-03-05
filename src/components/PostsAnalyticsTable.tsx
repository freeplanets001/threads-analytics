'use client';

import { useState, useMemo } from 'react';

interface Post {
  id: string;
  text: string;
  timestamp: string;
  media_type: string;
  media_url?: string;
  permalink?: string;
  likes?: number;
  replies?: number;
  reposts?: number;
  quotes?: number;
  views?: number;
}

interface PostsAnalyticsTableProps {
  posts: Post[];
  onRefresh?: () => void;
  onLoadAll?: () => void;
  loading?: boolean;
  loadingAll?: boolean;
  totalAvailable?: number;
}

type SortKey = 'timestamp' | 'likes' | 'replies' | 'reposts' | 'views' | 'engagement';
type SortOrder = 'asc' | 'desc';

export function PostsAnalyticsTable({ posts, onRefresh, onLoadAll, loading = false, loadingAll = false, totalAvailable }: PostsAnalyticsTableProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [sortKey, setSortKey] = useState<SortKey>('timestamp');
  const [sortOrder, setSortOrder] = useState<SortOrder>('desc');
  const [filterType, setFilterType] = useState<'all' | 'text' | 'image' | 'video' | 'carousel'>('all');
  const [dateRange, setDateRange] = useState<'all' | '7d' | '30d' | '90d' | 'custom'>('all');
  const [customDateFrom, setCustomDateFrom] = useState('');
  const [customDateTo, setCustomDateTo] = useState('');
  const [engagementFilter, setEngagementFilter] = useState<'all' | 'high' | 'medium' | 'low'>('all');
  const [currentPage, setCurrentPage] = useState(1);
  const [selectedPosts, setSelectedPosts] = useState<Set<string>>(new Set());
  const [itemsPerPage, setItemsPerPage] = useState<number>(20);

  // フィルタリングとソート
  const filteredAndSortedPosts = useMemo(() => {
    let result = [...posts];

    // 検索フィルター
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      result = result.filter(p => p.text?.toLowerCase().includes(q));
    }

    // メディアタイプフィルター
    if (filterType !== 'all') {
      const typeMap: Record<string, string[]> = {
        text: ['TEXT_POST'],
        image: ['IMAGE'],
        video: ['VIDEO'],
        carousel: ['CAROUSEL_ALBUM'],
      };
      result = result.filter(p => typeMap[filterType]?.includes(p.media_type));
    }

    // 日付範囲フィルター
    if (dateRange === 'custom') {
      if (customDateFrom) {
        const from = new Date(customDateFrom);
        result = result.filter(p => new Date(p.timestamp) >= from);
      }
      if (customDateTo) {
        const to = new Date(customDateTo + 'T23:59:59');
        result = result.filter(p => new Date(p.timestamp) <= to);
      }
    } else if (dateRange !== 'all') {
      const now = new Date();
      const days = dateRange === '7d' ? 7 : dateRange === '30d' ? 30 : 90;
      const cutoff = new Date(now.getTime() - days * 24 * 60 * 60 * 1000);
      result = result.filter(p => new Date(p.timestamp) >= cutoff);
    }

    // エンゲージメントフィルター
    if (engagementFilter !== 'all') {
      result = result.filter(p => {
        const eng = (p.likes || 0) + (p.replies || 0) + (p.reposts || 0);
        if (engagementFilter === 'high') return eng >= 50;
        if (engagementFilter === 'medium') return eng >= 10 && eng < 50;
        return eng < 10; // low
      });
    }

    // ソート
    result.sort((a, b) => {
      let aVal: number, bVal: number;
      switch (sortKey) {
        case 'timestamp':
          aVal = new Date(a.timestamp).getTime();
          bVal = new Date(b.timestamp).getTime();
          break;
        case 'likes':
          aVal = a.likes || 0;
          bVal = b.likes || 0;
          break;
        case 'replies':
          aVal = a.replies || 0;
          bVal = b.replies || 0;
          break;
        case 'reposts':
          aVal = a.reposts || 0;
          bVal = b.reposts || 0;
          break;
        case 'views':
          aVal = a.views || 0;
          bVal = b.views || 0;
          break;
        case 'engagement':
          aVal = (a.likes || 0) + (a.replies || 0) + (a.reposts || 0);
          bVal = (b.likes || 0) + (b.replies || 0) + (b.reposts || 0);
          break;
        default:
          return 0;
      }
      return sortOrder === 'asc' ? aVal - bVal : bVal - aVal;
    });

    return result;
  }, [posts, searchQuery, sortKey, sortOrder, filterType, dateRange, customDateFrom, customDateTo, engagementFilter]);

  // ページネーション
  const totalPages = Math.ceil(filteredAndSortedPosts.length / itemsPerPage);
  const paginatedPosts = filteredAndSortedPosts.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  );

  // 統計サマリー
  const stats = useMemo(() => {
    const total = filteredAndSortedPosts.length;
    const totalLikes = filteredAndSortedPosts.reduce((sum, p) => sum + (p.likes || 0), 0);
    const totalReplies = filteredAndSortedPosts.reduce((sum, p) => sum + (p.replies || 0), 0);
    const totalReposts = filteredAndSortedPosts.reduce((sum, p) => sum + (p.reposts || 0), 0);
    const totalViews = filteredAndSortedPosts.reduce((sum, p) => sum + (p.views || 0), 0);
    const avgEngagement = total > 0 ? (totalLikes + totalReplies + totalReposts) / total : 0;

    return { total, totalLikes, totalReplies, totalReposts, totalViews, avgEngagement };
  }, [filteredAndSortedPosts]);

  // ソートハンドラー
  const handleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortKey(key);
      setSortOrder('desc');
    }
  };

  // 選択
  const toggleSelect = (id: string) => {
    const newSet = new Set(selectedPosts);
    if (newSet.has(id)) newSet.delete(id);
    else newSet.add(id);
    setSelectedPosts(newSet);
  };

  const toggleSelectAll = () => {
    if (selectedPosts.size === paginatedPosts.length) {
      setSelectedPosts(new Set());
    } else {
      setSelectedPosts(new Set(paginatedPosts.map(p => p.id)));
    }
  };

  // CSVエクスポート
  const exportToCSV = () => {
    const headers = ['日時', 'テキスト', 'タイプ', 'いいね', 'リプライ', 'リポスト', '閲覧数', 'URL'];
    const rows = filteredAndSortedPosts.map(p => [
      new Date(p.timestamp).toLocaleString('ja-JP'),
      `"${(p.text || '').replace(/"/g, '""')}"`,
      p.media_type,
      p.likes || 0,
      p.replies || 0,
      p.reposts || 0,
      p.views || 0,
      p.permalink || '',
    ]);

    const csv = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `threads-analytics-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const formatNumber = (n: number) => {
    if (n >= 1000000) return (n / 1000000).toFixed(1) + 'M';
    if (n >= 1000) return (n / 1000).toFixed(1) + 'K';
    return n.toString();
  };

  const formatDate = (d: string) => {
    const date = new Date(d);
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const days = Math.floor(diff / (24 * 60 * 60 * 1000));

    if (days === 0) return '今日 ' + date.toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit' });
    if (days === 1) return '昨日';
    if (days < 7) return `${days}日前`;
    return date.toLocaleDateString('ja-JP', { month: 'short', day: 'numeric' });
  };

  const getMediaIcon = (type: string) => {
    switch (type) {
      case 'IMAGE': return '🖼️';
      case 'VIDEO': return '🎬';
      case 'CAROUSEL_ALBUM': return '📚';
      default: return '📝';
    }
  };

  return (
    <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
      {/* ヘッダー */}
      <div className="p-4 border-b border-slate-200">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-bold text-slate-900 flex items-center gap-2">
            📊 投稿インサイト一覧
            <span className="text-sm font-normal text-slate-500">({stats.total}件)</span>
          </h3>
          <div className="flex items-center gap-2">
            {onLoadAll && posts.length < (totalAvailable || 100) && (
              <button
                onClick={onLoadAll}
                disabled={loadingAll || loading}
                className="px-3 py-1.5 text-sm bg-violet-100 text-violet-700 rounded-lg hover:bg-violet-200 disabled:opacity-50"
              >
                {loadingAll ? '読込中...' : '全件読込'}
              </button>
            )}
            <button
              onClick={exportToCSV}
              className="px-3 py-1.5 text-sm bg-green-100 text-green-700 rounded-lg hover:bg-green-200"
            >
              CSV
            </button>
            {onRefresh && (
              <button
                onClick={onRefresh}
                disabled={loading || loadingAll}
                className="px-3 py-1.5 text-sm bg-slate-100 text-slate-700 rounded-lg hover:bg-slate-200 disabled:opacity-50"
              >
                {loading ? '更新中...' : '更新'}
              </button>
            )}
          </div>
        </div>

        {/* フィルター */}
        <div className="flex flex-wrap gap-3">
          {/* 検索 */}
          <div className="flex-1 min-w-[200px]">
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => { setSearchQuery(e.target.value); setCurrentPage(1); }}
              placeholder="投稿を検索..."
              className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-violet-500"
            />
          </div>

          {/* タイプフィルター */}
          <select
            value={filterType}
            onChange={(e) => { setFilterType(e.target.value as typeof filterType); setCurrentPage(1); }}
            className="px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-violet-500"
          >
            <option value="all">全タイプ</option>
            <option value="text">テキスト</option>
            <option value="image">画像</option>
            <option value="video">動画</option>
            <option value="carousel">カルーセル</option>
          </select>

          {/* 日付フィルター */}
          <select
            value={dateRange}
            onChange={(e) => { setDateRange(e.target.value as typeof dateRange); setCurrentPage(1); }}
            className="px-3 py-2 border border-slate-200 rounded-lg text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-violet-500"
          >
            <option value="all">全期間</option>
            <option value="7d">過去7日</option>
            <option value="30d">過去30日</option>
            <option value="90d">過去90日</option>
            <option value="custom">カスタム</option>
          </select>

          {/* エンゲージメントフィルター */}
          <select
            value={engagementFilter}
            onChange={(e) => { setEngagementFilter(e.target.value as typeof engagementFilter); setCurrentPage(1); }}
            className="px-3 py-2 border border-slate-200 rounded-lg text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-violet-500"
          >
            <option value="all">全エンゲージメント</option>
            <option value="high">高 (50+)</option>
            <option value="medium">中 (10-49)</option>
            <option value="low">低 (10未満)</option>
          </select>

          {/* 表示件数 */}
          <select
            value={itemsPerPage}
            onChange={(e) => {
              const val = e.target.value === 'all' ? 9999 : Number(e.target.value);
              setItemsPerPage(val);
              setCurrentPage(1);
            }}
            className="px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-violet-500"
          >
            <option value={20}>20件表示</option>
            <option value={50}>50件表示</option>
            <option value={100}>100件表示</option>
            <option value={150}>150件表示</option>
            <option value="all">全件表示</option>
          </select>
        </div>

        {/* カスタム日付範囲 */}
        {dateRange === 'custom' && (
          <div className="flex items-center gap-2 mt-3">
            <input
              type="date"
              value={customDateFrom}
              onChange={(e) => { setCustomDateFrom(e.target.value); setCurrentPage(1); }}
              className="px-3 py-2 border border-slate-200 rounded-lg text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-violet-500"
            />
            <span className="text-sm text-slate-400">〜</span>
            <input
              type="date"
              value={customDateTo}
              onChange={(e) => { setCustomDateTo(e.target.value); setCurrentPage(1); }}
              className="px-3 py-2 border border-slate-200 rounded-lg text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-violet-500"
            />
            {(customDateFrom || customDateTo) && (
              <button
                onClick={() => { setCustomDateFrom(''); setCustomDateTo(''); setCurrentPage(1); }}
                className="px-2 py-1 text-xs text-slate-500 hover:text-slate-700"
              >
                クリア
              </button>
            )}
          </div>
        )}
      </div>

      {/* 統計サマリー */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2 p-3 bg-slate-50 border-b border-slate-200">
        {[
          { label: '投稿数', value: stats.total, icon: '📝' },
          { label: '総いいね', value: formatNumber(stats.totalLikes), icon: '❤️' },
          { label: '総リプライ', value: formatNumber(stats.totalReplies), icon: '💬' },
          { label: '総リポスト', value: formatNumber(stats.totalReposts), icon: '🔄' },
          { label: '総閲覧', value: formatNumber(stats.totalViews), icon: '👁️' },
          { label: '平均エンゲージ', value: stats.avgEngagement.toFixed(1), icon: '📈' },
        ].map(s => (
          <div key={s.label} className="bg-white rounded-lg p-2 text-center">
            <div className="text-xs text-slate-500">{s.icon} {s.label}</div>
            <div className="font-bold text-slate-900">{s.value}</div>
          </div>
        ))}
      </div>

      {/* テーブル */}
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead className="bg-slate-50 border-b border-slate-200">
            <tr>
              <th className="w-8 px-3 py-2">
                <input
                  type="checkbox"
                  checked={selectedPosts.size === paginatedPosts.length && paginatedPosts.length > 0}
                  onChange={toggleSelectAll}
                  className="w-4 h-4"
                />
              </th>
              <th className="px-3 py-2 text-left text-xs font-medium text-slate-500 uppercase">投稿</th>
              <th
                className="px-3 py-2 text-center text-xs font-medium text-slate-500 uppercase cursor-pointer hover:text-violet-600"
                onClick={() => handleSort('timestamp')}
              >
                日時 {sortKey === 'timestamp' && (sortOrder === 'desc' ? '▼' : '▲')}
              </th>
              <th
                className="px-3 py-2 text-center text-xs font-medium text-slate-500 uppercase cursor-pointer hover:text-violet-600"
                onClick={() => handleSort('likes')}
              >
                ❤️ {sortKey === 'likes' && (sortOrder === 'desc' ? '▼' : '▲')}
              </th>
              <th
                className="px-3 py-2 text-center text-xs font-medium text-slate-500 uppercase cursor-pointer hover:text-violet-600"
                onClick={() => handleSort('replies')}
              >
                💬 {sortKey === 'replies' && (sortOrder === 'desc' ? '▼' : '▲')}
              </th>
              <th
                className="px-3 py-2 text-center text-xs font-medium text-slate-500 uppercase cursor-pointer hover:text-violet-600"
                onClick={() => handleSort('reposts')}
              >
                🔄 {sortKey === 'reposts' && (sortOrder === 'desc' ? '▼' : '▲')}
              </th>
              <th
                className="px-3 py-2 text-center text-xs font-medium text-slate-500 uppercase cursor-pointer hover:text-violet-600"
                onClick={() => handleSort('views')}
              >
                👁️ {sortKey === 'views' && (sortOrder === 'desc' ? '▼' : '▲')}
              </th>
              <th
                className="px-3 py-2 text-center text-xs font-medium text-slate-500 uppercase cursor-pointer hover:text-violet-600"
                onClick={() => handleSort('engagement')}
              >
                📈 {sortKey === 'engagement' && (sortOrder === 'desc' ? '▼' : '▲')}
              </th>
              <th className="px-3 py-2 text-center text-xs font-medium text-slate-500 uppercase">操作</th>
            </tr>
          </thead>
          <tbody>
            {paginatedPosts.length === 0 ? (
              <tr>
                <td colSpan={9} className="px-4 py-8 text-center text-slate-500">
                  {loading ? '読み込み中...' : '投稿がありません'}
                </td>
              </tr>
            ) : (
              paginatedPosts.map(post => (
                <tr key={post.id} className="border-b border-slate-100 hover:bg-slate-50">
                  <td className="px-3 py-2">
                    <input
                      type="checkbox"
                      checked={selectedPosts.has(post.id)}
                      onChange={() => toggleSelect(post.id)}
                      className="w-4 h-4"
                    />
                  </td>
                  <td className="px-3 py-2">
                    <div className="flex items-start gap-2">
                      <span className="text-lg">{getMediaIcon(post.media_type)}</span>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm text-slate-900 line-clamp-2">{post.text || '（テキストなし）'}</p>
                        {post.media_url && (
                          <div className="mt-1">
                            {post.media_type === 'VIDEO' ? (
                              <video src={post.media_url} className="h-12 w-auto rounded" />
                            ) : (
                              <img src={post.media_url} alt="" className="h-12 w-auto rounded object-cover" />
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  </td>
                  <td className="px-3 py-2 text-center text-xs text-slate-500 whitespace-nowrap">
                    {formatDate(post.timestamp)}
                  </td>
                  <td className="px-3 py-2 text-center font-medium text-slate-900">{formatNumber(post.likes || 0)}</td>
                  <td className="px-3 py-2 text-center font-medium text-slate-900">{formatNumber(post.replies || 0)}</td>
                  <td className="px-3 py-2 text-center font-medium text-slate-900">{formatNumber(post.reposts || 0)}</td>
                  <td className="px-3 py-2 text-center font-medium text-slate-900">{formatNumber(post.views || 0)}</td>
                  <td className="px-3 py-2 text-center font-medium text-violet-600">
                    {((post.likes || 0) + (post.replies || 0) + (post.reposts || 0))}
                  </td>
                  <td className="px-3 py-2 text-center">
                    <div className="flex items-center justify-center gap-1">
                      {post.permalink && (
                        <a
                          href={post.permalink}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="p-1 text-violet-600 hover:bg-violet-50 rounded"
                          title="Threadsで開く"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                          </svg>
                        </a>
                      )}
                      <button
                        onClick={() => {
                          navigator.clipboard.writeText(post.text || '');
                          alert('テキストをコピーしました');
                        }}
                        className="p-1 text-slate-500 hover:bg-slate-50 rounded"
                        title="テキストをコピー"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                        </svg>
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* ページネーション */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between px-4 py-3 border-t border-slate-200">
          <div className="text-sm text-slate-500">
            {(currentPage - 1) * itemsPerPage + 1} - {Math.min(currentPage * itemsPerPage, filteredAndSortedPosts.length)} / {filteredAndSortedPosts.length}件
          </div>
          <div className="flex items-center gap-1">
            <button
              onClick={() => setCurrentPage(1)}
              disabled={currentPage === 1}
              className="px-2 py-1 text-sm rounded hover:bg-slate-100 disabled:opacity-50"
            >
              ««
            </button>
            <button
              onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
              disabled={currentPage === 1}
              className="px-2 py-1 text-sm rounded hover:bg-slate-100 disabled:opacity-50"
            >
              «
            </button>
            <span className="px-3 py-1 text-sm">
              {currentPage} / {totalPages}
            </span>
            <button
              onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
              disabled={currentPage === totalPages}
              className="px-2 py-1 text-sm rounded hover:bg-slate-100 disabled:opacity-50"
            >
              »
            </button>
            <button
              onClick={() => setCurrentPage(totalPages)}
              disabled={currentPage === totalPages}
              className="px-2 py-1 text-sm rounded hover:bg-slate-100 disabled:opacity-50"
            >
              »»
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
