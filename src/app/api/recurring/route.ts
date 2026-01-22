import { NextRequest, NextResponse } from 'next/server';
import { prisma, isDatabaseAvailable } from '@/lib/db';
import { auth } from '@/lib/auth';

// 定期投稿一覧取得
export async function GET() {
  if (!isDatabaseAvailable() || !prisma) {
    return NextResponse.json({ error: 'Database not available' }, { status: 503 });
  }

  const session = await auth();

  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const recurringPosts = await prisma.scheduledPost.findMany({
      where: {
        userId: session.user.id,
        isRecurring: true,
      },
      include: { account: true },
      orderBy: { scheduledAt: 'asc' },
    });

    return NextResponse.json({ recurringPosts });
  } catch (error) {
    console.error('Get recurring posts error:', error);
    return NextResponse.json({ error: 'Failed to get recurring posts' }, { status: 500 });
  }
}

// 定期投稿作成
export async function POST(request: NextRequest) {
  if (!isDatabaseAvailable() || !prisma) {
    return NextResponse.json({ error: 'Database not available' }, { status: 503 });
  }

  const session = await auth();

  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const {
      accountId,
      text,
      recurringType,
      recurringDays,
      scheduledAt,
    } = await request.json();

    if (!accountId || !text || !recurringType || !scheduledAt) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
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

    const recurringPost = await prisma.scheduledPost.create({
      data: {
        userId: session.user.id,
        accountId: dbAccountId,
        type: 'text',
        text,
        scheduledAt: new Date(scheduledAt),
        status: 'pending',
        isRecurring: true,
        recurringType,
        recurringDays: recurringDays ? JSON.stringify(recurringDays) : null,
      },
    });

    return NextResponse.json({ success: true, recurringPost });
  } catch (error) {
    console.error('Create recurring post error:', error);
    return NextResponse.json({ error: 'Failed to create recurring post' }, { status: 500 });
  }
}

// 定期投稿更新
export async function PUT(request: NextRequest) {
  if (!isDatabaseAvailable() || !prisma) {
    return NextResponse.json({ error: 'Database not available' }, { status: 503 });
  }

  const session = await auth();

  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { id, text, recurringType, recurringDays, scheduledAt, status } = await request.json();

    if (!id) {
      return NextResponse.json({ error: 'ID required' }, { status: 400 });
    }

    // 所有者確認
    const existingPost = await prisma.scheduledPost.findUnique({
      where: { id },
    });

    if (!existingPost || existingPost.userId !== session.user.id) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }

    const recurringPost = await prisma.scheduledPost.update({
      where: { id },
      data: {
        ...(text !== undefined && { text }),
        ...(recurringType !== undefined && { recurringType }),
        ...(recurringDays !== undefined && {
          recurringDays: recurringDays ? JSON.stringify(recurringDays) : null,
        }),
        ...(scheduledAt !== undefined && { scheduledAt: new Date(scheduledAt) }),
        ...(status !== undefined && { status }),
      },
    });

    return NextResponse.json({ success: true, recurringPost });
  } catch (error) {
    console.error('Update recurring post error:', error);
    return NextResponse.json({ error: 'Failed to update recurring post' }, { status: 500 });
  }
}

// 定期投稿削除
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
      return NextResponse.json({ error: 'ID required' }, { status: 400 });
    }

    // 所有者確認
    const existingPost = await prisma.scheduledPost.findUnique({
      where: { id },
    });

    if (!existingPost || existingPost.userId !== session.user.id) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }

    await prisma.scheduledPost.delete({ where: { id } });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Delete recurring post error:', error);
    return NextResponse.json({ error: 'Failed to delete recurring post' }, { status: 500 });
  }
}
