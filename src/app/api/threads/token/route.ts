import { NextRequest, NextResponse } from 'next/server';
import { exchangeForLongLivedToken, refreshLongLivedToken } from '@/lib/threads/auth';

// 短期トークン → 長期トークンに変換
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { shortLivedToken, action } = body;

    if (!shortLivedToken) {
      return NextResponse.json(
        { error: 'Token is required' },
        { status: 400 }
      );
    }

    // THREADS_APP_SECRETが設定されているか確認
    if (!process.env.THREADS_APP_SECRET) {
      return NextResponse.json(
        { error: 'Server configuration error: THREADS_APP_SECRET not set' },
        { status: 500 }
      );
    }

    let result;

    if (action === 'refresh') {
      // 長期トークンのリフレッシュ
      result = await refreshLongLivedToken(shortLivedToken);
    } else {
      // 短期トークン → 長期トークンに変換
      result = await exchangeForLongLivedToken(shortLivedToken);
    }

    return NextResponse.json({
      success: true,
      accessToken: result.access_token,
      tokenType: result.token_type,
      expiresIn: result.expires_in, // 秒数（通常60日 = 5184000秒）
    });
  } catch (err) {
    console.error('Token exchange error:', err);
    const message = err instanceof Error ? err.message : 'Failed to exchange token';
    return NextResponse.json(
      { error: message },
      { status: 500 }
    );
  }
}
