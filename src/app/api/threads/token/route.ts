import { NextRequest, NextResponse } from 'next/server';
import { exchangeForLongLivedTokenWithSecret, refreshLongLivedToken } from '@/lib/threads/auth';

// 短期トークン → 長期トークンに変換
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { shortLivedToken, action, appSecret: clientAppSecret } = body;

    if (!shortLivedToken) {
      return NextResponse.json(
        { error: 'Token is required' },
        { status: 400 }
      );
    }

    // クライアントから送られたApp Secretを優先、なければ環境変数を使用
    const appSecret = clientAppSecret || process.env.THREADS_APP_SECRET;

    if (!appSecret) {
      return NextResponse.json(
        {
          error: 'App Secretが設定されていません',
          hint: '設定画面でThreads API設定を行うか、管理者に連絡してください。'
        },
        { status: 400 }
      );
    }

    let result;

    if (action === 'refresh') {
      // 長期トークンのリフレッシュ
      result = await refreshLongLivedToken(shortLivedToken);
    } else {
      // 短期トークン → 長期トークンに変換（App Secretを渡す）
      result = await exchangeForLongLivedTokenWithSecret(shortLivedToken, appSecret);
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

    // より詳細なエラーメッセージを返す
    let userFriendlyMessage = message;
    let hint = '';

    if (message.includes('THREADS_APP_SECRET')) {
      userFriendlyMessage = 'サーバー設定エラー';
      hint = 'THREADS_APP_SECRETが設定されていません。管理者に連絡してください。';
    } else if (message.includes('Invalid') || message.includes('expired')) {
      hint = 'Graph API Explorerで新しいトークンを取得してください。';
    }

    return NextResponse.json(
      {
        error: userFriendlyMessage,
        hint,
        details: process.env.NODE_ENV === 'development' ? message : undefined
      },
      { status: 500 }
    );
  }
}
