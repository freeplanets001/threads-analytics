import { NextResponse } from 'next/server';
import { prisma, isDatabaseAvailable } from '@/lib/db';
import { auth } from '@/lib/auth';
import { processPost, recoverStuckPosts } from '@/lib/scheduled/execute';

/** 1回のリクエストで処理する最大件数 */
const MAX_POSTS_PER_REQUEST = 3;

/**
 * 認証済みユーザーのpending予約投稿を実行するAPI
 * ScheduleManagerのポーリングから呼び出される
 */
export async function POST() {
  if (!isDatabaseAvailable() || !prisma) {
    return NextResponse.json({ error: 'Database not available' }, { status: 503 });
  }

  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const now = new Date();

    // スタック投稿を回復
    await recoverStuckPosts();

    // 現在のユーザーのpending投稿を取得（予約時刻が過ぎたもの）
    const pendingPosts = await prisma.scheduledPost.findMany({
      where: {
        userId: session.user.id,
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
      orderBy: { scheduledAt: 'asc' },
      take: MAX_POSTS_PER_REQUEST,
    });

    if (pendingPosts.length === 0) {
      return NextResponse.json({
        executed: 0,
        results: [],
      });
    }

    const results: Array<{ id: string; status: string; error?: string }> = [];

    for (const post of pendingPosts) {
      const result = await processPost(post);
      results.push({ id: post.id, ...result });
    }

    // 残りの未処理件数
    const remainingCount = await prisma.scheduledPost.count({
      where: {
        userId: session.user.id,
        status: 'pending',
        scheduledAt: { lte: now },
      },
    });

    return NextResponse.json({
      executed: results.length,
      remaining: remainingCount,
      results,
    });

  } catch (error) {
    console.error('Execute scheduled posts failed:', error);
    return NextResponse.json(
      { error: 'Failed to execute scheduled posts', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
