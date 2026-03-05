import { NextRequest, NextResponse } from 'next/server';
import { prisma, isDatabaseAvailable } from '@/lib/db';
import { processPost, recoverStuckPosts } from '@/lib/scheduled/execute';

// Vercel Cron認証
const CRON_SECRET = process.env.CRON_SECRET;

// Vercel Functionsの最大実行時間を60秒に設定
export const maxDuration = 60;

// Webhook通知を送信
async function sendWebhookNotification(payload: {
  type: 'post_success' | 'post_failed';
  postId: string;
  postType: string;
  username?: string;
  text?: string;
  error?: string;
}) {
  try {
    if (!isDatabaseAvailable() || !prisma) return;
    const setting = await prisma.systemSetting.findUnique({
      where: { key: 'webhook_url' },
    });
    if (!setting?.value) return;

    const webhookUrl = setting.value;
    await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        event: payload.type,
        timestamp: new Date().toISOString(),
        data: {
          postId: payload.postId,
          postType: payload.postType,
          username: payload.username,
          text: payload.text?.substring(0, 200),
          error: payload.error,
        },
      }),
    });
  } catch (e) {
    console.error('Webhook notification failed:', e);
  }
}

// 予約投稿・定期投稿を処理するCronジョブ
export async function GET(request: NextRequest) {
  try {
    // Cron認証チェック（CRON_SECRET未設定時は全拒否）
    const authHeader = request.headers.get('authorization');
    if (!CRON_SECRET) {
      console.error('CRON_SECRET is not configured');
      return NextResponse.json({ error: 'CRON_SECRET not configured' }, { status: 500 });
    }
    if (authHeader !== `Bearer ${CRON_SECRET}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (!isDatabaseAvailable() || !prisma) {
      return NextResponse.json({ error: 'Database not available' }, { status: 503 });
    }

    const now = new Date();
    const results: Array<{ id: string; type: string; status: string; error?: string }> = [];

    // 0. processing状態が長時間続いている投稿をfailedに戻す（重複実行防止）
    const recoveredCount = await recoverStuckPosts();

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
      // 古い順に処理、1回のcron実行で最大5件まで（タイムアウト防止）
      orderBy: { scheduledAt: 'asc' },
      take: 5,
    });

    for (const post of scheduledPosts) {
      const result = await processPost(post);
      results.push({ id: post.id, type: 'scheduled', ...result });
      // Webhook通知
      await sendWebhookNotification({
        type: result.status === 'completed' ? 'post_success' : 'post_failed',
        postId: post.id,
        postType: post.type,
        username: post.account.username || undefined,
        text: post.text || undefined,
        error: result.error,
      });
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
      orderBy: { scheduledAt: 'asc' },
      take: 5,
    });

    for (const post of recurringPosts) {
      // 定期投稿の条件をチェック
      if (!shouldPostRecurring(post, now)) {
        continue;
      }

      const result = await processPost(post);
      results.push({ id: post.id, type: 'recurring', ...result });
      // Webhook通知
      await sendWebhookNotification({
        type: result.status === 'completed' ? 'post_success' : 'post_failed',
        postId: post.id,
        postType: post.type,
        username: post.account.username || undefined,
        text: post.text || undefined,
        error: result.error,
      });

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

    // 3. 残りの未処理投稿数を返す（次回cronで処理される）
    const remainingCount = await prisma.scheduledPost.count({
      where: {
        status: 'pending',
        scheduledAt: { lte: now },
      },
    });

    return NextResponse.json({
      success: true,
      timestamp: now.toISOString(),
      processed: results.length,
      remaining: remainingCount,
      recoveredStuck: recoveredCount,
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

    case 'monthly': {
      // 来月の同じ日（月末対策付き）
      const targetDay = baseTime.getDate();
      nextSchedule.setMonth(nextSchedule.getMonth() + 1);
      // 月末を超える場合（例: 1/31 → 2/28）
      const lastDayOfMonth = new Date(nextSchedule.getFullYear(), nextSchedule.getMonth() + 1, 0).getDate();
      nextSchedule.setDate(Math.min(targetDay, lastDayOfMonth));
      break;
    }

    default:
      return null;
  }

  return nextSchedule;
}
