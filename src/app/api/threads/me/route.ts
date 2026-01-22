import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { ThreadsAPIClient } from '@/lib/threads/client';
import {
  analyzePostsPerformance,
  analyzeHashtags,
  analyzeKeywords,
  generateHeatmapData,
  generateAIInsights,
  analyzeDailyTrends,
  type PostData,
} from '@/lib/analytics/calculations';

export async function GET(request: NextRequest) {
  // Authorizationヘッダーからトークンを取得（アカウント切り替え対応）
  const authHeader = request.headers.get('Authorization');
  const headerToken = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : null;

  const cookieStore = await cookies();
  const cookieToken = cookieStore.get('threads_access_token')?.value;

  // 優先順位: Authorizationヘッダー > cookie > 環境変数
  const accessToken = headerToken || cookieToken || process.env.THREADS_ACCESS_TOKEN;

  if (!accessToken) {
    return NextResponse.json(
      { error: 'Not authenticated', code: 'NOT_AUTHENTICATED' },
      { status: 401 }
    );
  }

  try {
    const client = new ThreadsAPIClient(accessToken);

    // プロフィール、投稿、インサイト、フォロワー数、自分のリプライを並行取得
    const [profile, threads, insights, followersCount, myReplies] = await Promise.all([
      client.getMe(),
      client.getMyThreads(50),
      client.getMyInsights().catch(() => null),
      client.getFollowersCount(),
      client.getMyReplies(50).catch(() => ({ data: [] })),
    ]);

    // 各投稿のインサイトを取得（全投稿）
    const threadsWithInsights = await Promise.all(
      threads.data.map(async (thread) => {
        try {
          const mediaInsight = await client.getMediaInsights(thread.id);
          return { ...thread, insights: mediaInsight };
        } catch {
          return {
            ...thread,
            insights: {
              id: thread.id,
              views: 0,
              likes: thread.like_count || 0,
              replies: thread.reply_count || 0,
              reposts: thread.repost_count || 0,
              quotes: thread.quote_count || 0,
              shares: 0,
            },
          };
        }
      })
    );

    // PostData形式に変換
    const postsForAnalysis: PostData[] = threadsWithInsights.map((t) => ({
      id: t.id,
      text: t.text,
      timestamp: t.timestamp,
      media_type: t.media_type,
      is_quote_post: t.is_quote_post,
      insights: t.insights,
    }));

    // 分析を実行
    const analytics = analyzePostsPerformance(postsForAnalysis);

    // 追加分析
    const hashtagAnalysis = analyzeHashtags(postsForAnalysis);
    const keywordAnalysis = analyzeKeywords(postsForAnalysis);
    const heatmapData = generateHeatmapData(postsForAnalysis);
    const aiInsights = generateAIInsights(analytics, postsForAnalysis);
    const dailyTrends = analyzeDailyTrends(postsForAnalysis);

    // 各投稿のリプライを取得（最新5投稿のみ、API制限対策）
    const repliesData = await Promise.all(
      threadsWithInsights.slice(0, 5).map(async (thread) => {
        const replies = await client.getPostReplies(thread.id);
        return {
          postId: thread.id,
          postText: thread.text?.substring(0, 50),
          replies: replies.data,
        };
      })
    );

    // トップファン分析（誰が一番リプライしているか）
    const fanEngagement: Record<string, { username: string; replyCount: number; totalLikes: number }> = {};
    for (const post of repliesData) {
      for (const reply of post.replies) {
        if (reply.username === profile.username) continue; // 自分を除外
        if (!fanEngagement[reply.username]) {
          fanEngagement[reply.username] = { username: reply.username, replyCount: 0, totalLikes: 0 };
        }
        fanEngagement[reply.username].replyCount += 1;
        fanEngagement[reply.username].totalLikes += reply.like_count || 0;
      }
    }

    const topFans = Object.values(fanEngagement)
      .sort((a, b) => b.replyCount - a.replyCount)
      .slice(0, 10);

    // 投稿データから統計を集計
    const aggregatedStats = {
      totalLikes: analytics.totalLikes,
      totalReplies: analytics.totalReplies,
      totalReposts: analytics.totalReposts,
      totalQuotes: analytics.totalQuotes,
      totalViews: analytics.totalViews,
      totalShares: analytics.totalShares,
      postCount: analytics.totalPosts,
      followersCount: followersCount || insights?.followers_count || 0,
    };

    return NextResponse.json({
      profile,
      threads: {
        data: threadsWithInsights,
      },
      insights,
      aggregatedStats,
      analytics,
      engagement: {
        topFans,
        recentReplies: repliesData,
        myReplies: myReplies.data.slice(0, 20),
      },
      advancedAnalysis: {
        hashtags: hashtagAnalysis,
        keywords: keywordAnalysis,
        heatmap: heatmapData,
        aiInsights,
        dailyTrends,
      },
    });
  } catch (err) {
    console.error('Threads API error:', err);
    return NextResponse.json(
      { error: 'Failed to fetch data', code: 'API_ERROR' },
      { status: 500 }
    );
  }
}
