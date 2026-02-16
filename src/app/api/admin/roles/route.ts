import { NextRequest, NextResponse } from 'next/server';
import { Role, DEFAULT_PERMISSIONS, RolePermissions, hasPermission } from '@/lib/permissions';
import { auth } from '@/lib/auth';
import { prisma, isDatabaseAvailable } from '@/lib/db';

// 管理者認証チェック
async function requireAdmin(): Promise<{ error?: NextResponse; role?: Role }> {
  const session = await auth();
  if (!session?.user?.id) {
    return { error: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) };
  }
  if (!isDatabaseAvailable() || !prisma) {
    return { error: NextResponse.json({ error: 'Database not available' }, { status: 503 }) };
  }
  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { role: true },
  });
  if (!user || !hasPermission(user.role as Role, 'adminPanel')) {
    return { error: NextResponse.json({ error: 'Admin access required' }, { status: 403 }) };
  }
  return { role: user.role as Role };
}

export async function GET() {
  try {
    const { error } = await requireAdmin();
    if (error) return error;

    // DBからカスタム権限を取得
    let customPermissions: Partial<Record<Role, RolePermissions>> = {};
    if (isDatabaseAvailable() && prisma) {
      const dbPermissions = await prisma.rolePermission.findMany();
      for (const rp of dbPermissions) {
        try {
          customPermissions[rp.role as Role] = JSON.parse(rp.permissions);
        } catch { /* ignore parse error */ }
      }
    }

    const permissions: Record<Role, RolePermissions> = {
      ADMIN: { ...DEFAULT_PERMISSIONS.ADMIN, ...customPermissions.ADMIN },
      PRO: { ...DEFAULT_PERMISSIONS.PRO, ...customPermissions.PRO },
      STANDARD: { ...DEFAULT_PERMISSIONS.STANDARD, ...customPermissions.STANDARD },
    };

    return NextResponse.json(permissions);
  } catch (error) {
    console.error('Roles fetch error:', error);
    return NextResponse.json({ error: 'Failed to fetch roles' }, { status: 500 });
  }
}

export async function PUT(request: NextRequest) {
  try {
    const { error } = await requireAdmin();
    if (error) return error;

    const { role, permissions } = await request.json();

    if (!role || !permissions) {
      return NextResponse.json({ error: 'Missing role or permissions' }, { status: 400 });
    }

    if (!['ADMIN', 'PRO', 'STANDARD'].includes(role)) {
      return NextResponse.json({ error: 'Invalid role' }, { status: 400 });
    }

    // DBに権限を保存
    if (isDatabaseAvailable() && prisma) {
      await prisma.rolePermission.upsert({
        where: { role: role as Role },
        update: { permissions: JSON.stringify(permissions) },
        create: { role: role as Role, permissions: JSON.stringify(permissions) },
      });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Role update error:', error);
    return NextResponse.json({ error: 'Failed to update role' }, { status: 500 });
  }
}
