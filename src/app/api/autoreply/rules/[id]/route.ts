import { NextRequest, NextResponse } from 'next/server';
import { prisma, isDatabaseAvailable } from '@/lib/db';

// GET: 個別ルール取得
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    if (!isDatabaseAvailable() || !prisma) {
      return NextResponse.json({ error: 'Database not available' }, { status: 503 });
    }

    const { id } = await params;

    const rule = await prisma.autoReplyRule.findUnique({
      where: { id },
      include: {
        replyLogs: {
          orderBy: { createdAt: 'desc' },
          take: 20,
        },
      },
    });

    if (!rule) {
      return NextResponse.json({ error: 'Rule not found' }, { status: 404 });
    }

    return NextResponse.json(rule);
  } catch (error) {
    console.error('Failed to fetch rule:', error);
    return NextResponse.json({ error: 'Failed to fetch rule' }, { status: 500 });
  }
}

// PUT: ルール更新
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    if (!isDatabaseAvailable() || !prisma) {
      return NextResponse.json({ error: 'Database not available' }, { status: 503 });
    }

    const { id } = await params;
    const body = await request.json();
    const {
      name,
      isActive,
      triggerType,
      triggerKeywords,
      responseType,
      responseText,
      responseDelay,
      onlyNewFollowers,
      excludeFollowing,
      maxRepliesPerDay,
    } = body;

    const rule = await prisma.autoReplyRule.update({
      where: { id },
      data: {
        ...(name !== undefined && { name }),
        ...(isActive !== undefined && { isActive }),
        ...(triggerType !== undefined && { triggerType }),
        ...(triggerKeywords !== undefined && {
          triggerKeywords: triggerKeywords ? JSON.stringify(triggerKeywords) : null,
        }),
        ...(responseType !== undefined && { responseType }),
        ...(responseText !== undefined && { responseText }),
        ...(responseDelay !== undefined && { responseDelay }),
        ...(onlyNewFollowers !== undefined && { onlyNewFollowers }),
        ...(excludeFollowing !== undefined && { excludeFollowing }),
        ...(maxRepliesPerDay !== undefined && { maxRepliesPerDay }),
      },
    });

    return NextResponse.json(rule);
  } catch (error) {
    console.error('Failed to update rule:', error);
    return NextResponse.json({ error: 'Failed to update rule' }, { status: 500 });
  }
}

// DELETE: ルール削除
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    if (!isDatabaseAvailable() || !prisma) {
      return NextResponse.json({ error: 'Database not available' }, { status: 503 });
    }

    const { id } = await params;

    await prisma.autoReplyRule.delete({
      where: { id },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Failed to delete rule:', error);
    return NextResponse.json({ error: 'Failed to delete rule' }, { status: 500 });
  }
}
