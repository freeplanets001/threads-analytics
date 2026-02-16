import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma, isDatabaseAvailable } from '@/lib/db';
import { hasPermission, Role } from '@/lib/permissions';

// 管理者認証チェック
async function requireAdmin() {
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
  if (!user || !hasPermission(user.role as Role, 'systemSettings')) {
    return { error: NextResponse.json({ error: 'Admin access required' }, { status: 403 }) };
  }
  return { userId: session.user.id };
}

// システム設定一覧取得
export async function GET() {
  try {
    const { error } = await requireAdmin();
    if (error) return error;

    const settings = await prisma!.systemSetting.findMany({
      orderBy: { key: 'asc' },
    });

    return NextResponse.json({ settings });
  } catch (error) {
    console.error('Get settings error:', error);
    return NextResponse.json({ error: 'Failed to get settings' }, { status: 500 });
  }
}

// システム設定の更新（upsert）
export async function PUT(request: NextRequest) {
  try {
    const { error } = await requireAdmin();
    if (error) return error;

    const { key, value, description } = await request.json();

    if (!key || value === undefined) {
      return NextResponse.json({ error: 'key and value are required' }, { status: 400 });
    }

    const setting = await prisma!.systemSetting.upsert({
      where: { key },
      update: { value: String(value), description },
      create: { key, value: String(value), description },
    });

    return NextResponse.json({ success: true, setting });
  } catch (error) {
    console.error('Update setting error:', error);
    return NextResponse.json({ error: 'Failed to update setting' }, { status: 500 });
  }
}

// システム設定の削除
export async function DELETE(request: NextRequest) {
  try {
    const { error } = await requireAdmin();
    if (error) return error;

    const { searchParams } = new URL(request.url);
    const key = searchParams.get('key');

    if (!key) {
      return NextResponse.json({ error: 'Setting key is required' }, { status: 400 });
    }

    await prisma!.systemSetting.delete({ where: { key } });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Delete setting error:', error);
    return NextResponse.json({ error: 'Failed to delete setting' }, { status: 500 });
  }
}
