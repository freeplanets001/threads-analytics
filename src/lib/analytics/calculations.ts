// 世界一のThreads分析ツール - 分析ロジック

import { format, parseISO, getDay, getHours, differenceInDays } from 'date-fns';
import { ja } from 'date-fns/locale';

export interface PostData {
  id: string;
  text?: string;
  timestamp: string;
  media_type: string;
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

export interface AnalyticsResult {
  // 基本指標
  totalPosts: number;
  totalViews: number;
  totalEngagement: number;
  averageEngagementRate: number;

  // エンゲージメント詳細
  totalLikes: number;
  totalReplies: number;
  totalReposts: number;
  totalQuotes: number;
  totalShares: number;

  // パフォーマンス分析
  topPosts: PostData[];
  worstPosts: PostData[];

  // 投稿時間分析
  bestPostingHours: Array<{ hour: number; avgEngagement: number }>;
  bestPostingDays: Array<{ day: string; avgEngagement: number }>;

  // コンテンツ分析
  contentAnalysis: {
    avgTextLength: number;
    textLengthCorrelation: Array<{ range: string; avgEngagement: number; count: number }>;
    emojiUsageImpact: { withEmoji: number; withoutEmoji: number };
    quotePostPerformance: { quote: number; original: number };
    mediaTypePerformance: Array<{ type: string; avgEngagement: number; count: number }>;
  };

  // バイラル分析
  viralMetrics: {
    viralCoefficient: number; // (reposts + quotes) / views
    shareRate: number;
    replyRate: number;
  };

