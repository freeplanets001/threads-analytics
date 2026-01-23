import { NextRequest, NextResponse } from 'next/server';
import { prisma, isDatabaseAvailable } from '@/lib/db';
import { auth } from '@/lib/auth';

// 予約投稿一覧取得
export async function GET() {
  if (!isDatabaseAvailable() || !prisma) {
    return NextResponse.json({ error: 'Database not available' }, { status: 503 });
  }

  const session = await auth();

  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const scheduledPosts = await prisma.scheduledPost.findMany({
      where: { userId: session.user.id },
      include: { account: true },
      orderBy: { scheduledAt: 'asc' },
    });

    return NextResponse.json({ scheduledPosts });
  } catch (error) {
    console.error('Get scheduled posts error:', error);
    return NextResponse.json({ error: 'Failed to get scheduled posts' }, { status: 500 });
  }
}

// 予約投稿作成
export async function POST(request: NextRequest) {
  if (!isDatabaseAvailable() || !prisma) {
    return NextResponse.json({ error: 'Database not available' }, { status: 503 });
  }

  const session = await auth();

  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { accountId, type, text, mediaUrls, threadPosts, scheduledAt } = await request.json();

    // プランに基づく制限チェック
    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      include: {
        scheduledPosts: {
          where: { status: 'pending' },
        },
      },
    });

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    // プラン別制限（ADMINは除外）
    if (user.role !== 'ADMIN') {
      // Free プランは予約投稿不可
      if (user.plan === 'free') {
        return NextResponse.json(
          { error: 'Free プランでは予約投稿は利用できません。Standard プラン以上にアップグレードしてください。' },
          { status: 403 }
        );
      }

      // Standard プランは月20件まで
      if (user.plan === 'standard' && user.scheduledPosts.length >= 20) {
        return NextResponse.json(
          { error: 'Standard プランでは予約投稿は月20件までです。Pro プランにアップグレードすると無制限になります。' },
          { status: 403 }
        );
      }
      // Pro プランは無制限
    }

    // 予約時間のバリデーション（最低5分後）
    const scheduleDate = new Date(scheduledAt);
    const minScheduleTime = new Date(Date.now() + 5 * 60 * 1000);

    if (scheduleDate < minScheduleTime) {
      return NextResponse.json(
        { error: '予約時間は最低5分後に設定してください。' },
        { status: 400 }
      );
    }

    // accountIdがThreadsUserIdの場合、データベースのアカウントを検索
    let dbAccountId = accountId;
    const account = await prisma.threadsAccount.findFirst({
      where: {
        OR: [
          { id: accountId },
          { threadsUserId: accountId },
        ],
        userId: session.user.id,
      },
    });

    if (account) {
      dbAccountId = account.id;
    } else {
      return NextResponse.json(
        { error: 'アカウントが見つかりません。' },
        { status: 404 }
      );
    }

    const scheduledPost = await prisma.scheduledPost.create({
      data: {
        userId: session.user.id,
        accountId: dbAccountId,
        type,
        text,
        mediaUrls: mediaUrls ? JSON.stringify(mediaUrls) : null,
        threadPosts: threadPosts ? JSON.stringify(threadPosts) : null,
        scheduledAt: scheduleDate,
        status: 'pending',
      },
    });

    return NextResponse.json({ success: true, scheduledPost });
  } catch (error) {
    console.error('Create scheduled post error:', error);
    return NextResponse.json({ error: 'Failed to create scheduled post' }, { status: 500 });
  }
}

// 予約投稿削除（キャンセル）
export async function DELETE(request: NextRequest) {
  if (!isDatabaseAvailable() || !prisma) {
    return NextResponse.json({ error: 'Database not available' }, { status: 503 });
  }

  const session = await auth();

  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json({ error: 'Scheduled post ID required' }, { status: 400 });
    }

    // 所有者確認
    const existingPost = await prisma.scheduledPost.findUnique({
      where: { id },
    });

    if (!existingPost || existingPost.userId !== session.user.id) {
      return NextResponse.json({ error: 'Scheduled post not found' }, { status: 404 });
    }

    // 処理中・完了済みは削除不可
    if (existingPost.status !== 'pending') {
      return NextResponse.json(
        { error: '処理中または完了済みの予約投稿はキャンセルできません。' },
        { status: 400 }
      );
    }

    await prisma.scheduledPost.delete({ where: { id } });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Delete scheduled post error:', error);
    return NextResponse.json({ error: 'Failed to delete scheduled post' }, { status: 500 });
  }
}
