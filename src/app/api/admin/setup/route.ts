import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma, isDatabaseAvailable } from '@/lib/db';

// 初回セットアップ: 最初のユーザーをADMINに設定
// または、ADMINが存在しない場合に現在のユーザーをADMINに設定
export async function POST() {
  try {
    const session = await auth();

    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (!isDatabaseAvailable() || !prisma) {
      return NextResponse.json({ error: 'Database not available' }, { status: 503 });
    }

    // 既存のADMINユーザーがいるかチェック
    const existingAdmin = await prisma.user.findFirst({
      where: { role: 'ADMIN' },
    });

    if (existingAdmin) {
      return NextResponse.json({
        error: 'Admin already exists. Contact an existing admin to change your role.',
        hasAdmin: true
      }, { status: 403 });
    }

    // 現在のユーザーをADMINに設定
    await prisma.user.update({
      where: { id: session.user.id },
      data: { role: 'ADMIN' },
    });

    return NextResponse.json({
      success: true,
      message: 'You are now an admin!',
      role: 'ADMIN'
    });
  } catch (error) {
    console.error('Admin setup error:', error);
    return NextResponse.json({ error: 'Failed to setup admin' }, { status: 500 });
  }
}

// 現在のユーザーの権限情報を取得
export async function GET() {
  try {
    const session = await auth();

    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (!isDatabaseAvailable() || !prisma) {
      return NextResponse.json({ error: 'Database not available' }, { status: 503 });
    }

    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { id: true, email: true, name: true, role: true, plan: true },
    });

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    // 既存のADMINがいるかチェック
    const adminCount = await prisma.user.count({
      where: { role: 'ADMIN' },
    });

    return NextResponse.json({
      user,
      adminExists: adminCount > 0,
      canBecomeAdmin: adminCount === 0,
    });
  } catch (error) {
    console.error('Get user info error:', error);
    return NextResponse.json({ error: 'Failed to get user info' }, { status: 500 });
  }
}
