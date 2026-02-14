import { NextResponse } from 'next/server';

// 認証設定の診断エンドポイント（本番デバッグ後に削除）
export async function GET() {
  const checks = {
    GOOGLE_CLIENT_ID: !!process.env.GOOGLE_CLIENT_ID,
    GOOGLE_CLIENT_ID_length: process.env.GOOGLE_CLIENT_ID?.length || 0,
    GOOGLE_CLIENT_ID_prefix: process.env.GOOGLE_CLIENT_ID?.substring(0, 10) || 'NOT_SET',
    GOOGLE_CLIENT_SECRET: !!process.env.GOOGLE_CLIENT_SECRET,
    GOOGLE_CLIENT_SECRET_length: process.env.GOOGLE_CLIENT_SECRET?.length || 0,
    AUTH_SECRET: !!process.env.AUTH_SECRET,
    AUTH_URL: process.env.AUTH_URL || 'NOT_SET',
    AUTH_TRUST_HOST: process.env.AUTH_TRUST_HOST || 'NOT_SET',
    NEXT_PUBLIC_APP_URL: process.env.NEXT_PUBLIC_APP_URL || 'NOT_SET',
    DATABASE_URL: !!process.env.DATABASE_URL,
    DATABASE_URL_prefix: process.env.DATABASE_URL?.substring(0, 30) || 'NOT_SET',
    NODE_ENV: process.env.NODE_ENV,
    VERCEL_URL: process.env.VERCEL_URL || 'NOT_SET',
  };

  // PrismaClient接続テスト
  let dbStatus = 'unknown';
  try {
    const { prisma } = await import('@/lib/db');
    if (prisma) {
      await prisma.$queryRaw`SELECT 1`;
      dbStatus = 'connected';
    } else {
      dbStatus = 'prisma is null';
    }
  } catch (e) {
    dbStatus = `error: ${e instanceof Error ? e.message : String(e)}`;
  }

  return NextResponse.json({
    checks,
    dbStatus,
    timestamp: new Date().toISOString(),
  });
}
