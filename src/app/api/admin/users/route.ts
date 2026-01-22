import { NextRequest, NextResponse } from 'next/server';
import { Role, hasPermission } from '@/lib/permissions';
import { auth } from '@/lib/auth';
import { prisma, isDatabaseAvailable } from '@/lib/db';

export async function GET(request: NextRequest) {
  try {
    const session = await auth();

    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (!isDatabaseAvailable() || !prisma) {
      return NextResponse.json({ error: 'Database not available' }, { status: 503 });
    }

    // 権限チェック
    const currentUser = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { role: true },
    });

    if (!currentUser || !hasPermission(currentUser.role as Role, 'adminPanel')) {
      return NextResponse.json({ error: 'Admin access required' }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const search = searchParams.get('search') || '';
    const role = searchParams.get('role') || 'all';

    // 実際のユーザーデータを取得
    const users = await prisma.user.findMany({
      where: {
        AND: [
          search ? {
            OR: [
              { email: { contains: search, mode: 'insensitive' } },
              { name: { contains: search, mode: 'insensitive' } },
            ],
          } : {},
          role !== 'all' ? { role: role as Role } : {},
        ],
      },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        createdAt: true,
        _count: {
          select: {
            threadsAccounts: true,
            scheduledPosts: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });

    const formattedUsers = users.map(u => ({
      id: u.id,
      email: u.email || '',
      name: u.name,
      role: u.role,
      createdAt: u.createdAt.toISOString(),
      threadsAccountsCount: u._count.threadsAccounts,
      scheduledPostsCount: u._count.scheduledPosts,
    }));

    return NextResponse.json({ users: formattedUsers });
  } catch (error) {
    console.error('Users fetch error:', error);
    return NextResponse.json({ error: 'Failed to fetch users' }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const session = await auth();

    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (!isDatabaseAvailable() || !prisma) {
      return NextResponse.json({ error: 'Database not available' }, { status: 503 });
    }

    // 権限チェック
    const currentUser = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { role: true },
    });

    if (!currentUser || !hasPermission(currentUser.role as Role, 'adminPanel')) {
      return NextResponse.json({ error: 'Admin access required' }, { status: 403 });
    }

    const { userId, role } = await request.json();

    if (!userId || !role) {
      return NextResponse.json({ error: 'Missing userId or role' }, { status: 400 });
    }

    // 有効なロールかチェック
    if (!['ADMIN', 'PRO', 'STANDARD'].includes(role)) {
      return NextResponse.json({ error: 'Invalid role' }, { status: 400 });
    }

    // ユーザーのロールを更新
    await prisma.user.update({
      where: { id: userId },
      data: { role: role as Role },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('User update error:', error);
    return NextResponse.json({ error: 'Failed to update user' }, { status: 500 });
  }
}
