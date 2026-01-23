// Threads API Client - Threads Studio

const THREADS_API_BASE = 'https://graph.threads.net/v1.0';

export interface ThreadsUser {
  id: string;
  username: string;
  name?: string;
  threads_profile_picture_url?: string;
  threads_biography?: string;
  followers_count?: number;
}

export interface ThreadsMedia {
  id: string;
  media_type: 'TEXT_POST' | 'IMAGE' | 'VIDEO' | 'CAROUSEL_ALBUM';
  media_url?: string;
  permalink: string;
  text?: string;
  timestamp: string;
  username: string;
  like_count?: number;
  reply_count?: number;
  repost_count?: number;
  quote_count?: number;
  is_quote_post?: boolean;
}

export interface ThreadsInsights {
  views: number;
  likes: number;
  replies: number;
  reposts: number;
  quotes: number;
  followers_count: number;
}

export interface ThreadsMediaInsight {
  id: string;
  views: number;
  likes: number;
  replies: number;
  reposts: number;
  quotes: number;
  shares: number;
}

export interface TimeSeriesDataPoint {
  date: string;
  value: number;
}

export interface TimeSeriesInsights {
  views: TimeSeriesDataPoint[];
  likes: number;
  replies: number;
  reposts: number;
  quotes: number;
  followers_count: number;
}

export interface DemographicData {
  country?: Array<{ country: string; value: number }>;
  city?: Array<{ city: string; value: number }>;
  age?: Array<{ age: string; value: number }>;
  gender?: Array<{ gender: string; value: number }>;
}

export class ThreadsAPIClient {
  private accessToken: string;

  constructor(accessToken: string) {
    this.accessToken = accessToken;
  }

