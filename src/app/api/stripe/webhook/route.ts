import { NextRequest, NextResponse } from 'next/server';
import { getStripe, getPlanRole } from '@/lib/stripe/config';
import { prisma } from '@/lib/db';
import Stripe from 'stripe';

// Webhook署名検証用のシークレット
const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET || '';

export async function POST(request: NextRequest) {
  const body = await request.text();
  const sig = request.headers.get('stripe-signature');

  if (!sig) {
    return NextResponse.json(
      { error: 'Missing signature' },
      { status: 400 }
    );
  }

  let event: Stripe.Event;

  try {
    event = getStripe().webhooks.constructEvent(body, sig, webhookSecret);
  } catch (err) {
    console.error('Webhook signature verification failed:', err);
    return NextResponse.json(
      { error: 'Invalid signature' },
      { status: 400 }
    );
  }

  try {
    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object as Stripe.Checkout.Session;
        await handleCheckoutCompleted(session);
        break;
      }

      case 'customer.subscription.created':
      case 'customer.subscription.updated': {
        const subscription = event.data.object as Stripe.Subscription;
        await handleSubscriptionUpdated(subscription);
        break;
      }

      case 'customer.subscription.deleted': {
        const subscription = event.data.object as Stripe.Subscription;
        await handleSubscriptionDeleted(subscription);
        break;
      }

      case 'invoice.payment_succeeded': {
        const invoice = event.data.object as Stripe.Invoice;
        await handlePaymentSucceeded(invoice);
        break;
      }

      case 'invoice.payment_failed': {
        const invoice = event.data.object as Stripe.Invoice;
        await handlePaymentFailed(invoice);
        break;
      }

      default:
        console.log(`Unhandled event type: ${event.type}`);
    }

    return NextResponse.json({ received: true });
  } catch (err) {
    console.error('Webhook handler error:', err);
    return NextResponse.json(
      { error: 'Webhook handler failed' },
      { status: 500 }
    );
  }
}

// チェックアウト完了時の処理
async function handleCheckoutCompleted(session: Stripe.Checkout.Session) {
  const userId = session.metadata?.userId;
  const plan = session.metadata?.plan;

  if (!userId || !plan || !prisma) return;

  const subscriptionId = session.subscription as string;

  // サブスクリプション情報を取得
  const subscription = await getStripe().subscriptions.retrieve(subscriptionId);
  const subscriptionData = subscription as unknown as {
    current_period_end: number;
    items: { data: Array<{ price: { id: string } }> };
  };

  // ユーザー情報を更新
  await prisma.user.update({
    where: { id: userId },
    data: {
      plan: plan,
      stripeSubscriptionId: subscriptionId,
      stripePriceId: subscriptionData.items.data[0]?.price.id,
      planExpiresAt: new Date(subscriptionData.current_period_end * 1000),
      role: getPlanRole(plan as 'standard' | 'pro'),
    },
  });

  console.log(`User ${userId} subscribed to ${plan} plan`);
}

// サブスクリプション更新時の処理
async function handleSubscriptionUpdated(subscription: Stripe.Subscription) {
  if (!prisma) return;

  const customerId = subscription.customer as string;
  const subscriptionData = subscription as unknown as {
    id: string;
    status: string;
    current_period_end: number;
    items: { data: Array<{ price: { id: string } }> };
  };

  // カスタマーIDからユーザーを検索
  const user = await prisma.user.findFirst({
    where: { stripeCustomerId: customerId },
  });

  if (!user) {
    console.error('User not found for customer:', customerId);
    return;
  }

  // プラン情報を取得
  const priceId = subscriptionData.items.data[0]?.price.id;
  let plan = 'free';

  if (priceId === process.env.STRIPE_PRO_PRICE_ID) {
    plan = 'pro';
  } else if (priceId === process.env.STRIPE_STANDARD_PRICE_ID) {
    plan = 'standard';
  }

  // ステータスに応じて更新
  if (subscriptionData.status === 'active' || subscriptionData.status === 'trialing') {
    await prisma.user.update({
      where: { id: user.id },
      data: {
        plan: plan,
        stripeSubscriptionId: subscriptionData.id,
        stripePriceId: priceId,
        planExpiresAt: new Date(subscriptionData.current_period_end * 1000),
        role: getPlanRole(plan as 'standard' | 'pro' | 'free'),
      },
    });
  } else {
    // キャンセルや一時停止の場合
    await prisma.user.update({
      where: { id: user.id },
      data: {
        plan: 'free',
        role: 'STANDARD',
      },
    });
  }

  console.log(`Subscription updated for user ${user.id}: ${plan}`);
}

// サブスクリプション削除時の処理
async function handleSubscriptionDeleted(subscription: Stripe.Subscription) {
  if (!prisma) return;

  const customerId = subscription.customer as string;

  const user = await prisma.user.findFirst({
    where: { stripeCustomerId: customerId },
  });

  if (!user) return;

  // Freeプランに戻す
  await prisma.user.update({
    where: { id: user.id },
    data: {
      plan: 'free',
      stripeSubscriptionId: null,
      stripePriceId: null,
      planExpiresAt: null,
      role: 'STANDARD',
    },
  });

  console.log(`Subscription canceled for user ${user.id}`);
}

// 支払い成功時の処理
async function handlePaymentSucceeded(invoice: Stripe.Invoice) {
  if (!prisma) return;

  const customerId = invoice.customer as string;
  const invoiceData = invoice as unknown as { subscription: string | null };
  const subscriptionId = invoiceData.subscription;

  if (!subscriptionId) return;

  const user = await prisma.user.findFirst({
    where: { stripeCustomerId: customerId },
  });

  if (!user) return;

  // サブスクリプション情報を取得して期限を更新
  const subscription = await getStripe().subscriptions.retrieve(subscriptionId);
  const subscriptionData = subscription as unknown as { current_period_end: number };

  await prisma.user.update({
    where: { id: user.id },
    data: {
      planExpiresAt: new Date(subscriptionData.current_period_end * 1000),
    },
  });

  console.log(`Payment succeeded for user ${user.id}`);
}

// 支払い失敗時の処理
async function handlePaymentFailed(invoice: Stripe.Invoice) {
  if (!prisma) return;

  const customerId = invoice.customer as string;

  const user = await prisma.user.findFirst({
    where: { stripeCustomerId: customerId },
  });

  if (!user) return;

  // TODO: ユーザーに通知を送る
  console.log(`Payment failed for user ${user.id}`);
}
