import { NextRequest, NextResponse } from 'next/server';
import { prisma, isDatabaseAvailable } from '@/lib/db';
import { auth } from '@/lib/auth';

// GET: ルール一覧取得
export async function GET(request: NextRequest) {
  try {
    if (!isDatabaseAvailable() || !prisma) {
      return NextResponse.json({ error: 'Database not available' }, { status: 503 });
    }

    const { searchParams } = new URL(request.url);
    const accountId = searchParams.get('accountId');

    if (!accountId) {
      return NextResponse.json({ error: 'accountId is required' }, { status: 400 });
    }

    // accountIdがThreadsUserIdの場合、データベースのアカウントを検索
    const account = await prisma.threadsAccount.findFirst({
      where: {
        OR: [
          { id: accountId },
          { threadsUserId: accountId },
        ],
      },
    });

    if (!account) {
      return NextResponse.json([]);
    }

    const rules = await prisma.autoReplyRule.findMany({
      where: { accountId: account.id },
      orderBy: { createdAt: 'desc' },
      include: {
        _count: {
          select: { replyLogs: true }
        }
      }
    });

    return NextResponse.json(rules);
  } catch (error) {
    console.error('Failed to fetch auto-reply rules:', error);
    return NextResponse.json({ error: 'Failed to fetch rules' }, { status: 500 });
  }
}

// POST: 新規ルール作成
export async function POST(request: NextRequest) {
  try {
    if (!isDatabaseAvailable() || !prisma) {
      return NextResponse.json({ error: 'Database not available' }, { status: 503 });
    }

    // 認証チェック
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // プラン制限チェック（自動リプライはProプランのみ）
    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
    });

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    if (user.role !== 'ADMIN' && user.plan !== 'pro') {
      return NextResponse.json(
        { error: '自動リプライ機能は Pro プラン限定です。アップグレードしてください。' },
        { status: 403 }
      );
    }

    const body = await request.json();
    const {
      accountId,
      name,
      isActive = true,
      triggerType,
      triggerKeywords,
      responseType = 'fixed',
      responseText,
      responseDelay = 60,
      onlyNewFollowers = false,
      excludeFollowing = false,
      maxRepliesPerDay = 50,
    } = body;

    if (!accountId || !name || !triggerType || !responseText) {
      return NextResponse.json(
        { error: 'accountId, name, triggerType, and responseText are required' },
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

    const rule = await prisma.autoReplyRule.create({
      data: {
        accountId: dbAccountId,
        name,
        isActive,
        triggerType,
        triggerKeywords: triggerKeywords ? JSON.stringify(triggerKeywords) : null,
        responseType,
        responseText,
        responseDelay,
        onlyNewFollowers,
        excludeFollowing,
        maxRepliesPerDay,
      },
    });

    return NextResponse.json(rule, { status: 201 });
  } catch (error) {
    console.error('Failed to create auto-reply rule:', error);
    return NextResponse.json({ error: 'Failed to create rule' }, { status: 500 });
  }
}
