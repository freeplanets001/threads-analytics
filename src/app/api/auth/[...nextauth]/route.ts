import { handlers } from '@/lib/auth';
import { NextRequest, NextResponse } from 'next/server';

// エラーキャプチャ用ラッパー
async function wrappedGET(req: NextRequest) {
  try {
    return await handlers.GET(req);
  } catch (error) {
    console.error('[NextAuth GET] Unhandled error:', error);
    console.error('[NextAuth GET] Error name:', (error as Error)?.name);
    console.error('[NextAuth GET] Error message:', (error as Error)?.message);
    console.error('[NextAuth GET] Error stack:', (error as Error)?.stack);
    // エラー詳細をレスポンスヘッダーに含めてリダイレクト
    const url = new URL('/login', req.url);
    url.searchParams.set('error', 'Configuration');
    url.searchParams.set('detail', (error as Error)?.message?.substring(0, 200) || 'unknown');
    return NextResponse.redirect(url);
  }
}

async function wrappedPOST(req: NextRequest) {
  try {
    return await handlers.POST(req);
  } catch (error) {
    console.error('[NextAuth POST] Unhandled error:', error);
    console.error('[NextAuth POST] Error name:', (error as Error)?.name);
    console.error('[NextAuth POST] Error message:', (error as Error)?.message);
    console.error('[NextAuth POST] Error stack:', (error as Error)?.stack);
    const url = new URL('/login', req.url);
    url.searchParams.set('error', 'Configuration');
    url.searchParams.set('detail', (error as Error)?.message?.substring(0, 200) || 'unknown');
    return NextResponse.redirect(url);
  }
}

export { wrappedGET as GET, wrappedPOST as POST };
