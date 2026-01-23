'use client';

import { useState, useEffect, Suspense } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';

// プラン設定（サーバーと同じ）
const PLANS = {
  free: {
    name: 'Free',
    description: '基本機能のみ',
    price: 0,
    features: [
      '1アカウントまで',
      '基本分析機能',
      '投稿作成',
      '5件の下書き',
    ],
  },
  standard: {
    name: 'Standard',
    description: '個人利用に最適',
    price: 480,
    features: [
      '3アカウントまで',
      '予約投稿（月20件）',
      '無制限の下書き',
      '10件のテンプレート',
      'AIアシスト（1日30回）',
      '週次レポート',
      'データエクスポート',
    ],
  },
  pro: {
    name: 'Pro',
    description: 'ビジネス・チーム向け',
    price: 1480,
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
    popular: true,
  },
} as const;

type PlanType = keyof typeof PLANS;

function PricingContent() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [loading, setLoading] = useState<PlanType | null>(null);
  const [error, setError] = useState<string | null>(null);

  // 成功・キャンセルの処理
  const success = searchParams.get('success');
  const canceled = searchParams.get('canceled');

  useEffect(() => {
    if (success === 'true') {
      // セッションを更新
      router.refresh();
    }
  }, [success, router]);

  // セッションから現在のプランを取得（型アサーションを使用）
  const userWithPlan = session?.user as { plan?: string } | undefined;
  const currentPlan = (userWithPlan?.plan || 'free') as PlanType;

  const handleSelectPlan = async (plan: PlanType) => {
    if (plan === 'free') return;

    if (status !== 'authenticated') {
      router.push(`/login?callbackUrl=/pricing`);
      return;
    }

    setLoading(plan);
    setError(null);

    try {
      const res = await fetch('/api/stripe/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ plan }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || 'エラーが発生しました');
        setLoading(null);
        return;
      }

      // Stripe Checkoutにリダイレクト
      if (data.url) {
        window.location.href = data.url;
      }
    } catch {
      setError('通信エラーが発生しました');
      setLoading(null);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-violet-50 to-cyan-50">
      {/* Header */}
      <header className="bg-white/80 backdrop-blur-sm border-b border-slate-200 sticky top-0 z-10">
        <div className="max-w-6xl mx-auto px-4 py-4 flex items-center justify-between">
          <Link href="/" className="text-xl font-bold text-slate-900">
            Threads Studio
          </Link>
          <div className="flex items-center gap-4">
            {session ? (
              <>
                <span className="text-sm text-slate-600">
                  {session.user?.email}
                </span>
                <Link
                  href="/"
                  className="px-4 py-2 text-sm font-medium text-violet-600 hover:text-violet-700"
                >
                  ダッシュボード
                </Link>
              </>
            ) : (
              <Link
                href="/login"
                className="px-4 py-2 text-sm font-medium bg-violet-600 text-white rounded-lg hover:bg-violet-700"
              >
                ログイン
              </Link>
            )}
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 py-12">
        {/* Success/Error Messages */}
        {success === 'true' && (
          <div className="mb-8 p-4 bg-emerald-50 border border-emerald-200 rounded-xl">
            <p className="text-emerald-700 font-medium">
              プランのアップグレードが完了しました！
            </p>
          </div>
        )}

        {canceled === 'true' && (
          <div className="mb-8 p-4 bg-amber-50 border border-amber-200 rounded-xl">
            <p className="text-amber-700">
              購入がキャンセルされました。
            </p>
          </div>
        )}

        {error && (
          <div className="mb-8 p-4 bg-red-50 border border-red-200 rounded-xl">
            <p className="text-red-700">{error}</p>
          </div>
        )}

        {/* Hero */}
        <div className="text-center mb-12">
          <h1 className="text-4xl font-bold text-slate-900 mb-4">
            シンプルな料金プラン
          </h1>
          <p className="text-lg text-slate-600 max-w-2xl mx-auto">
            あなたのニーズに合ったプランを選んでください。
            いつでもアップグレード・ダウングレードが可能です。
          </p>
        </div>

        {/* Pricing Cards */}
        <div className="grid md:grid-cols-3 gap-8 max-w-5xl mx-auto">
          {(Object.entries(PLANS) as [PlanType, typeof PLANS[PlanType]][]).map(([key, plan]) => {
            const isCurrentPlan = currentPlan === key;
            const isPopular = 'popular' in plan && plan.popular;

            return (
              <div
                key={key}
                className={`relative bg-white rounded-2xl shadow-lg overflow-hidden ${
                  isPopular ? 'ring-2 ring-violet-500' : ''
                }`}
              >
                {isPopular && (
                  <div className="absolute top-0 right-0 bg-violet-500 text-white text-xs font-medium px-3 py-1 rounded-bl-lg">
                    おすすめ
                  </div>
                )}

                <div className="p-6">
                  <h3 className="text-xl font-bold text-slate-900">{plan.name}</h3>
                  <p className="text-sm text-slate-500 mt-1">{plan.description}</p>

                  <div className="mt-4 flex items-baseline">
                    <span className="text-4xl font-bold text-slate-900">
                      ¥{plan.price.toLocaleString()}
                    </span>
                    {plan.price > 0 && (
                      <span className="text-slate-500 ml-2">/月</span>
                    )}
                  </div>

                  <ul className="mt-6 space-y-3">
                    {plan.features.map((feature, i) => (
                      <li key={i} className="flex items-start gap-2">
                        <svg
                          className="w-5 h-5 text-emerald-500 shrink-0 mt-0.5"
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M5 13l4 4L19 7"
                          />
                        </svg>
                        <span className="text-sm text-slate-600">{feature}</span>
                      </li>
                    ))}
                  </ul>

                  <button
                    onClick={() => handleSelectPlan(key)}
                    disabled={isCurrentPlan || loading !== null}
                    className={`mt-8 w-full py-3 rounded-xl font-semibold transition-colors ${
                      isCurrentPlan
                        ? 'bg-slate-100 text-slate-500 cursor-not-allowed'
                        : key === 'free'
                        ? 'bg-slate-200 text-slate-700 hover:bg-slate-300'
                        : isPopular
                        ? 'bg-violet-600 text-white hover:bg-violet-700'
                        : 'bg-slate-900 text-white hover:bg-slate-800'
                    } disabled:opacity-50`}
                  >
                    {loading === key ? (
                      <span className="flex items-center justify-center gap-2">
                        <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
                          <circle
                            className="opacity-25"
                            cx="12"
                            cy="12"
                            r="10"
                            stroke="currentColor"
                            strokeWidth="4"
                            fill="none"
                          />
                          <path
                            className="opacity-75"
                            fill="currentColor"
                            d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                          />
                        </svg>
                        処理中...
                      </span>
                    ) : isCurrentPlan ? (
                      '現在のプラン'
                    ) : key === 'free' ? (
                      'Freeプラン'
                    ) : (
                      'このプランを選択'
                    )}
                  </button>
                </div>
              </div>
            );
          })}
        </div>

        {/* FAQ */}
        <div className="mt-16 max-w-3xl mx-auto">
          <h2 className="text-2xl font-bold text-slate-900 text-center mb-8">
            よくある質問
          </h2>
          <div className="space-y-4">
            <div className="bg-white rounded-xl p-6 shadow">
              <h3 className="font-semibold text-slate-900">
                いつでもプランを変更できますか？
              </h3>
              <p className="mt-2 text-slate-600 text-sm">
                はい、いつでもアップグレードまたはダウングレードが可能です。
                アップグレードの場合は即座に新しい機能が利用でき、
                ダウングレードの場合は現在の請求期間終了後に適用されます。
              </p>
            </div>
            <div className="bg-white rounded-xl p-6 shadow">
              <h3 className="font-semibold text-slate-900">
                支払い方法は何がありますか？
              </h3>
              <p className="mt-2 text-slate-600 text-sm">
                クレジットカード（Visa, Mastercard, American Express, JCB）
                でお支払いいただけます。
              </p>
            </div>
            <div className="bg-white rounded-xl p-6 shadow">
              <h3 className="font-semibold text-slate-900">
                返金はできますか？
              </h3>
              <p className="mt-2 text-slate-600 text-sm">
                購入後7日以内であれば、全額返金が可能です。
                サポートまでお問い合わせください。
              </p>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}

function PricingLoading() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-violet-50 to-cyan-50">
      <header className="bg-white/80 backdrop-blur-sm border-b border-slate-200 sticky top-0 z-10">
        <div className="max-w-6xl mx-auto px-4 py-4">
          <div className="h-8 bg-slate-200 rounded w-40 animate-pulse"></div>
        </div>
      </header>
      <main className="max-w-6xl mx-auto px-4 py-12">
        <div className="text-center mb-12">
          <div className="h-10 bg-slate-200 rounded w-64 mx-auto mb-4 animate-pulse"></div>
          <div className="h-6 bg-slate-200 rounded w-96 mx-auto animate-pulse"></div>
        </div>
        <div className="grid md:grid-cols-3 gap-8 max-w-5xl mx-auto">
          {[1, 2, 3].map((i) => (
            <div key={i} className="bg-white rounded-2xl shadow-lg p-6 animate-pulse">
              <div className="h-6 bg-slate-200 rounded w-24 mb-2"></div>
              <div className="h-4 bg-slate-200 rounded w-32 mb-4"></div>
              <div className="h-10 bg-slate-200 rounded w-20 mb-6"></div>
              <div className="space-y-2">
                {[1, 2, 3, 4].map((j) => (
                  <div key={j} className="h-4 bg-slate-200 rounded"></div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </main>
    </div>
  );
}

export default function PricingPage() {
  return (
    <Suspense fallback={<PricingLoading />}>
      <PricingContent />
    </Suspense>
  );
}
