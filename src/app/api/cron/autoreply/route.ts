import { NextRequest, NextResponse } from 'next/server';
import { prisma, isDatabaseAvailable } from '@/lib/db';
import { ThreadsAPIClient } from '@/lib/threads/client';

// Vercel Cron認証
const CRON_SECRET = process.env.CRON_SECRET;

interface AutoReplyRule {
  id: string;
  accountId: string;
  name: string;
  isActive: boolean;
  triggerType: string;
  triggerKeywords: string | null;
  responseText: string;
  responseDelay: number;
  onlyNewFollowers: boolean;
  excludeFollowing: boolean;
  maxRepliesPerDay: number;
  totalReplies: number;
  todayReplies: number;
  lastResetDate: Date | null;
  account: {
    accessToken: string;
    threadsUserId: string;
    username: string;
  };
}

// 5分ごとに実行されるCronジョブ
export async function GET(request: NextRequest) {
  try {
    // Cron認証チェック（本番環境用）
    const authHeader = request.headers.get('authorization');
    if (CRON_SECRET && authHeader !== `Bearer ${CRON_SECRET}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (!isDatabaseAvailable() || !prisma) {
      return NextResponse.json({ error: 'Database not available' }, { status: 503 });
    }

    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

    // アクティブなルールを取得
    const rules = await prisma.autoReplyRule.findMany({
      where: { isActive: true },
      include: {
        account: {
          select: {
            accessToken: true,
            threadsUserId: true,
            username: true,
          },
        },
      },
    }) as AutoReplyRule[];

    const results: Array<{ ruleId: string; ruleName: string; processed: number; replied: number; errors: string[] }> = [];

    for (const rule of rules) {
      const ruleResult = { ruleId: rule.id, ruleName: rule.name, processed: 0, replied: 0, errors: [] as string[] };

      try {
        // 日付リセットチェック
        if (!rule.lastResetDate || new Date(rule.lastResetDate) < today) {
          await prisma.autoReplyRule.update({
            where: { id: rule.id },
            data: { todayReplies: 0, lastResetDate: today },
          });
          rule.todayReplies = 0;
        }

        // 1日の上限チェック
        if (rule.todayReplies >= rule.maxRepliesPerDay) {
          ruleResult.errors.push('Daily limit reached');
          results.push(ruleResult);
          continue;
        }

        const client = new ThreadsAPIClient(rule.account.accessToken);

        // 最近の投稿を取得
        const { data: posts } = await client.getMyThreads(10);

        for (const post of posts) {
          // 投稿のリプライを取得
          const { data: replies } = await client.getPostReplies(post.id);

          for (const reply of replies) {
            // 自分のリプライはスキップ
            if (reply.username === rule.account.username) {
              continue;
            }

            ruleResult.processed++;

            // 処理済みかチェック
            const processed = await prisma.processedReply.findUnique({
              where: { replyId: reply.id },
            });

            if (processed) {
              continue;
            }

            // トリガー条件をチェック
            const shouldReply = checkTriggerCondition(rule, reply.text || '');

            if (!shouldReply) {
              continue;
            }

            // 1日の上限再チェック
            if (rule.todayReplies >= rule.maxRepliesPerDay) {
              break;
            }

            // 自動リプライを送信
            try {
              // プレースホルダーを置換
              const replyText = rule.responseText.replace(/{username}/g, reply.username);

              // 遅延を適用（最小10秒）
              const delay = Math.max(rule.responseDelay * 1000, 10000);
              await new Promise(resolve => setTimeout(resolve, Math.min(delay, 30000))); // 最大30秒

              // リプライを投稿
              const result = await client.postText(replyText, reply.id);

              // ログを保存
              await prisma.autoReplyLog.create({
                data: {
                  ruleId: rule.id,
                  originalPostId: post.id,
                  originalUserId: reply.id, // ユーザーIDは不明なのでリプライIDで代用
                  originalUsername: reply.username,
                  originalText: reply.text || null,
                  replyPostId: result.id,
                  replyText: replyText,
                  status: 'sent',
                },
              });

              // 統計を更新
              await prisma.autoReplyRule.update({
                where: { id: rule.id },
                data: {
                  totalReplies: { increment: 1 },
                  todayReplies: { increment: 1 },
                  lastReplyAt: new Date(),
                },
              });

              rule.todayReplies++;
              ruleResult.replied++;

            } catch (replyError) {
              console.error(`Failed to send auto-reply for rule ${rule.id}:`, replyError);

              // エラーログを保存
              await prisma.autoReplyLog.create({
                data: {
                  ruleId: rule.id,
                  originalPostId: post.id,
                  originalUserId: reply.id,
                  originalUsername: reply.username,
                  originalText: reply.text || null,
                  replyText: rule.responseText.replace(/{username}/g, reply.username),
                  status: 'failed',
                  errorMessage: replyError instanceof Error ? replyError.message : 'Unknown error',
                },
              });

              ruleResult.errors.push(`Reply failed: ${replyError instanceof Error ? replyError.message : 'Unknown error'}`);
            }

            // 処理済みとしてマーク
            await prisma.processedReply.create({
              data: {
                accountId: rule.accountId,
                replyId: reply.id,
              },
            });
          }
        }
      } catch (error) {
        console.error(`Error processing rule ${rule.id}:`, error);
        ruleResult.errors.push(error instanceof Error ? error.message : 'Unknown error');
      }

      results.push(ruleResult);
    }

    // 古い処理済みレコードを削除（7日以上前）
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    await prisma.processedReply.deleteMany({
      where: {
        processedAt: { lt: sevenDaysAgo },
      },
    });

    return NextResponse.json({
      success: true,
      timestamp: now.toISOString(),
      rulesProcessed: rules.length,
      results,
    });

  } catch (error) {
    console.error('Cron job failed:', error);
    return NextResponse.json(
      { error: 'Cron job failed', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

// トリガー条件をチェック
function checkTriggerCondition(rule: AutoReplyRule, text: string): boolean {
  switch (rule.triggerType) {
    case 'all':
      return true;

    case 'mention':
      // @username形式のメンションをチェック
      return text.toLowerCase().includes(`@${rule.account.username.toLowerCase()}`);

    case 'keyword':
      if (!rule.triggerKeywords) return false;
      try {
        const keywords = JSON.parse(rule.triggerKeywords) as string[];
        const lowerText = text.toLowerCase();
        return keywords.some(kw => lowerText.includes(kw.toLowerCase()));
      } catch {
        return false;
      }

    default:
      return false;
  }
}
