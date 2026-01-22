import { NextRequest, NextResponse } from 'next/server';
import { ThreadsAPIClient } from '@/lib/threads/client';

export interface PostRequest {
  type: 'text' | 'image' | 'video' | 'carousel' | 'thread';
  text?: string;
  imageUrl?: string;
  videoUrl?: string;
  carouselItems?: Array<{ type: 'IMAGE' | 'VIDEO'; url: string }>;
  threadPosts?: Array<{ text: string; imageUrl?: string; videoUrl?: string }>;
  replyToId?: string;
}

export async function POST(request: NextRequest) {
  const authHeader = request.headers.get('Authorization');
  const accessToken = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : null;

  if (!accessToken) {
    return NextResponse.json(
      { error: 'Not authenticated', code: 'NOT_AUTHENTICATED' },
      { status: 401 }
    );
  }

  try {
    const body: PostRequest = await request.json();
    const client = new ThreadsAPIClient(accessToken);

    // 投稿制限を確認（エラーでも投稿は試みる）
    let remainingQuota: number | null = null;
    try {
      const limit = await client.getPublishingLimit();
      if (limit?.config?.quota_total && limit?.quota_usage !== undefined) {
        remainingQuota = limit.config.quota_total - limit.quota_usage;
        if (limit.quota_usage >= limit.config.quota_total) {
          return NextResponse.json(
            { error: '投稿制限に達しています。しばらく待ってから再試行してください。', code: 'RATE_LIMIT' },
            { status: 429 }
          );
        }
      }
    } catch (limitError) {
      console.warn('Could not check publishing limit:', limitError);
      // 制限チェックに失敗しても投稿は試みる
    }

    let result: { id: string } | { ids: string[] };

    switch (body.type) {
      case 'text':
        if (!body.text) {
          return NextResponse.json({ error: 'テキストが必要です' }, { status: 400 });
        }
        result = await client.postText(body.text, body.replyToId);
        break;

      case 'image':
        if (!body.imageUrl) {
          return NextResponse.json({ error: '画像URLが必要です' }, { status: 400 });
        }
        result = await client.postImage(body.imageUrl, body.text, body.replyToId);
        break;

      case 'video':
        if (!body.videoUrl) {
          return NextResponse.json({ error: '動画URLが必要です' }, { status: 400 });
        }
        result = await client.postVideo(body.videoUrl, body.text, body.replyToId);
        break;

      case 'carousel':
        if (!body.carouselItems || body.carouselItems.length < 2) {
          return NextResponse.json({ error: 'カルーセルには2つ以上のアイテムが必要です' }, { status: 400 });
        }
        if (body.carouselItems.length > 20) {
          return NextResponse.json({ error: 'カルーセルは最大20アイテムまでです' }, { status: 400 });
        }
        result = await client.postCarousel(body.carouselItems, body.text, body.replyToId);
        break;

      case 'thread':
        if (!body.threadPosts || body.threadPosts.length < 2) {
          return NextResponse.json({ error: 'スレッドには2つ以上の投稿が必要です' }, { status: 400 });
        }
        result = await client.postThread(body.threadPosts);
        break;

      default:
        return NextResponse.json({ error: '無効な投稿タイプです' }, { status: 400 });
    }

    return NextResponse.json({
      success: true,
      ...result,
      remainingQuota: remainingQuota !== null ? remainingQuota - 1 : null,
    });
  } catch (err) {
    console.error('Post error:', err);
    const message = err instanceof Error ? err.message : 'Failed to create post';
    return NextResponse.json(
      { error: message, code: 'POST_ERROR' },
      { status: 500 }
    );
  }
}

// 投稿制限の確認
export async function GET(request: NextRequest) {
  const authHeader = request.headers.get('Authorization');
  const accessToken = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : null;

  if (!accessToken) {
    return NextResponse.json(
      { error: 'Not authenticated', code: 'NOT_AUTHENTICATED' },
      { status: 401 }
    );
  }

  try {
    const client = new ThreadsAPIClient(accessToken);
    const limit = await client.getPublishingLimit();

    // 安全にアクセス
    const quotaUsage = limit?.quota_usage ?? 0;
    const quotaTotal = limit?.config?.quota_total ?? 250;
    const quotaDuration = limit?.config?.quota_duration ?? 86400;

    return NextResponse.json({
      used: quotaUsage,
      total: quotaTotal,
      remaining: quotaTotal - quotaUsage,
      resetDuration: quotaDuration,
    });
  } catch (err) {
    console.error('Get limit error:', err);
    // デフォルト値を返す（APIエラーでもUIが動作するように）
    return NextResponse.json({
      used: 0,
      total: 250,
      remaining: 250,
      resetDuration: 86400,
      error: 'Could not fetch exact limit',
    });
  }
}
