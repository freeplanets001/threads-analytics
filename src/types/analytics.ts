// Threads Analytics Types

export interface ThreadsMetrics {
  impressions: number;
  reach: number;
  engagementRate: number;
  likes: number;
  comments: number;
  reposts: number;
  quotes: number;
  saves: number;
  followers: number;
  followerGrowth: number;
  profileViews: number;
}

export interface ThreadsPost {
  id: string;
  content: string;
  publishedAt: string;
  metrics: {
    impressions: number;
    reach: number;
    engagementRate: number;
    likes: number;
    comments: number;
    reposts: number;
    quotes: number;
    saves: number;
  };
  mediaType: 'text' | 'image' | 'video' | 'carousel';
  mediaUrls?: string[];
}

export interface DailyAnalytics {
  date: string;
  metrics: ThreadsMetrics;
  posts: ThreadsPost[];
}

export interface WeeklyTrend {
  week: string;
  startDate: string;
  endDate: string;
  metrics: ThreadsMetrics;
  growth: {
    impressions: number;
    engagementRate: number;
    followers: number;
  };
}

export interface TimeSlotPerformance {
  hour: number;
  dayOfWeek: number;
  avgEngagementRate: number;
  avgImpressions: number;
  postCount: number;
}

export interface ContentTypeAnalysis {
  type: 'educational' | 'personal' | 'question' | 'announcement' | 'thread' | 'other';
  avgEngagementRate: number;
  avgImpressions: number;
  totalPosts: number;
  topPerformer: ThreadsPost | null;
}

export interface PostAnalysisInsight {
  postId: string;
  performanceScore: number;
  aboveAverage: boolean;
  successFactors: string[];
  improvements: string[];
}

export interface AnalyticsDashboardData {
  summary: {
    currentPeriod: ThreadsMetrics;
    previousPeriod: ThreadsMetrics;
    changeRates: {
      impressions: number;
      reach: number;
      engagementRate: number;
      followers: number;
    };
  };
  dailyData: DailyAnalytics[];
  weeklyTrends: WeeklyTrend[];
  timeSlotPerformance: TimeSlotPerformance[];
  contentAnalysis: ContentTypeAnalysis[];
  topPosts: ThreadsPost[];
  insights: {
    bestPostingTimes: { dayOfWeek: string; hour: string }[];
    topContentTypes: string[];
    recommendations: string[];
  };
}

export interface DateRange {
  startDate: string;
  endDate: string;
}
