import { NextRequest, NextResponse } from 'next/server';
import { prisma, isDatabaseAvailable } from '@/lib/db';
import { auth } from '@/lib/auth';

// 下書き一覧取得
export async function GET() {
  if (!isDatabaseAvailable() || !prisma) {
    return NextResponse.json({ error: 'Database not available' }, { status: 503 });
  }

  const session = await auth();

  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const drafts = await prisma.draft.findMany({
      where: { userId: session.user.id },
      include: { account: true },
      orderBy: { updatedAt: 'desc' },
    });

    return NextResponse.json({ drafts });
  } catch (error) {
    console.error('Get drafts error:', error);
    return NextResponse.json({ error: 'Failed to get drafts' }, { status: 500 });
  }
}

// 下書き作成
export async function POST(request: NextRequest) {
  if (!isDatabaseAvailable() || !prisma) {
    return NextResponse.json({ error: 'Database not available' }, { status: 503 });
  }

  const session = await auth();

  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { accountId, type, text, mediaUrls, threadPosts } = await request.json();

    // プランに基づく制限チェック
    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      include: { drafts: true },
    });

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    // プラン別下書き制限（Free: 5件、Standard/Pro: 無制限）
    if (user.role !== 'ADMIN' && user.plan === 'free' && user.drafts.length >= 5) {
      return NextResponse.json(
        { error: 'Free プランでは下書きは5件までです。Standard プラン以上で無制限になります。' },
        { status: 403 }
      );
    }

    const draft = await prisma.draft.create({
      data: {
        userId: session.user.id,
        accountId,
        type,
        text,
        mediaUrls: mediaUrls ? JSON.stringify(mediaUrls) : null,
        threadPosts: threadPosts ? JSON.stringify(threadPosts) : null,
      },
    });

    return NextResponse.json({ success: true, draft });
  } catch (error) {
    console.error('Create draft error:', error);
    return NextResponse.json({ error: 'Failed to create draft' }, { status: 500 });
  }
}

// 下書き更新
export async function PUT(request: NextRequest) {
  if (!isDatabaseAvailable() || !prisma) {
    return NextResponse.json({ error: 'Database not available' }, { status: 503 });
  }

  const session = await auth();

  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { id, type, text, mediaUrls, threadPosts } = await request.json();

    // 所有者確認
    const existingDraft = await prisma.draft.findUnique({
      where: { id },
    });

    if (!existingDraft || existingDraft.userId !== session.user.id) {
      return NextResponse.json({ error: 'Draft not found' }, { status: 404 });
    }

    const draft = await prisma.draft.update({
      where: { id },
      data: {
        type,
        text,
        mediaUrls: mediaUrls ? JSON.stringify(mediaUrls) : null,
        threadPosts: threadPosts ? JSON.stringify(threadPosts) : null,
      },
    });

    return NextResponse.json({ success: true, draft });
  } catch (error) {
    console.error('Update draft error:', error);
    return NextResponse.json({ error: 'Failed to update draft' }, { status: 500 });
  }
}

// 下書き削除
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
      return NextResponse.json({ error: 'Draft ID required' }, { status: 400 });
    }

    // 所有者確認
    const existingDraft = await prisma.draft.findUnique({
      where: { id },
    });

    if (!existingDraft || existingDraft.userId !== session.user.id) {
      return NextResponse.json({ error: 'Draft not found' }, { status: 404 });
    }

    await prisma.draft.delete({ where: { id } });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Delete draft error:', error);
    return NextResponse.json({ error: 'Failed to delete draft' }, { status: 500 });
  }
}