  // 成長分析
  growthMetrics: {
    postsPerDay: number;
    viewsPerPost: number;
    engagementTrend: 'up' | 'down' | 'stable';
  };
}

export interface CompetitorComparison {
  username: string;
  profilePicture?: string;
  bio?: string;
  postCount: number;
  totalLikes: number;
  totalReplies: number;
  totalReposts: number;
  avgLikesPerPost: number;
  avgRepliesPerPost: number;
  avgEngagementPerPost: number;
  postingFrequency: number; // posts per day
  topPost: PostData | null;
  contentStrategy: {
    avgTextLength: number;
    emojiUsageRate: number;
    quotePostRate: number;
  };
}

// エンゲージメント率を計算
export function calculateEngagementRate(post: PostData): number {
  const { views, likes, replies, reposts, quotes } = post.insights;
  if (views === 0) return 0;
  return ((likes + replies + reposts + quotes) / views) * 100;
}

// 投稿スコアを計算（複合指標）
export function calculatePostScore(post: PostData): number {
  const { views, likes, replies, reposts, quotes, shares } = post.insights;
  // 重み付けスコア: いいね(1) + リプライ(2) + リポスト(3) + 引用(4) + シェア(2) + views/100
  return likes + (replies * 2) + (reposts * 3) + (quotes * 4) + (shares * 2) + (views / 100);
}

// 絵文字が含まれているかチェック
function containsEmoji(text: string): boolean {
  const emojiRegex = /[\u{1F300}-\u{1F9FF}]|[\u{2600}-\u{26FF}]|[\u{2700}-\u{27BF}]/u;
  return emojiRegex.test(text);
}

// テキスト長さの範囲を取得
function getTextLengthRange(length: number): string {
  if (length === 0) return '0';
  if (length <= 50) return '1-50';
  if (length <= 100) return '51-100';
  if (length <= 200) return '101-200';
  if (length <= 300) return '201-300';
  return '300+';
}

// 曜日名を取得
function getDayName(dayIndex: number): string {
  const days = ['日曜日', '月曜日', '火曜日', '水曜日', '木曜日', '金曜日', '土曜日'];
  return days[dayIndex];
}

// メイン分析関数
export function analyzePostsPerformance(posts: PostData[]): AnalyticsResult {
  if (posts.length === 0) {
    return getEmptyAnalyticsResult();
  }

  // 基本集計
  let totalViews = 0;
  let totalLikes = 0;
  let totalReplies = 0;
  let totalReposts = 0;
  let totalQuotes = 0;
  let totalShares = 0;

  // 投稿時間別集計
  const hourlyEngagement: Record<number, { total: number; count: number }> = {};
  const dailyEngagement: Record<number, { total: number; count: number }> = {};

  // コンテンツ分析用
  let totalTextLength = 0;
  const textLengthGroups: Record<string, { total: number; count: number }> = {};
  let emojiPostEngagement = 0;
  let emojiPostCount = 0;
  let nonEmojiPostEngagement = 0;
  let nonEmojiPostCount = 0;
  let quotePostEngagement = 0;
  let quotePostCount = 0;
  let originalPostEngagement = 0;
  let originalPostCount = 0;
  const mediaTypeGroups: Record<string, { total: number; count: number }> = {};

  // 各投稿を分析
  const postsWithScores = posts.map(post => {
    const { views, likes, replies, reposts, quotes, shares } = post.insights;
    const engagement = likes + replies + reposts + quotes;
    const score = calculatePostScore(post);

    totalViews += views;
    totalLikes += likes;
    totalReplies += replies;
    totalReposts += reposts;
    totalQuotes += quotes;
    totalShares += shares;

    // 投稿時間分析
    const postDate = parseISO(post.timestamp);
    const hour = getHours(postDate);
    const day = getDay(postDate);

    if (!hourlyEngagement[hour]) hourlyEngagement[hour] = { total: 0, count: 0 };
    hourlyEngagement[hour].total += engagement;
    hourlyEngagement[hour].count += 1;

    if (!dailyEngagement[day]) dailyEngagement[day] = { total: 0, count: 0 };
    dailyEngagement[day].total += engagement;
    dailyEngagement[day].count += 1;

    // テキスト分析
    const textLength = post.text?.length || 0;
    totalTextLength += textLength;
    const lengthRange = getTextLengthRange(textLength);
    if (!textLengthGroups[lengthRange]) textLengthGroups[lengthRange] = { total: 0, count: 0 };
    textLengthGroups[lengthRange].total += engagement;
    textLengthGroups[lengthRange].count += 1;

    // 絵文字分析
    if (post.text && containsEmoji(post.text)) {
      emojiPostEngagement += engagement;
      emojiPostCount += 1;
    } else {
      nonEmojiPostEngagement += engagement;
      nonEmojiPostCount += 1;
    }

    // 引用投稿分析
    if (post.is_quote_post) {
      quotePostEngagement += engagement;
      quotePostCount += 1;
    } else {
      originalPostEngagement += engagement;
      originalPostCount += 1;
    }

    // メディアタイプ分析
    const mediaType = post.media_type;
    if (!mediaTypeGroups[mediaType]) mediaTypeGroups[mediaType] = { total: 0, count: 0 };
    mediaTypeGroups[mediaType].total += engagement;
    mediaTypeGroups[mediaType].count += 1;

    return { ...post, score, engagement };
  });

  // スコアでソート
  const sortedPosts = [...postsWithScores].sort((a, b) => b.score - a.score);
  const topPosts = sortedPosts.slice(0, 5);
  const worstPosts = sortedPosts.slice(-5).reverse();

  // 時間別分析結果
  const bestPostingHours = Object.entries(hourlyEngagement)
    .map(([hour, data]) => ({
      hour: parseInt(hour),
      avgEngagement: data.count > 0 ? data.total / data.count : 0,
    }))
    .sort((a, b) => b.avgEngagement - a.avgEngagement);

  const bestPostingDays = Object.entries(dailyEngagement)
    .map(([day, data]) => ({
      day: getDayName(parseInt(day)),
      avgEngagement: data.count > 0 ? data.total / data.count : 0,
    }))
    .sort((a, b) => b.avgEngagement - a.avgEngagement);

  // テキスト長さ相関
  const textLengthCorrelation = Object.entries(textLengthGroups)
    .map(([range, data]) => ({
      range,
      avgEngagement: data.count > 0 ? data.total / data.count : 0,
      count: data.count,
    }))
    .sort((a, b) => {
      const order = ['0', '1-50', '51-100', '101-200', '201-300', '300+'];
      return order.indexOf(a.range) - order.indexOf(b.range);
    });

  // メディアタイプパフォーマンス
  const mediaTypePerformance = Object.entries(mediaTypeGroups)
    .map(([type, data]) => ({
      type: getMediaTypeName(type),
      avgEngagement: data.count > 0 ? data.total / data.count : 0,
      count: data.count,
    }))
    .sort((a, b) => b.avgEngagement - a.avgEngagement);

  // 期間計算
  const firstPost = posts[posts.length - 1];
  const lastPost = posts[0];
  const daysDiff = Math.max(1, differenceInDays(parseISO(lastPost.timestamp), parseISO(firstPost.timestamp)));

  // エンゲージメントトレンド計算
  const recentPosts = posts.slice(0, Math.ceil(posts.length / 2));
  const olderPosts = posts.slice(Math.ceil(posts.length / 2));
  const recentAvgEngagement = recentPosts.reduce((sum, p) => sum + calculatePostScore(p), 0) / recentPosts.length;
  const olderAvgEngagement = olderPosts.length > 0
    ? olderPosts.reduce((sum, p) => sum + calculatePostScore(p), 0) / olderPosts.length
    : recentAvgEngagement;

  let engagementTrend: 'up' | 'down' | 'stable' = 'stable';
  if (recentAvgEngagement > olderAvgEngagement * 1.1) engagementTrend = 'up';
  else if (recentAvgEngagement < olderAvgEngagement * 0.9) engagementTrend = 'down';

  const totalEngagement = totalLikes + totalReplies + totalReposts + totalQuotes;

  return {
    totalPosts: posts.length,
    totalViews,
    totalEngagement,
    averageEngagementRate: totalViews > 0 ? (totalEngagement / totalViews) * 100 : 0,

    totalLikes,
    totalReplies,
    totalReposts,
    totalQuotes,
    totalShares,

    topPosts,
    worstPosts,

    bestPostingHours,
    bestPostingDays,

    contentAnalysis: {
      avgTextLength: posts.length > 0 ? totalTextLength / posts.length : 0,
      textLengthCorrelation,
      emojiUsageImpact: {
        withEmoji: emojiPostCount > 0 ? emojiPostEngagement / emojiPostCount : 0,
        withoutEmoji: nonEmojiPostCount > 0 ? nonEmojiPostEngagement / nonEmojiPostCount : 0,
      },
      quotePostPerformance: {
        quote: quotePostCount > 0 ? quotePostEngagement / quotePostCount : 0,
        original: originalPostCount > 0 ? originalPostEngagement / originalPostCount : 0,
      },
      mediaTypePerformance,
    },

    viralMetrics: {
      viralCoefficient: totalViews > 0 ? ((totalReposts + totalQuotes) / totalViews) * 100 : 0,
      shareRate: totalViews > 0 ? (totalShares / totalViews) * 100 : 0,
      replyRate: totalViews > 0 ? (totalReplies / totalViews) * 100 : 0,
    },

    growthMetrics: {
      postsPerDay: daysDiff > 0 ? posts.length / daysDiff : posts.length,
      viewsPerPost: posts.length > 0 ? totalViews / posts.length : 0,
      engagementTrend,
    },
  };
}

// 競合分析
export function analyzeCompetitor(
  username: string,
  profile: { threads_profile_picture_url?: string; threads_biography?: string },
  posts: Array<{
    text?: string;
    timestamp: string;
    media_type: string;
    is_quote_post?: boolean;
    like_count?: number;
    reply_count?: number;
    repost_count?: number;
    quote_count?: number;
  }>
): CompetitorComparison {
  let totalLikes = 0;
  let totalReplies = 0;
  let totalReposts = 0;
  let totalTextLength = 0;
  let emojiCount = 0;
  let quoteCount = 0;

  const postsWithEngagement = posts.map(post => {
    const likes = post.like_count || 0;
    const replies = post.reply_count || 0;
    const reposts = post.repost_count || 0;
    const quotes = post.quote_count || 0;

    totalLikes += likes;
    totalReplies += replies;
    totalReposts += reposts;
    totalTextLength += post.text?.length || 0;

    if (post.text && containsEmoji(post.text)) emojiCount++;
    if (post.is_quote_post) quoteCount++;

    return {
      id: '',
      text: post.text,
      timestamp: post.timestamp,
      media_type: post.media_type,
      is_quote_post: post.is_quote_post,
      insights: { views: 0, likes, replies, reposts, quotes, shares: 0 },
      engagement: likes + replies + reposts + quotes,
    };
  });

  const sortedByEngagement = [...postsWithEngagement].sort((a, b) => b.engagement - a.engagement);

  const firstPost = posts[posts.length - 1];
  const lastPost = posts[0];
  const daysDiff = firstPost && lastPost
    ? Math.max(1, differenceInDays(parseISO(lastPost.timestamp), parseISO(firstPost.timestamp)))
    : 1;

  const totalEngagement = totalLikes + totalReplies + totalReposts;

  return {
    username,
    profilePicture: profile.threads_profile_picture_url,
    bio: profile.threads_biography,
    postCount: posts.length,
    totalLikes,
    totalReplies,
    totalReposts,
    avgLikesPerPost: posts.length > 0 ? totalLikes / posts.length : 0,
    avgRepliesPerPost: posts.length > 0 ? totalReplies / posts.length : 0,
    avgEngagementPerPost: posts.length > 0 ? totalEngagement / posts.length : 0,
    postingFrequency: daysDiff > 0 ? posts.length / daysDiff : posts.length,
    topPost: sortedByEngagement[0] || null,
    contentStrategy: {
      avgTextLength: posts.length > 0 ? totalTextLength / posts.length : 0,
      emojiUsageRate: posts.length > 0 ? (emojiCount / posts.length) * 100 : 0,
      quotePostRate: posts.length > 0 ? (quoteCount / posts.length) * 100 : 0,
    },
  };
}

function getMediaTypeName(type: string): string {
  const names: Record<string, string> = {
    'TEXT_POST': 'テキスト',
    'IMAGE': '画像',
    'VIDEO': '動画',
    'CAROUSEL_ALBUM': 'カルーセル',
  };
  return names[type] || type;
}

function getEmptyAnalyticsResult(): AnalyticsResult {
  return {
    totalPosts: 0,
    totalViews: 0,
    totalEngagement: 0,
    averageEngagementRate: 0,
    totalLikes: 0,
    totalReplies: 0,
    totalReposts: 0,
    totalQuotes: 0,
    totalShares: 0,
    topPosts: [],
    worstPosts: [],
    bestPostingHours: [],
    bestPostingDays: [],
    contentAnalysis: {
      avgTextLength: 0,
      textLengthCorrelation: [],
      emojiUsageImpact: { withEmoji: 0, withoutEmoji: 0 },
      quotePostPerformance: { quote: 0, original: 0 },
      mediaTypePerformance: [],
    },
    viralMetrics: {
      viralCoefficient: 0,
      shareRate: 0,
      replyRate: 0,
    },
    growthMetrics: {
      postsPerDay: 0,
      viewsPerPost: 0,
      engagementTrend: 'stable',
    },
  };
}

// ハッシュタグ抽出
export function extractHashtags(text: string): string[] {
  const hashtagRegex = /#[\w\u3040-\u309F\u30A0-\u30FF\u4E00-\u9FFF]+/g;
  return text.match(hashtagRegex) || [];
}

// キーワード抽出（日本語対応）
export function extractKeywords(text: string): string[] {
  // ハッシュタグ、URL、メンションを除去
  const cleaned = text
    .replace(/#[\w\u3040-\u309F\u30A0-\u30FF\u4E00-\u9FFF]+/g, '')
    .replace(/https?:\/\/\S+/g, '')
    .replace(/@[\w]+/g, '')
    .replace(/[、。！？!?.,\n\r]/g, ' ');

  // 2文字以上の単語を抽出
  const words = cleaned.split(/\s+/).filter(w => w.length >= 2);
  return words;
}

// ハッシュタグ分析
export interface HashtagAnalysis {
  hashtag: string;
  count: number;
  avgEngagement: number;
  totalViews: number;
}

export function analyzeHashtags(posts: PostData[]): HashtagAnalysis[] {
  const hashtagStats: Record<string, { count: number; totalEngagement: number; totalViews: number }> = {};

  for (const post of posts) {
    if (!post.text) continue;
    const hashtags = extractHashtags(post.text);
    const engagement = post.insights.likes + post.insights.replies + post.insights.reposts + post.insights.quotes;

    for (const tag of hashtags) {
      if (!hashtagStats[tag]) {
        hashtagStats[tag] = { count: 0, totalEngagement: 0, totalViews: 0 };
      }
      hashtagStats[tag].count += 1;
      hashtagStats[tag].totalEngagement += engagement;
      hashtagStats[tag].totalViews += post.insights.views;
    }
  }

  return Object.entries(hashtagStats)
    .map(([hashtag, stats]) => ({
      hashtag,
      count: stats.count,
      avgEngagement: stats.count > 0 ? stats.totalEngagement / stats.count : 0,
      totalViews: stats.totalViews,
    }))
    .sort((a, b) => b.avgEngagement - a.avgEngagement);
}

// キーワード分析
export interface KeywordAnalysis {
  keyword: string;
  count: number;
  avgEngagement: number;
  posts: number;
}

export function analyzeKeywords(posts: PostData[]): KeywordAnalysis[] {
  const keywordStats: Record<string, { count: number; totalEngagement: number; postIds: Set<string> }> = {};

  for (const post of posts) {
    if (!post.text) continue;
    const keywords = extractKeywords(post.text);
    const engagement = post.insights.likes + post.insights.replies + post.insights.reposts + post.insights.quotes;

    const uniqueKeywords = new Set(keywords);
    for (const keyword of uniqueKeywords) {
      if (!keywordStats[keyword]) {
        keywordStats[keyword] = { count: 0, totalEngagement: 0, postIds: new Set() };
      }
      keywordStats[keyword].count += 1;
      keywordStats[keyword].totalEngagement += engagement;
      keywordStats[keyword].postIds.add(post.id);
    }
  }

  return Object.entries(keywordStats)
    .filter(([, stats]) => stats.count >= 2) // 2回以上出現したキーワードのみ
    .map(([keyword, stats]) => ({
      keyword,
      count: stats.count,
      avgEngagement: stats.count > 0 ? stats.totalEngagement / stats.count : 0,
      posts: stats.postIds.size,
    }))
    .sort((a, b) => b.avgEngagement - a.avgEngagement);
}

// 時間帯×曜日ヒートマップデータ
export interface HeatmapData {
  day: number; // 0-6 (日-土)
  hour: number; // 0-23
  value: number; // エンゲージメント
  count: number; // 投稿数
}

export function generateHeatmapData(posts: PostData[]): HeatmapData[] {
  const heatmap: Record<string, { value: number; count: number }> = {};

  // 初期化
  for (let day = 0; day < 7; day++) {
    for (let hour = 0; hour < 24; hour++) {
      heatmap[`${day}-${hour}`] = { value: 0, count: 0 };
    }
  }

  for (const post of posts) {
    const date = parseISO(post.timestamp);
    const day = getDay(date);
    const hour = getHours(date);
    const key = `${day}-${hour}`;
    const engagement = post.insights.likes + post.insights.replies + post.insights.reposts + post.insights.quotes;

    heatmap[key].value += engagement;
    heatmap[key].count += 1;
  }

  return Object.entries(heatmap).map(([key, data]) => {
    const [day, hour] = key.split('-').map(Number);
    return {
      day,
      hour,
      value: data.count > 0 ? data.value / data.count : 0,
      count: data.count,
    };
  });
}

// AIインサイト生成
export interface AIInsight {
  type: 'success' | 'warning' | 'tip' | 'insight';
  title: string;
  description: string;
  priority: number;
}

export function generateAIInsights(analytics: AnalyticsResult, posts: PostData[]): AIInsight[] {
  const insights: AIInsight[] = [];

  // エンゲージメント率の評価
  if (analytics.averageEngagementRate >= 5) {
    insights.push({
      type: 'success',
      title: '高いエンゲージメント率',
      description: `エンゲージメント率${analytics.averageEngagementRate.toFixed(2)}%は非常に優秀です。この調子を維持しましょう。`,
      priority: 1,
    });
  } else if (analytics.averageEngagementRate < 1) {
    insights.push({
      type: 'warning',
      title: 'エンゲージメント率の改善が必要',
      description: 'エンゲージメント率が1%未満です。投稿内容の見直しや投稿時間の最適化を検討してください。',
      priority: 1,
    });
  }

  // 最適投稿時間
  if (analytics.bestPostingHours.length > 0) {
    const bestHour = analytics.bestPostingHours[0];
    insights.push({
      type: 'tip',
      title: `${bestHour.hour}時台がゴールデンタイム`,
      description: `${bestHour.hour}時台の投稿が最もエンゲージメントが高いです。この時間帯に重要な投稿を集中させましょう。`,
      priority: 2,
    });
  }

  // 最適曜日
  if (analytics.bestPostingDays.length > 0) {
    const bestDay = analytics.bestPostingDays[0];
    insights.push({
      type: 'tip',
      title: `${bestDay.day}が最強の曜日`,
      description: `${bestDay.day}の投稿が最も反応が良いです。重要なコンテンツはこの曜日に投稿しましょう。`,
      priority: 2,
    });
  }

  // 絵文字の効果
  const emojiImpact = analytics.contentAnalysis.emojiUsageImpact;
  if (emojiImpact.withEmoji > emojiImpact.withoutEmoji * 1.2) {
    insights.push({
      type: 'success',
      title: '絵文字が効果的',
      description: `絵文字付き投稿は${((emojiImpact.withEmoji / emojiImpact.withoutEmoji - 1) * 100).toFixed(0)}%高いエンゲージメントを獲得。積極的に使いましょう。`,
      priority: 3,
    });
  } else if (emojiImpact.withoutEmoji > emojiImpact.withEmoji * 1.2) {
    insights.push({
      type: 'insight',
      title: 'シンプルな投稿が好評',
      description: 'あなたのオーディエンスは絵文字なしのシンプルな投稿を好む傾向があります。',
      priority: 3,
    });
  }

  // 文字数の最適化
  const bestTextLength = analytics.contentAnalysis.textLengthCorrelation
    .sort((a, b) => b.avgEngagement - a.avgEngagement)[0];
  if (bestTextLength) {
    insights.push({
      type: 'tip',
      title: `最適な文字数は${bestTextLength.range}文字`,
      description: `${bestTextLength.range}文字の投稿が最もエンゲージメントが高いです。この長さを意識して投稿しましょう。`,
      priority: 3,
    });
  }

  // 投稿頻度
  if (analytics.growthMetrics.postsPerDay < 0.5) {
    insights.push({
      type: 'warning',
      title: '投稿頻度が少ない',
      description: '週に数回以上の投稿を目指しましょう。定期的な投稿がフォロワー獲得の鍵です。',
      priority: 2,
    });
  } else if (analytics.growthMetrics.postsPerDay > 5) {
    insights.push({
      type: 'insight',
      title: '投稿頻度が高い',
      description: '1日5回以上投稿しています。質と量のバランスを確認しましょう。',
      priority: 4,
    });
  }

  // 成長トレンド
  if (analytics.growthMetrics.engagementTrend === 'up') {
    insights.push({
      type: 'success',
      title: 'エンゲージメント上昇中',
      description: '最近の投稿は過去より好調です。現在の戦略を継続しましょう。',
      priority: 1,
    });
  } else if (analytics.growthMetrics.engagementTrend === 'down') {
    insights.push({
      type: 'warning',
      title: 'エンゲージメント低下傾向',
      description: '最近の投稿のパフォーマンスが低下しています。コンテンツ戦略の見直しを検討してください。',
      priority: 1,
    });
  }

  // バイラル投稿の可能性
  if (analytics.viralMetrics.viralCoefficient > 1) {
    insights.push({
      type: 'success',
      title: 'バイラルポテンシャルあり',
      description: 'リポスト・引用率が高いです。拡散されやすいコンテンツを作成できています。',
      priority: 2,
    });
  }

  // トップ投稿の分析
  if (analytics.topPosts.length > 0) {
    const topPost = analytics.topPosts[0];
    const avgLength = analytics.contentAnalysis.avgTextLength;
    const topLength = topPost.text?.length || 0;

    if (topLength > avgLength * 1.5) {
      insights.push({
        type: 'insight',
        title: 'ベスト投稿は長文',
        description: '最も反応の良い投稿は平均より長いです。詳しい内容がウケている可能性があります。',
        priority: 4,
      });
    } else if (topLength < avgLength * 0.5) {
      insights.push({
        type: 'insight',
        title: 'ベスト投稿は短文',
        description: '最も反応の良い投稿は平均より短いです。簡潔なメッセージが効果的です。',
        priority: 4,
      });
    }
  }

  // 優先度でソート
  return insights.sort((a, b) => a.priority - b.priority);
}

// 日別エンゲージメント推移
export interface DailyTrend {
  date: string;
  posts: number;
  engagement: number;
  views: number;
}

export function analyzeDailyTrends(posts: PostData[]): DailyTrend[] {
  const dailyData: Record<string, { posts: number; engagement: number; views: number }> = {};

  for (const post of posts) {
    const date = format(parseISO(post.timestamp), 'yyyy-MM-dd');
    const engagement = post.insights.likes + post.insights.replies + post.insights.reposts + post.insights.quotes;

    if (!dailyData[date]) {
      dailyData[date] = { posts: 0, engagement: 0, views: 0 };
    }
    dailyData[date].posts += 1;
    dailyData[date].engagement += engagement;
    dailyData[date].views += post.insights.views;
  }

  return Object.entries(dailyData)
    .map(([date, data]) => ({
      date,
      ...data,
    }))
    .sort((a, b) => a.date.localeCompare(b.date));
}

// エクスポート用データ生成
export function generateExportData(
  profile: { username: string; id: string },
  analytics: AnalyticsResult,
  posts: PostData[]
) {
  return {
    exportedAt: new Date().toISOString(),
    account: {
      username: profile.username,
      id: profile.id,
    },
    summary: {
      totalPosts: analytics.totalPosts,
      totalViews: analytics.totalViews,
      totalEngagement: analytics.totalEngagement,
      engagementRate: analytics.averageEngagementRate.toFixed(2) + '%',
      viralCoefficient: analytics.viralMetrics.viralCoefficient.toFixed(3),
    },
    engagement: {
      likes: analytics.totalLikes,
      replies: analytics.totalReplies,
      reposts: analytics.totalReposts,
      quotes: analytics.totalQuotes,
      shares: analytics.totalShares,
    },
    bestPostingTimes: {
      hours: analytics.bestPostingHours.slice(0, 3),
      days: analytics.bestPostingDays.slice(0, 3),
    },
    contentAnalysis: analytics.contentAnalysis,
    posts: posts.map(p => ({
      id: p.id,
      text: p.text?.substring(0, 100),
      timestamp: p.timestamp,
      views: p.insights.views,
      likes: p.insights.likes,
      replies: p.insights.replies,
      engagementRate: p.insights.views > 0
        ? ((p.insights.likes + p.insights.replies) / p.insights.views * 100).toFixed(2) + '%'
        : '0%',
    })),
  };
}
