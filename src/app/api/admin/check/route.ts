import { NextResponse } from 'next/server';
import { hasPermission, Role } from '@/lib/permissions';
import { auth } from '@/lib/auth';
import { prisma, isDatabaseAvailable } from '@/lib/db';

export async function GET() {
  try {
    // セッション認証を使用
    const session = await auth();

    if (!session?.user?.id) {
      return NextResponse.json({ isAdmin: false, error: 'Not authenticated' }, { status: 401 });
    }

    // データベースからユーザーのロールを取得
    if (!isDatabaseAvailable() || !prisma) {
      return NextResponse.json({ isAdmin: false, error: 'Database not available' }, { status: 503 });
    }

    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { role: true },
    });

    if (!user) {
      return NextResponse.json({ isAdmin: false, error: 'User not found' }, { status: 404 });
    }

    const role = user.role as Role;
    const isAdmin = hasPermission(role, 'adminPanel');

    return NextResponse.json({
      isAdmin,
      role,
    });
  } catch (error) {
    console.error('Admin check error:', error);
    return NextResponse.json({ isAdmin: false, error: 'Internal error' }, { status: 500 });
  }
}
