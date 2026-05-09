import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma, isDatabaseAvailable } from '@/lib/db';
import { getPermissions, type Role } from '@/lib/permissions';

// 投稿テンプレートCRUD
// GET           : 一覧取得（自分のもの）
// POST          : 新規作成
// PATCH ?id=... : 更新（部分更新）
// DELETE ?id=...: 削除

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  if (!isDatabaseAvailable() || !prisma) {
    return NextResponse.json({ error: 'Database not available' }, { status: 503 });
  }

  const templates = await prisma.postTemplate.findMany({
    where: { userId: session.user.id },
    orderBy: [{ usageCount: 'desc' }, { createdAt: 'desc' }],
  });

  return NextResponse.json({ templates });
}

export async function POST(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  if (!isDatabaseAvailable() || !prisma) {
    return NextResponse.json({ error: 'Database not available' }, { status: 503 });
  }

  const body = await request.json();
  const { name, description, category, type, text, mediaUrls } = body ?? {};

  if (!name || typeof name !== 'string') {
    return NextResponse.json({ error: 'name is required' }, { status: 400 });
  }
  if (!type || typeof type !== 'string') {
    return NextResponse.json({ error: 'type is required' }, { status: 400 });
  }

  // プラン別上限チェック（ADMINは無制限）
  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { role: true },
  });
  if (user && user.role !== 'ADMIN') {
    const perms = getPermissions((user.role || 'STANDARD') as Role);
    if (perms.maxTemplates !== -1) {
      const current = await prisma.postTemplate.count({ where: { userId: session.user.id } });
      if (current >= perms.maxTemplates) {
        return NextResponse.json(
          { error: `テンプレートは最大${perms.maxTemplates}件までです。プランをアップグレードしてください。` },
          { status: 403 }
        );
      }
    }
  }

  const template = await prisma.postTemplate.create({
    data: {
      userId: session.user.id,
      name,
      description: description ?? null,
      category: category ?? null,
      type,
      text: text ?? null,
      mediaUrls: mediaUrls ?? null,
    },
  });

  return NextResponse.json({ template });
}

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
  if (!id) {
    return NextResponse.json({ error: 'id is required' }, { status: 400 });
  }

  // 所有者確認
  const existing = await prisma.postTemplate.findFirst({
    where: { id, userId: session.user.id },
  });
  if (!existing) {
    return NextResponse.json({ error: 'Template not found' }, { status: 404 });
  }

  const body = await request.json();
  const { name, description, category, type, text, mediaUrls, incrementUsage } = body ?? {};

  const data: Record<string, unknown> = {};
  if (name !== undefined) data.name = name;
  if (description !== undefined) data.description = description;
  if (category !== undefined) data.category = category;
  if (type !== undefined) data.type = type;
  if (text !== undefined) data.text = text;
  if (mediaUrls !== undefined) data.mediaUrls = mediaUrls;
  if (incrementUsage) data.usageCount = { increment: 1 };

  const template = await prisma.postTemplate.update({
    where: { id },
    data,
  });

  return NextResponse.json({ template });
}

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
  if (!id) {
    return NextResponse.json({ error: 'id is required' }, { status: 400 });
  }

  const result = await prisma.postTemplate.deleteMany({
    where: { id, userId: session.user.id },
  });

  if (result.count === 0) {
    return NextResponse.json({ error: 'Template not found' }, { status: 404 });
  }

  return NextResponse.json({ deleted: result.count });
}
