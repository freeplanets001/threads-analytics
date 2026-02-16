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
  if (!user || !hasPermission(user.role as Role, 'adminPanel')) {
    return { error: NextResponse.json({ error: 'Admin access required' }, { status: 403 }) };
  }
  return { userId: session.user.id };
}

// 操作ログ取得（予約投稿の実行ログ + 自動リプライログ）
export async function GET(request: NextRequest) {
  try {
    const { error } = await requireAdmin();
    if (error) return error;

    const { searchParams } = new URL(request.url);
    const type = searchParams.get('type') || 'all'; // all, scheduled, autoreply
    const page = parseInt(searchParams.get('page') || '1', 10);
    const limit = Math.min(parseInt(searchParams.get('limit') || '50', 10), 100);
    const skip = (page - 1) * limit;

    const logs: Array<{
      id: string;
      type: string;
      action: string;
      status: string;
      detail: string;
      username?: string;
      createdAt: string;
    }> = [];

    // 予約投稿ログ（completed, failed のみ = 実行済み）
    if (type === 'all' || type === 'scheduled') {
      const scheduledLogs = await prisma!.scheduledPost.findMany({
        where: {
          status: { in: ['completed', 'failed'] },
        },
        include: {
          account: { select: { username: true } },
          user: { select: { name: true, email: true } },
        },
        orderBy: { updatedAt: 'desc' },
        take: limit,
        skip: type === 'scheduled' ? skip : 0,
      });

      for (const post of scheduledLogs) {
        logs.push({
          id: post.id,
          type: 'scheduled',
          action: post.isRecurring ? '定期投稿実行' : '予約投稿実行',
          status: post.status,
          detail: post.status === 'failed'
            ? `失敗: ${post.errorMessage || '不明なエラー'}`
            : `投稿タイプ: ${post.type}${post.postedId ? ` (ID: ${post.postedId})` : ''}`,
          username: post.account?.username || post.user?.name || post.user?.email || undefined,
          createdAt: post.updatedAt.toISOString(),
        });
      }
    }

    // 自動リプライログ
    if (type === 'all' || type === 'autoreply') {
      const replyLogs = await prisma!.autoReplyLog.findMany({
        include: {
          rule: {
            select: { name: true, account: { select: { username: true } } },
          },
        },
        orderBy: { createdAt: 'desc' },
        take: limit,
        skip: type === 'autoreply' ? skip : 0,
      });

      for (const log of replyLogs) {
        logs.push({
          id: log.id,
          type: 'autoreply',
          action: `自動リプライ: ${log.rule?.name || '不明なルール'}`,
          status: log.status,
          detail: log.status === 'failed'
            ? `失敗: ${log.errorMessage || '不明なエラー'}`
            : `@${log.originalUsername} への返信`,
          username: log.rule?.account?.username || undefined,
          createdAt: log.createdAt.toISOString(),
        });
      }
    }

    // 日付でソート
    logs.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

    // ページング
    const paginatedLogs = type === 'all' ? logs.slice(skip, skip + limit) : logs;

    // 集計
    const [totalScheduled, totalAutoReply, failedScheduled, failedAutoReply] = await Promise.all([
      prisma!.scheduledPost.count({ where: { status: { in: ['completed', 'failed'] } } }),
      prisma!.autoReplyLog.count(),
      prisma!.scheduledPost.count({ where: { status: 'failed' } }),
      prisma!.autoReplyLog.count({ where: { status: 'failed' } }),
    ]);

    return NextResponse.json({
      logs: paginatedLogs,
      stats: {
        totalScheduled,
        totalAutoReply,
        failedScheduled,
        failedAutoReply,
      },
      pagination: {
        page,
        limit,
        total: totalScheduled + totalAutoReply,
      },
    });
  } catch (error) {
    console.error('Get logs error:', error);
    return NextResponse.json({ error: 'Failed to get logs' }, { status: 500 });
  }
}
