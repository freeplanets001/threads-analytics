import { NextRequest, NextResponse } from 'next/server';
import { prisma, isDatabaseAvailable } from '@/lib/db';
import { ThreadsAPIClient } from '@/lib/threads/client';

// Vercel Cron認証
const CRON_SECRET = process.env.CRON_SECRET;

// 予約投稿・定期投稿を処理するCronジョブ
export async function GET(request: NextRequest) {
  try {
    // Cron認証チェック（本番環境用）
    const authHeader = request.headers.get('authorization');
    if (CRON_SECRET && authHeader !== `Bearer ${CRON_SECRET}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (!isDatabaseAvailable() || !prisma) {
      return NextResponse.json({ error: 'Database not available' }, { status: 503 });
    }

    const now = new Date();
    const results: Array<{ id: string; type: string; status: string; error?: string }> = [];

    // 1. 予約投稿を処理（scheduledAtが現在時刻以前でpendingのもの）
    const scheduledPosts = await prisma.scheduledPost.findMany({
      where: {
        status: 'pending',
        scheduledAt: { lte: now },
        isRecurring: false,
      },
      include: {
        account: {
          select: {
            accessToken: true,
            username: true,
          },
        },
      },
    });

    for (const post of scheduledPosts) {
      const result = await processPost(post);
      results.push({ id: post.id, type: 'scheduled', ...result });
    }

    // 2. 定期投稿を処理
    const recurringPosts = await prisma.scheduledPost.findMany({
      where: {
        status: 'pending',
        isRecurring: true,
        scheduledAt: { lte: now },
      },
      include: {
        account: {
          select: {
            accessToken: true,
            username: true,
          },
        },
      },
    });

    for (const post of recurringPosts) {
      // 定期投稿の条件をチェック
      if (!shouldPostRecurring(post, now)) {
        continue;
      }

      const result = await processPost(post);
      results.push({ id: post.id, type: 'recurring', ...result });

      // 成功した場合、次回のスケジュールを設定
      if (result.status === 'completed') {
        const nextSchedule = calculateNextSchedule(post, now);
        if (nextSchedule) {
          await prisma.scheduledPost.update({
            where: { id: post.id },
            data: {
              scheduledAt: nextSchedule,
              status: 'pending',
              postedId: null,
            },
          });
        }
      }
    }

    return NextResponse.json({
      success: true,
      timestamp: now.toISOString(),
      processed: results.length,
      results,
    });

  } catch (error) {
    console.error('Cron job failed:', error);
    return NextResponse.json(
      { error: 'Cron job failed', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

// 投稿を実行
async function processPost(post: {
  id: string;
  type: string;
  text: string | null;
  mediaUrls: string | null;
  account: { accessToken: string };
}): Promise<{ status: string; error?: string }> {
  try {
    // ステータスを処理中に更新
    await prisma!.scheduledPost.update({
      where: { id: post.id },
      data: { status: 'processing' },
    });

    const client = new ThreadsAPIClient(post.account.accessToken);

    let postedId: string;

    // 投稿タイプに応じて処理
    if (post.type === 'text' || !post.mediaUrls) {
      // テキスト投稿
      const result = await client.postText(post.text || '');
      postedId = result.id;
    } else if (post.type === 'image') {
      // 画像投稿
      const mediaUrls = JSON.parse(post.mediaUrls) as string[];
      const result = await client.postImage(mediaUrls[0], post.text || undefined);
      postedId = result.id;
    } else if (post.type === 'video') {
      // 動画投稿
      const mediaUrls = JSON.parse(post.mediaUrls) as string[];
      const result = await client.postVideo(mediaUrls[0], post.text || undefined);
      postedId = result.id;
    } else if (post.type === 'carousel') {
      // カルーセル投稿
      const mediaUrls = JSON.parse(post.mediaUrls) as string[];
      const items = mediaUrls.map(url => ({
        type: url.match(/\.(mp4|mov|webm)$/i) ? 'VIDEO' : 'IMAGE' as 'VIDEO' | 'IMAGE',
        url,
      }));
      const result = await client.postCarousel(items, post.text || undefined);
      postedId = result.id;
    } else {
      // テキストとして投稿
      const result = await client.postText(post.text || '');
      postedId = result.id;
    }

    // 成功
    await prisma!.scheduledPost.update({
      where: { id: post.id },
      data: {
        status: 'completed',
        postedId,
      },
    });

    return { status: 'completed' };

  } catch (error) {
    console.error(`Failed to post ${post.id}:`, error);

    // 失敗
    await prisma!.scheduledPost.update({
      where: { id: post.id },
      data: {
        status: 'failed',
        errorMessage: error instanceof Error ? error.message : 'Unknown error',
      },
    });

    return {
      status: 'failed',
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

// 定期投稿の条件をチェック
function shouldPostRecurring(post: {
  recurringType: string | null;
  recurringDays: string | null;
}, now: Date): boolean {
  if (!post.recurringType) return false;

  const dayOfWeek = now.getDay(); // 0-6
  const dayOfMonth = now.getDate(); // 1-31

  switch (post.recurringType) {
    case 'daily':
      return true;

    case 'weekly':
      if (!post.recurringDays) return false;
      try {
        const days = JSON.parse(post.recurringDays) as number[];
        return days.includes(dayOfWeek);
      } catch {
        return false;
      }

    case 'monthly':
      if (!post.recurringDays) return false;
      try {
        const days = JSON.parse(post.recurringDays) as number[];
        return days.includes(dayOfMonth);
      } catch {
        return false;
      }

    default:
      return false;
  }
}

// 次回のスケジュールを計算
function calculateNextSchedule(post: {
  recurringType: string | null;
  scheduledAt: Date;
}, now: Date): Date | null {
  if (!post.recurringType) return null;

  const baseTime = new Date(post.scheduledAt);
  const nextSchedule = new Date(now);

  // 同じ時刻を維持
  nextSchedule.setHours(baseTime.getHours());
  nextSchedule.setMinutes(baseTime.getMinutes());
  nextSchedule.setSeconds(0);
  nextSchedule.setMilliseconds(0);

  switch (post.recurringType) {
    case 'daily':
      // 翌日
      nextSchedule.setDate(nextSchedule.getDate() + 1);
      break;

    case 'weekly':
      // 来週の同じ曜日
      nextSchedule.setDate(nextSchedule.getDate() + 7);
      break;

    case 'monthly':
      // 来月の同じ日
      nextSchedule.setMonth(nextSchedule.getMonth() + 1);
      break;

    default:
      return null;
  }

  return nextSchedule;
}
