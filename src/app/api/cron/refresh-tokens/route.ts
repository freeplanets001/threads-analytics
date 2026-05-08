import { NextRequest, NextResponse } from 'next/server';
import { prisma, isDatabaseAvailable } from '@/lib/db';
import { refreshLongLivedToken } from '@/lib/threads/auth';

const CRON_SECRET = process.env.CRON_SECRET;

export const maxDuration = 60;

// 期限切れまでこの日数を切ったらリフレッシュ対象
const REFRESH_THRESHOLD_DAYS = 7;
// Threads長期トークンは24時間経過後でないとリフレッシュできないため、新しすぎるトークンはスキップ
const MIN_TOKEN_AGE_HOURS = 25;

// 日次で Threads 長期トークンを自動リフレッシュする Cron
export async function GET(request: NextRequest) {
  try {
    // Cron認証
    const authHeader = request.headers.get('authorization');
    if (!CRON_SECRET) {
      console.error('CRON_SECRET is not configured');
      return NextResponse.json({ error: 'CRON_SECRET not configured' }, { status: 500 });
    }
    if (authHeader !== `Bearer ${CRON_SECRET}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (!isDatabaseAvailable() || !prisma) {
      return NextResponse.json({ error: 'Database not available' }, { status: 503 });
    }

    const now = new Date();
    const thresholdDate = new Date(now.getTime() + REFRESH_THRESHOLD_DAYS * 24 * 60 * 60 * 1000);
    const minAgeDate = new Date(now.getTime() - MIN_TOKEN_AGE_HOURS * 60 * 60 * 1000);

    // 対象抽出: 期限が閾値以内、かつトークン作成/更新から24時間以上経過
    const accounts = await prisma.threadsAccount.findMany({
      where: {
        tokenExpiresAt: { not: null, lte: thresholdDate, gt: now },
        updatedAt: { lte: minAgeDate },
      },
      select: {
        id: true,
        userId: true,
        username: true,
        accessToken: true,
        tokenExpiresAt: true,
      },
    });

    type Result = {
      accountId: string;
      username: string;
      status: 'refreshed' | 'failed' | 'skipped';
      newExpiresAt?: string;
      error?: string;
    };
    const results: Result[] = [];

    for (const account of accounts) {
      try {
        const refreshed = await refreshLongLivedToken(account.accessToken);
        const newExpiresAt = new Date(now.getTime() + refreshed.expires_in * 1000);

        await prisma.threadsAccount.update({
          where: { id: account.id },
          data: {
            accessToken: refreshed.access_token,
            tokenExpiresAt: newExpiresAt,
          },
        });

        results.push({
          accountId: account.id,
          username: account.username,
          status: 'refreshed',
          newExpiresAt: newExpiresAt.toISOString(),
        });
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Unknown error';
        results.push({
          accountId: account.id,
          username: account.username,
          status: 'failed',
          error: message,
        });

        // 失敗時はユーザーに通知（再認証を促す）
        try {
          await prisma.notification.create({
            data: {
              userId: account.userId,
              type: 'system',
              title: 'Threadsトークンの自動更新に失敗しました',
              message: `アカウント @${account.username} のトークン更新に失敗しました。期限切れ前に再認証してください。エラー: ${message.substring(0, 200)}`,
              relatedId: account.id,
              relatedType: 'threads_account',
            },
          });
        } catch (notifyErr) {
          console.error('Failed to create failure notification:', notifyErr);
        }
      }
    }

    // 期限切れ間近で対象外（新しすぎる）アカウントの数も把握
    const newishCount = await prisma.threadsAccount.count({
      where: {
        tokenExpiresAt: { not: null, lte: thresholdDate, gt: now },
        updatedAt: { gt: minAgeDate },
      },
    });

    return NextResponse.json({
      success: true,
      timestamp: now.toISOString(),
      processed: results.length,
      refreshed: results.filter(r => r.status === 'refreshed').length,
      failed: results.filter(r => r.status === 'failed').length,
      skippedTooNew: newishCount,
      results,
    });
  } catch (error) {
    console.error('Token refresh cron failed:', error);
    return NextResponse.json(
      {
        error: 'Cron failed',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