  private async fetch<T>(endpoint: string, params: Record<string, string> = {}): Promise<T> {
    const url = new URL(`${THREADS_API_BASE}${endpoint}`);
    url.searchParams.set('access_token', this.accessToken);

    for (const [key, value] of Object.entries(params)) {
      url.searchParams.set(key, value);
    }

    const response = await fetch(url.toString());

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error?.message || 'Threads API error');
    }

    return response.json();
  }

  // 自分のプロフィール取得
  async getMe(): Promise<ThreadsUser> {
    return this.fetch<ThreadsUser>('/me', {
      fields: 'id,username,name,threads_profile_picture_url,threads_biography',
    });
  }

  // 自分の投稿一覧取得（拡張版）
  async getMyThreads(limit = 50): Promise<{ data: ThreadsMedia[]; paging?: { cursors?: { after?: string; before?: string }; next?: string } }> {
    return this.fetch<{ data: ThreadsMedia[]; paging?: { cursors?: { after?: string; before?: string }; next?: string } }>('/me/threads', {
      fields: 'id,media_type,media_url,permalink,text,timestamp,username,like_count,reply_count,repost_count,quote_count,is_quote_post',
      limit: limit.toString(),
    });
  }

  // 全投稿を取得（ページネーション対応）
  async getAllMyThreads(maxPosts = 500): Promise<{ data: ThreadsMedia[] }> {
    const allPosts: ThreadsMedia[] = [];
    let cursor: string | undefined;
    const batchSize = 100; // APIの最大値

    while (allPosts.length < maxPosts) {
      const params: Record<string, string> = {
        fields: 'id,media_type,media_url,permalink,text,timestamp,username,like_count,reply_count,repost_count,quote_count,is_quote_post',
        limit: batchSize.toString(),
      };

      if (cursor) {
        params.after = cursor;
      }

      const response = await this.fetch<{
        data: ThreadsMedia[];
        paging?: { cursors?: { after?: string; before?: string }; next?: string };
      }>('/me/threads', params);

      if (!response.data || response.data.length === 0) {
        break;
      }

      allPosts.push(...response.data);

      // 次のページがあるか確認
      if (response.paging?.cursors?.after) {
        cursor = response.paging.cursors.after;
      } else {
        break;
      }

      // 最大数に達した場合
      if (allPosts.length >= maxPosts) {
        break;
      }
    }

    return { data: allPosts.slice(0, maxPosts) };
  }

  // 自分のアカウントインサイト取得（時系列対応）
  async getMyInsights(): Promise<ThreadsInsights> {
    const response = await this.fetch<{
      data: Array<{
        name: string;
        total_value?: { value: number };
        values?: Array<{ value: number; end_time?: string }>;
      }>;
    }>('/me/threads_insights', {
      metric: 'views,likes,replies,reposts,quotes,followers_count',
    });

    const insights: ThreadsInsights = {
      views: 0,
      likes: 0,
      replies: 0,
      reposts: 0,
      quotes: 0,
      followers_count: 0,
    };

    for (const item of response.data) {
      const value = item.total_value?.value ?? item.values?.[0]?.value ?? 0;
      if (item.name in insights) {
        insights[item.name as keyof ThreadsInsights] = value;
      }
    }

    return insights;
  }

  // 時系列インサイト取得
  async getTimeSeriesInsights(since?: number, until?: number): Promise<TimeSeriesInsights> {
    const params: Record<string, string> = {
      metric: 'views,likes,replies,reposts,quotes,followers_count',
    };

    if (since) params.since = since.toString();
    if (until) params.until = until.toString();

    const response = await this.fetch<{
      data: Array<{
        name: string;
        total_value?: { value: number };
        values?: Array<{ value: number; end_time?: string }>;
      }>;
    }>('/me/threads_insights', params);

    const result: TimeSeriesInsights = {
      views: [],
      likes: 0,
      replies: 0,
      reposts: 0,
      quotes: 0,
      followers_count: 0,
    };

    for (const item of response.data) {
      if (item.name === 'views' && item.values) {
        result.views = item.values.map(v => ({
          date: v.end_time || new Date().toISOString(),
          value: v.value,
        }));
      } else {
        const value = item.total_value?.value ?? item.values?.[0]?.value ?? 0;
        switch (item.name) {
          case 'likes': result.likes = value; break;
          case 'replies': result.replies = value; break;
          case 'reposts': result.reposts = value; break;
          case 'quotes': result.quotes = value; break;
          case 'followers_count': result.followers_count = value; break;
        }
      }
    }

    return result;
  }

  // フォロワー数を取得
  async getFollowersCount(): Promise<number> {
    try {
      const response = await this.fetch<{
        data: Array<{ name: string; total_value?: { value: number }; values?: Array<{ value: number }> }>;
      }>('/me/threads_insights', {
        metric: 'followers_count',
      });

      const item = response.data.find(d => d.name === 'followers_count');
      return item?.total_value?.value ?? item?.values?.[0]?.value ?? 0;
    } catch {
      return 0;
    }
  }

  // フォロワー属性取得（100人以上必要）
  async getFollowerDemographics(breakdown: 'country' | 'city' | 'age' | 'gender'): Promise<Array<{ dimension: string; value: number }>> {
    try {
      const response = await this.fetch<{
        data: Array<{
          name: string;
          total_value?: {
            breakdowns: Array<{
              dimension_keys: string[];
              results: Array<{ dimension_values: string[]; value: number }>;
            }>;
          };
        }>;
      }>('/me/threads_insights', {
        metric: 'follower_demographics',
        breakdown,
      });

      const item = response.data.find(d => d.name === 'follower_demographics');
      if (!item?.total_value?.breakdowns?.[0]?.results) return [];

      return item.total_value.breakdowns[0].results.map(r => ({
        dimension: r.dimension_values[0],
        value: r.value,
      }));
    } catch {
      return [];
    }
  }

  // 投稿のインサイト取得（拡張版）
  async getMediaInsights(mediaId: string): Promise<ThreadsMediaInsight> {
    const response = await this.fetch<{
      data: Array<{ name: string; values: Array<{ value: number }> }>;
    }>(`/${mediaId}/insights`, {
      metric: 'views,likes,replies,reposts,quotes,shares',
    });

    const insight: ThreadsMediaInsight = {
      id: mediaId,
      views: 0,
      likes: 0,
      replies: 0,
      reposts: 0,
      quotes: 0,
      shares: 0,
    };

    for (const item of response.data) {
      const value = item.values[0]?.value || 0;
      switch (item.name) {
        case 'views': insight.views = value; break;
        case 'likes': insight.likes = value; break;
        case 'replies': insight.replies = value; break;
        case 'reposts': insight.reposts = value; break;
        case 'quotes': insight.quotes = value; break;
        case 'shares': insight.shares = value; break;
      }
    }

    return insight;
  }

  // ユーザーのプロフィール取得（公開情報）
  async getUser(userId: string): Promise<ThreadsUser> {
    return this.fetch<ThreadsUser>(`/${userId}`, {
      fields: 'id,username,name,threads_profile_picture_url,threads_biography',
    });
  }

  // ユーザーの投稿取得（公開情報）
  async getUserThreads(userId: string, limit = 25): Promise<{ data: ThreadsMedia[] }> {
    return this.fetch<{ data: ThreadsMedia[] }>(`/${userId}/threads`, {
      fields: 'id,media_type,media_url,permalink,text,timestamp,username,like_count,reply_count,repost_count,quote_count,is_quote_post',
      limit: limit.toString(),
    });
  }

  // 投稿へのリプライを取得（誰がリプライしたか）
  async getPostReplies(postId: string): Promise<{
    data: Array<{
      id: string;
      text?: string;
      timestamp: string;
      username: string;
      like_count?: number;
    }>;
  }> {
    try {
      return await this.fetch<{
        data: Array<{
          id: string;
          text?: string;
          timestamp: string;
          username: string;
          like_count?: number;
        }>;
      }>(`/${postId}/replies`, {
        fields: 'id,text,timestamp,username,like_count',
      });
    } catch {
      return { data: [] };
    }
  }

  // 自分のリプライ一覧を取得（会話追跡用）
  async getMyReplies(limit = 50): Promise<{
    data: Array<{
      id: string;
      text?: string;
      timestamp: string;
      username: string;
      like_count?: number;
      reply_count?: number;
    }>;
  }> {
    return this.fetch<{
      data: Array<{
        id: string;
        text?: string;
        timestamp: string;
        username: string;
        like_count?: number;
        reply_count?: number;
      }>;
    }>('/me/replies', {
      fields: 'id,text,timestamp,username,like_count,reply_count',
      limit: limit.toString(),
    });
  }

  // ========================================
  // 投稿作成機能
  // ========================================

  private async post<T>(endpoint: string, body: Record<string, unknown>): Promise<T> {
    const url = new URL(`${THREADS_API_BASE}${endpoint}`);
    url.searchParams.set('access_token', this.accessToken);

    const response = await fetch(url.toString(), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error?.message || 'Threads API error');
    }

    return response.json();
  }

  // テキスト投稿のコンテナ作成
  async createTextContainer(text: string, replyToId?: string): Promise<{ id: string }> {
    const body: Record<string, unknown> = {
      media_type: 'TEXT',
      text,
    };
    if (replyToId) {
      body.reply_to_id = replyToId;
    }
    return this.post<{ id: string }>('/me/threads', body);
  }

  // 画像投稿のコンテナ作成
  async createImageContainer(imageUrl: string, text?: string, replyToId?: string): Promise<{ id: string }> {
    const body: Record<string, unknown> = {
      media_type: 'IMAGE',
      image_url: imageUrl,
    };
    if (text) body.text = text;
    if (replyToId) body.reply_to_id = replyToId;
    return this.post<{ id: string }>('/me/threads', body);
  }

  // 動画投稿のコンテナ作成
  async createVideoContainer(videoUrl: string, text?: string, replyToId?: string): Promise<{ id: string }> {
    const body: Record<string, unknown> = {
      media_type: 'VIDEO',
      video_url: videoUrl,
    };
    if (text) body.text = text;
    if (replyToId) body.reply_to_id = replyToId;
    return this.post<{ id: string }>('/me/threads', body);
  }

  // カルーセル用の子アイテムコンテナ作成
  async createCarouselItemContainer(
    mediaType: 'IMAGE' | 'VIDEO',
    mediaUrl: string
  ): Promise<{ id: string }> {
    const body: Record<string, unknown> = {
      media_type: mediaType,
      is_carousel_item: true,
    };
    if (mediaType === 'IMAGE') {
      body.image_url = mediaUrl;
    } else {
      body.video_url = mediaUrl;
    }
    return this.post<{ id: string }>('/me/threads', body);
  }

  // カルーセル投稿のコンテナ作成
  async createCarouselContainer(childrenIds: string[], text?: string, replyToId?: string): Promise<{ id: string }> {
    const body: Record<string, unknown> = {
      media_type: 'CAROUSEL',
      children: childrenIds.join(','),
    };
    if (text) body.text = text;
    if (replyToId) body.reply_to_id = replyToId;
    return this.post<{ id: string }>('/me/threads', body);
  }

  // コンテナのステータス確認
  async getContainerStatus(containerId: string): Promise<{ id: string; status: string; error_message?: string }> {
    return this.fetch<{ id: string; status: string; error_message?: string }>(`/${containerId}`, {
      fields: 'id,status,error_message',
    });
  }

  // コンテナを公開
  async publishContainer(containerId: string): Promise<{ id: string }> {
    return this.post<{ id: string }>('/me/threads_publish', {
      creation_id: containerId,
    });
  }

  // 投稿の公開制限を確認
  async getPublishingLimit(): Promise<{
    quota_usage: number;
    config: { quota_total: number; quota_duration: number };
  }> {
    return this.fetch<{
      quota_usage: number;
      config: { quota_total: number; quota_duration: number };
    }>('/me/threads_publishing_limit', {
      fields: 'quota_usage,config',
    });
  }

  // ========================================
  // 高レベル投稿ヘルパー
  // ========================================

  // コンテナが準備完了するまで待機
  async waitForContainer(containerId: string, maxWaitMs = 30000): Promise<boolean> {
    const startTime = Date.now();
    while (Date.now() - startTime < maxWaitMs) {
      const status = await this.getContainerStatus(containerId);
      if (status.status === 'FINISHED') {
        return true;
      }
      if (status.status === 'ERROR') {
        throw new Error(status.error_message || 'Container processing failed');
      }
      // 2秒待機
      await new Promise(resolve => setTimeout(resolve, 2000));
    }
    throw new Error('Container processing timeout');
  }

  // テキスト投稿（ワンステップ）
  async postText(text: string, replyToId?: string): Promise<{ id: string }> {
    const container = await this.createTextContainer(text, replyToId);
    await this.waitForContainer(container.id);
    return this.publishContainer(container.id);
  }

  // 画像投稿（ワンステップ）
  async postImage(imageUrl: string, text?: string, replyToId?: string): Promise<{ id: string }> {
    const container = await this.createImageContainer(imageUrl, text, replyToId);
    await this.waitForContainer(container.id);
    return this.publishContainer(container.id);
  }

  // 動画投稿（ワンステップ）
  async postVideo(videoUrl: string, text?: string, replyToId?: string): Promise<{ id: string }> {
    const container = await this.createVideoContainer(videoUrl, text, replyToId);
    await this.waitForContainer(container.id, 120000); // 動画は長めに待機
    return this.publishContainer(container.id);
  }

  // カルーセル投稿（ワンステップ）
  async postCarousel(
    items: Array<{ type: 'IMAGE' | 'VIDEO'; url: string }>,
    text?: string,
    replyToId?: string
  ): Promise<{ id: string }> {
    // 子アイテムのコンテナを作成
    const childrenIds: string[] = [];
    for (const item of items) {
      const child = await this.createCarouselItemContainer(item.type, item.url);
      await this.waitForContainer(child.id, item.type === 'VIDEO' ? 120000 : 30000);
      childrenIds.push(child.id);
    }

    // カルーセルコンテナを作成
    const container = await this.createCarouselContainer(childrenIds, text, replyToId);
    await this.waitForContainer(container.id);
    return this.publishContainer(container.id);
  }

  // スレッド投稿（複数の投稿を連結）
  async postThread(posts: Array<{
    text: string;
    imageUrl?: string;
    videoUrl?: string;
  }>): Promise<{ ids: string[] }> {
    if (posts.length === 0) {
      throw new Error('At least one post is required');
    }

    const ids: string[] = [];
    let replyToId: string | undefined;

    for (const post of posts) {
      let result: { id: string };

      if (post.videoUrl) {
        result = await this.postVideo(post.videoUrl, post.text, replyToId);
      } else if (post.imageUrl) {
        result = await this.postImage(post.imageUrl, post.text, replyToId);
      } else {
        result = await this.postText(post.text, replyToId);
      }

      ids.push(result.id);
      replyToId = result.id;
    }

    return { ids };
  }
}

// シングルトンインスタンス用
let clientInstance: ThreadsAPIClient | null = null;

export function getThreadsClient(accessToken?: string): ThreadsAPIClient {
  const token = accessToken || process.env.THREADS_ACCESS_TOKEN;

  if (!token) {
    throw new Error('Threads access token is required');
  }

  if (!clientInstance || accessToken) {
    clientInstance = new ThreadsAPIClient(token);
  }

  return clientInstance;
}
