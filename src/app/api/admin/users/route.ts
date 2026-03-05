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
    const page = Math.max(1, parseInt(searchParams.get('page') || '1'));
    const perPage = Math.min(100, Math.max(1, parseInt(searchParams.get('perPage') || '20')));

    const where = {
      AND: [
        search ? {
          OR: [
            { email: { contains: search, mode: 'insensitive' as const } },
            { name: { contains: search, mode: 'insensitive' as const } },
          ],
        } : {},
        role !== 'all' ? { role: role as Role } : {},
      ],
    };

    // 総件数を取得
    const totalCount = await prisma.user.count({ where });

    // ページネーション付きでユーザーデータを取得
    const users = await prisma.user.findMany({
      where,
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
      skip: (page - 1) * perPage,
      take: perPage,
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

    return NextResponse.json({
      users: formattedUsers,
      totalCount,
      page,
      perPage,
      totalPages: Math.ceil(totalCount / perPage),
    });
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
