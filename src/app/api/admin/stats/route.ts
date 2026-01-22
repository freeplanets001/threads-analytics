import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma, isDatabaseAvailable } from '@/lib/db';
import { hasPermission, Role } from '@/lib/permissions';

export async function GET() {
  try {
    const session = await auth();

    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (!isDatabaseAvailable() || !prisma) {
      return NextResponse.json({ error: 'Database not available' }, { status: 503 });
    }

    // ユーザーの権限チェック
    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { role: true },
    });

    if (!user || !hasPermission(user.role as Role, 'adminPanel')) {
      return NextResponse.json({ error: 'Admin access required' }, { status: 403 });
    }

    // 実際のデータを取得
    const [totalUsers, totalAccounts, totalScheduledPosts, totalDrafts, usersByRole] = await Promise.all([
      prisma.user.count(),
      prisma.threadsAccount.count(),
      prisma.scheduledPost.count(),
      prisma.draft.count(),
      prisma.user.groupBy({
        by: ['role'],
        _count: { role: true },
      }),
    ]);

    const stats = {
      totalUsers,
      totalAccounts,
      totalScheduledPosts,
      totalDrafts,
      usersByRole: usersByRole.map(item => ({
        role: item.role,
        count: item._count.role,
      })),
    };

    return NextResponse.json(stats);
  } catch (error) {
    console.error('Stats fetch error:', error);
    return NextResponse.json({ error: 'Failed to fetch stats' }, { status: 500 });
  }
}
