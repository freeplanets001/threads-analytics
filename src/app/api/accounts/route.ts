import { NextRequest, NextResponse } from 'next/server';
import { prisma, isDatabaseAvailable } from '@/lib/db';
import { auth } from '@/lib/auth';

// GET: ユーザーのアカウント一覧を取得
export async function GET() {
  try {
    const session = await auth();

    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (!isDatabaseAvailable() || !prisma) {
      return NextResponse.json({ error: 'Database not available' }, { status: 503 });
    }

    const accounts = await prisma.threadsAccount.findMany({
      where: { userId: session.user.id },
      select: {
        id: true,
        threadsUserId: true,
        username: true,
        name: true,
        profilePicture: true,
        createdAt: true,
      },
    });

    return NextResponse.json({ accounts });
  } catch (error) {
    console.error('Get accounts error:', error);
    return NextResponse.json({ error: 'Failed to get accounts' }, { status: 500 });
  }
}

// POST: アカウントを登録
export async function POST(request: NextRequest) {
  try {
    const session = await auth();

    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (!isDatabaseAvailable() || !prisma) {
      return NextResponse.json({ error: 'Database not available' }, { status: 503 });
    }

    const { threadsUserId, username, name, profilePicture, accessToken } = await request.json();

    if (!threadsUserId || !username || !accessToken) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    // 既存のアカウントを検索
    const existingAccount = await prisma.threadsAccount.findUnique({
      where: { threadsUserId },
    });

    // 新規アカウントの場合、プラン別のアカウント数制限をチェック
    if (!existingAccount) {
      const user = await prisma.user.findUnique({
        where: { id: session.user.id },
        include: {
          threadsAccounts: true,
        },
      });

      if (user && user.role !== 'ADMIN') {
        const plan = user.plan || 'free';
        const accountLimits: Record<string, number> = {
          free: 1,
          standard: 3,
          pro: 10,
        };
        const maxAccounts = accountLimits[plan] || 1;

        if (user.threadsAccounts.length >= maxAccounts) {
          return NextResponse.json(
            {
              error: `${plan === 'free' ? 'Free' : plan === 'standard' ? 'Standard' : 'Pro'} プランでは最大${maxAccounts}アカウントまでです。${plan !== 'pro' ? 'アップグレードするとアカウント数を増やせます。' : ''}`,
            },
            { status: 403 }
          );
        }
      }
    }

    let account;
    if (existingAccount) {
      // 既存のアカウントを更新
      account = await prisma.threadsAccount.update({
        where: { threadsUserId },
        data: {
          username,
          name,
          profilePicture,
          accessToken,
          updatedAt: new Date(),
        },
      });
    } else {
      // 新規アカウントを作成
      account = await prisma.threadsAccount.create({
        data: {
          userId: session.user.id,
          threadsUserId,
          username,
          name,
          profilePicture,
          accessToken,
        },
      });
    }

    return NextResponse.json({
      success: true,
      account: {
        id: account.id,
        threadsUserId: account.threadsUserId,
        username: account.username,
        name: account.name,
        profilePicture: account.profilePicture,
      },
    });
  } catch (error) {
    console.error('Create account error:', error);
    return NextResponse.json({ error: 'Failed to create account' }, { status: 500 });
  }
}

// DELETE: アカウントを削除
export async function DELETE(request: NextRequest) {
  try {
    const session = await auth();

    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (!isDatabaseAvailable() || !prisma) {
      return NextResponse.json({ error: 'Database not available' }, { status: 503 });
    }

    const { searchParams } = new URL(request.url);
    const accountId = searchParams.get('id');

    if (!accountId) {
      return NextResponse.json({ error: 'Account ID required' }, { status: 400 });
    }

    // 所有者確認
    const account = await prisma.threadsAccount.findFirst({
      where: {
        OR: [
          { id: accountId },
          { threadsUserId: accountId },
        ],
        userId: session.user.id,
      },
    });

    if (!account) {
      return NextResponse.json({ error: 'Account not found' }, { status: 404 });
    }

    await prisma.threadsAccount.delete({
      where: { id: account.id },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Delete account error:', error);
    return NextResponse.json({ error: 'Failed to delete account' }, { status: 500 });
  }
}
