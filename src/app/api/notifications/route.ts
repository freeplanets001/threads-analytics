import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma, isDatabaseAvailable } from '@/lib/db';

// 通知一覧の取得
export async function GET(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  if (!isDatabaseAvailable() || !prisma) {
    return NextResponse.json({ error: 'Database not available' }, { status: 503 });
  }

  const { searchParams } = new URL(request.url);
  const unreadOnly = searchParams.get('unread') === '1';
  const limit = Math.min(parseInt(searchParams.get('limit') ?? '50', 10), 200);

  const notifications = await prisma.notification.findMany({
    where: {
      userId: session.user.id,
      ...(unreadOnly ? { isRead: false } : {}),
    },
    orderBy: { createdAt: 'desc' },
    take: limit,
  });

  const unreadCount = await prisma.notification.count({
    where: { userId: session.user.id, isRead: false },
  });

  return NextResponse.json({ notifications, unreadCount });
}

// 通知の作成（管理者・サーバー内部用は呼ばない想定だが、汎用に提供）
export async function POST(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  if (!isDatabaseAvailable() || !prisma) {
    return NextResponse.json({ error: 'Database not available' }, { status: 503 });
  }

  const body = await request.json();
  const { type, title, message, relatedId, relatedType } = body ?? {};

  if (!type || !title || !message) {
    return NextResponse.json({ error: 'type, title, message are required' }, { status: 400 });
  }

  const notification = await prisma.notification.create({
    data: {
      userId: session.user.id,
      type,
      title,
      message,
      relatedId: relatedId ?? null,
      relatedType: relatedType ?? null,
    },
  });

  return NextResponse.json({ notification });
}

// 通知を既読化（id指定 or all=1で全件）
export async function PATCH(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  if (!isDatabaseAvailable() || !prisma) {
    return NextResponse.json({ error: 'Database not available' }, { status: 503 });
  }

  const { searchParams } = new URL(request.url);
  const id = searchParams.get('id');
  const all = searchParams.get('all') === '1';

  if (all) {
    const result = await prisma.notification.updateMany({
      where: { userId: session.user.id, isRead: false },
      data: { isRead: true },
    });
    return NextResponse.json({ updated: result.count });
  }

  if (!id) {
    return NextResponse.json({ error: 'id or all=1 required' }, { status: 400 });
  }

  // 所有者確認込みで更新
  const result = await prisma.notification.updateMany({
    where: { id, userId: session.user.id },
    data: { isRead: true },
  });

  if (result.count === 0) {
    return NextResponse.json({ error: 'Notification not found' }, { status: 404 });
  }

  return NextResponse.json({ updated: result.count });
}

// 通知の削除（id指定 or all=1で全件）
export async function DELETE(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  if (!isDatabaseAvailable() || !prisma) {
    return NextResponse.json({ error: 'Database not available' }, { status: 503 });
  }

  const { searchParams } = new URL(request.url);
  const id = searchParams.get('id');
  const all = searchParams.get('all') === '1';

  if (all) {
    const result = await prisma.notification.deleteMany({
      where: { userId: session.user.id },
    });
    return NextResponse.json({ deleted: result.count });
  }

  if (!id) {
    return NextResponse.json({ error: 'id or all=1 required' }, { status: 400 });
  }

  const result = await prisma.notification.deleteMany({
    where: { id, userId: session.user.id },
  });

  if (result.count === 0) {
    return NextResponse.json({ error: 'Notification not found' }, { status: 404 });
  }

  return NextResponse.json({ deleted: result.count });
}
