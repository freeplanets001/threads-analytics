import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth/index';
import { getStripe, PLANS, PlanType } from '@/lib/stripe/config';
import { prisma } from '@/lib/db';

// Checkout Session作成
export async function POST(request: NextRequest) {
  try {
    const session = await auth();

    if (!session?.user?.id) {
      return NextResponse.json(
        { error: 'ログインが必要です' },
        { status: 401 }
      );
    }

    const body = await request.json();
    const { plan } = body as { plan: PlanType };

    if (!plan || !PLANS[plan]) {
      return NextResponse.json(
        { error: '無効なプランです' },
        { status: 400 }
      );
    }

    const planConfig = PLANS[plan];

    if (!planConfig.priceId) {
      return NextResponse.json(
        { error: 'このプランは購入できません' },
        { status: 400 }
      );
    }

    // ユーザー情報を取得
    const user = await prisma?.user.findUnique({
      where: { id: session.user.id },
    });

    if (!user) {
      return NextResponse.json(
        { error: 'ユーザーが見つかりません' },
        { status: 404 }
      );
    }

    // Stripe Customerを作成または取得
    let customerId = user.stripeCustomerId;

    if (!customerId) {
      const customer = await getStripe().customers.create({
        email: user.email,
        name: user.name || undefined,
        metadata: {
          userId: user.id,
        },
      });
      customerId = customer.id;

      // DBにCustomer IDを保存
      await prisma?.user.update({
        where: { id: user.id },
        data: { stripeCustomerId: customerId },
      });
    }

    // Checkout Session作成
    const checkoutSession = await getStripe().checkout.sessions.create({
      customer: customerId,
      mode: 'subscription',
      payment_method_types: ['card'],
      line_items: [
        {
          price: planConfig.priceId,
          quantity: 1,
        },
      ],
      success_url: `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/pricing?success=true&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/pricing?canceled=true`,
      subscription_data: {
        metadata: {
          userId: user.id,
          plan: plan,
        },
      },
      allow_promotion_codes: true,
    });

    return NextResponse.json({
      url: checkoutSession.url,
      sessionId: checkoutSession.id,
    });
  } catch (err) {
    console.error('Checkout error:', err);
    return NextResponse.json(
      { error: 'チェックアウトセッションの作成に失敗しました' },
      { status: 500 }
    );
  }
}
