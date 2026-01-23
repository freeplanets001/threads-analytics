import Stripe from 'stripe';

// Stripe サーバーサイドクライアント（遅延初期化）
let stripeInstance: Stripe | null = null;

export function getStripe(): Stripe {
  if (!stripeInstance) {
    const secretKey = process.env.STRIPE_SECRET_KEY;
    if (!secretKey) {
      throw new Error('STRIPE_SECRET_KEY is not configured');
    }
    stripeInstance = new Stripe(secretKey, {
      typescript: true,
    });
  }
  return stripeInstance;
}

// プラン設定
export const PLANS = {
  free: {
    name: 'Free',
    description: '基本機能のみ',
    price: 0,
    priceId: null,
    features: [
      '1アカウントまで',
      '基本分析機能',
      '投稿作成',
      '5件の下書き',
    ],
    limits: {
      maxAccounts: 1,
      scheduledPosts: false,
      recurringPosts: false,
      maxDrafts: 5,
      maxTemplates: 0,
      aiGenerationsPerDay: 10,
      exportData: false,
      advancedAnalytics: false,
      weeklyReports: false,
      monthlyReports: false,
    },
  },
  standard: {
    name: 'Standard',
    description: '個人利用に最適',
    price: 480,
    priceId: process.env.STRIPE_STANDARD_PRICE_ID || '',
    features: [
      '3アカウントまで',
      '予約投稿（月20件）',
      '無制限の下書き',
      '10件のテンプレート',
      'AIアシスト（1日30回）',
      '週次レポート',
      'データエクスポート',
    ],
    limits: {
      maxAccounts: 3,
      scheduledPosts: true,
      maxScheduledPosts: 20,
      recurringPosts: false,
      maxDrafts: -1, // unlimited
      maxTemplates: 10,
      aiGenerationsPerDay: 30,
      exportData: true,
      advancedAnalytics: true,
      weeklyReports: true,
      monthlyReports: false,
    },
  },
  pro: {
    name: 'Pro',
    description: 'ビジネス・チーム向け',
    price: 1480,
    priceId: process.env.STRIPE_PRO_PRICE_ID || '',
    features: [
      '10アカウントまで',
      '無制限の予約投稿',
      '定期投稿',
      '自動リプライ',
      '無制限のテンプレート',
      'AIアシスト（1日100回）',
      '週次・月次レポート',
      '高度な分析機能',
      '優先サポート',
    ],
    limits: {
      maxAccounts: 10,
      scheduledPosts: true,
      maxScheduledPosts: -1, // unlimited
      recurringPosts: true,
      autoReply: true,
      maxDrafts: -1, // unlimited
      maxTemplates: -1, // unlimited
      aiGenerationsPerDay: 100,
      exportData: true,
      advancedAnalytics: true,
      weeklyReports: true,
      monthlyReports: true,
    },
  },
} as const;

export type PlanType = keyof typeof PLANS;

// プランからロールへのマッピング
export function getPlanRole(plan: PlanType): 'ADMIN' | 'PRO' | 'STANDARD' {
  switch (plan) {
    case 'pro':
      return 'PRO';
    case 'standard':
    case 'free':
    default:
      return 'STANDARD';
  }
}

// プランの有効性チェック
export function isPlanActive(planExpiresAt: Date | null | undefined): boolean {
  if (!planExpiresAt) return false;
  return new Date(planExpiresAt) > new Date();
}

// 現在有効なプランを取得
export function getActivePlan(
  plan: string | null | undefined,
  planExpiresAt: Date | null | undefined
): PlanType {
  if (!plan || plan === 'free') return 'free';
  if (!isPlanActive(planExpiresAt)) return 'free';
  if (plan in PLANS) return plan as PlanType;
  return 'free';
}
