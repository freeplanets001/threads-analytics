import { prisma } from '@/lib/db';
import { ThreadsAPIClient } from '@/lib/threads/client';

/** processPostに渡す投稿データの型 */
export interface ScheduledPostForExecution {
  id: string;
  type: string;
  text: string | null;
  mediaUrls: string | null;
  threadPosts: string | null;
  account: { accessToken: string };
}

/** 投稿実行結果 */
export interface PostExecutionResult {
  status: 'completed' | 'failed' | 'skipped';
  error?: string;
}

/** processing状態が一定時間以上続いた場合にfailedに戻すタイムアウト（ミリ秒） */
const PROCESSING_TIMEOUT_MS = 5 * 60 * 1000; // 5分

/**
 * 1件の予約投稿を実行する
 * 楽観的ロックで重複実行を防止
 */
export async function processPost(post: ScheduledPostForExecution): Promise<PostExecutionResult> {
  try {
    if (!prisma) {
      return { status: 'failed', error: 'データベースが利用できません' };
    }

    // ステータスを処理中に更新（楽観的ロック: pendingのものだけ更新）
    const updated = await prisma.scheduledPost.updateMany({
      where: { id: post.id, status: 'pending' },
      data: { status: 'processing' },
    });

    // 他のプロセスが先に処理を開始していた場合はスキップ
    if (updated.count === 0) {
      return { status: 'skipped', error: '別のプロセスが処理中です' };
    }

    const client = new ThreadsAPIClient(post.account.accessToken);

    let postedId: string;

    // 投稿タイプに応じて処理
    if (post.type === 'text' || (!post.mediaUrls && !post.threadPosts)) {
      const result = await client.postText(post.text || '');
      postedId = result.id;
    } else if (post.type === 'image') {
      const mediaUrls = JSON.parse(post.mediaUrls!) as string[];
      const result = await client.postImage(mediaUrls[0], post.text || undefined);
      postedId = result.id;
    } else if (post.type === 'video') {
      const mediaUrls = JSON.parse(post.mediaUrls!) as string[];
      const result = await client.postVideo(mediaUrls[0], post.text || undefined);
      postedId = result.id;
    } else if (post.type === 'carousel') {
      const mediaUrls = JSON.parse(post.mediaUrls!) as string[];
      const items = mediaUrls.map(url => ({
        type: url.match(/\.(mp4|mov|webm)$/i) ? 'VIDEO' : 'IMAGE' as 'VIDEO' | 'IMAGE',
        url,
      }));
      const result = await client.postCarousel(items, post.text || undefined);
      postedId = result.id;
    } else if (post.type === 'thread') {
      if (!post.threadPosts) {
        throw new Error('Thread posts data is missing');
      }
      const threadPostsData = JSON.parse(post.threadPosts) as Array<{
        text: string;
        imageUrl?: string;
        videoUrl?: string;
      }>;
      const result = await client.postThread(threadPostsData);
      postedId = result.ids.join(',');
    } else {
      const result = await client.postText(post.text || '');
      postedId = result.id;
    }

    // 成功
    await prisma.scheduledPost.update({
      where: { id: post.id },
      data: {
        status: 'completed',
        postedId,
      },
    });

    return { status: 'completed' };

  } catch (error) {
    console.error(`Failed to post ${post.id}:`, error);

    // 失敗ステータスに更新
    try {
      if (prisma) {
        await prisma.scheduledPost.update({
          where: { id: post.id },
          data: {
            status: 'failed',
            errorMessage: error instanceof Error ? error.message : 'Unknown error',
          },
        });
      }
    } catch (dbError) {
      console.error(`Failed to update post status for ${post.id}:`, dbError);
    }

    return {
      status: 'failed',
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * processing状態が一定時間以上続いている投稿をfailedに戻す
 */
export async function recoverStuckPosts(): Promise<number> {
  if (!prisma) return 0;

  const stuckThreshold = new Date(Date.now() - PROCESSING_TIMEOUT_MS);
  const result = await prisma.scheduledPost.updateMany({
    where: {
      status: 'processing',
      updatedAt: { lt: stuckThreshold },
    },
    data: {
      status: 'failed',
      errorMessage: 'タイムアウト: 処理が完了しませんでした。再度予約してください。',
    },
  });

  if (result.count > 0) {
    console.log(`Recovered ${result.count} stuck posts`);
  }
  return result.count;
}
