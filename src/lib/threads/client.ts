// Threads API Client - 世界一の分析ツール用拡張版

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
  async getMyThreads(limit = 50): Promise<{ data: ThreadsMedia[] }> {
    return this.fetch<{ data: ThreadsMedia[] }>('/me/threads', {
      fields: 'id,media_type,media_url,permalink,text,timestamp,username,like_count,reply_count,repost_count,quote_count,is_quote_post',
      limit: limit.toString(),
    });
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
