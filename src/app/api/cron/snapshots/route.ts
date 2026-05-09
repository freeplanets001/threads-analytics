import { NextRequest, NextResponse } from 'next/server';
import { prisma, isDatabaseAvailable } from '@/lib/db';
import { ThreadsAPIClient } from '@/lib/threads/client';

const CRON_SECRET = process.env.CRON_SECRET;

export const maxDuration = 60;

// アカウント1件ごとに、当日分の daily スナップショットを最大1件保存する
// type='daily' は (accountId, periodStart) の組で重複しないようupsert相当の処理
export async function GET(request: NextRequest) {
  try {
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

    const cronStartedAt = Date.now();
    const now = new Date();
    // 当日0:00 UTC
    const todayStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
    const todayEnd = new Date(todayStart.getTime() + 24 * 60 * 60 * 1000);

    // 全アカウントを対象（期限切れトークンは個別エラーとして記録）
    const accounts = await prisma.threadsAccount.findMany({
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
      status: 'saved' | 'updated' | 'failed' | 'token_expired';
      error?: string;
    };
    const results: Result[] = [];

    for (const account of accounts) {
      try {
        if (account.tokenExpiresAt && account.tokenExpiresAt < now) {
          results.push({
            accountId: account.id,
            username: account.username,
            status: 'token_expired',
          });
          continue;
        }

        const client = new ThreadsAPIClient(account.accessToken);
        const insights = await client.getMyInsights();

        // 当日分の daily スナップショットが既にあれば update、なければ create
        const existing = await prisma.analyticsSnapshot.findFirst({
          where: {
            accountId: account.id,
            type: 'daily',
            periodStart: todayStart,
          },
        });

        const dataJson = JSON.stringify({
          ...insights,
          capturedAt: now.toISOString(),
        });

        if (existing) {
          await prisma.analyticsSnapshot.update({
            where: { id: existing.id },
            data: { data: dataJson, periodEnd: todayEnd },
          });
          results.push({ accountId: account.id, username: account.username, status: 'updated' });
        } else {
          await prisma.analyticsSnapshot.create({
            data: {
              accountId: account.id,
              type: 'daily',
              periodStart: todayStart,
              periodEnd: todayEnd,
              data: dataJson,
            },
          });
          results.push({ accountId: account.id, username: account.username, status: 'saved' });
        }
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Unknown error';
        console.error(`[snapshots] account ${account.id}:`, err);
        results.push({
          accountId: account.id,
          username: account.username,
          status: 'failed',
          error: message,
        });
      }
    }

    // 古いdailyスナップショットの剪定（保持90日）
    const retentionStart = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000);
    await prisma.analyticsSnapshot.deleteMany({
      where: {
        type: 'daily',
        periodStart: { lt: retentionStart },
      },
    });

    // 観測用システム設定
    const elapsedMs = Date.now() - cronStartedAt;
    await prisma.systemSetting.upsert({
      where: { key: 'snapshots_last_completed_at' },
      create: {
        key: 'snapshots_last_completed_at',
        value: JSON.stringify({
          at: new Date().toISOString(),
          elapsedMs,
          accounts: accounts.length,
          saved: results.filter(r => r.status === 'saved').length,
          updated: results.filter(r => r.status === 'updated').length,
          failed: results.filter(r => r.status === 'failed').length,
          tokenExpired: results.filter(r => r.status === 'token_expired').length,
        }),
      },
      update: {
        value: JSON.stringify({
          at: new Date().toISOString(),
          elapsedMs,
          accounts: accounts.length,
          saved: results.filter(r => r.status === 'saved').length,
          updated: results.filter(r => r.status === 'updated').length,
          failed: results.filter(r => r.status === 'failed').length,
          tokenExpired: results.filter(r => r.status === 'token_expired').length,
        }),
      },
    }).catch(e => console.error('Failed to upsert snapshots_last_completed_at:', e));

    return NextResponse.json({
      success: true,
      timestamp: now.toISOString(),
      elapsedMs,
      accounts: accounts.length,
      results,
    });
  } catch (error) {
    console.error('Snapshot cron failed:', error);
    return NextResponse.json(
      { error: 'Cron failed', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
