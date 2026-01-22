import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { exchangeCodeForToken, exchangeForLongLivedToken } from '@/lib/threads/auth';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const code = searchParams.get('code');
  const state = searchParams.get('state');
  const error = searchParams.get('error');
  const errorDescription = searchParams.get('error_description');

  // エラーチェック
  if (error) {
    return NextResponse.redirect(
      `${process.env.NEXT_PUBLIC_APP_URL}/analytics?error=${encodeURIComponent(errorDescription || error)}`
    );
  }

  if (!code) {
    return NextResponse.redirect(
      `${process.env.NEXT_PUBLIC_APP_URL}/analytics?error=missing_code`
    );
  }

  // CSRF検証
  const cookieStore = await cookies();
  const savedState = cookieStore.get('threads_oauth_state')?.value;

  if (!savedState || savedState !== state) {
    return NextResponse.redirect(
      `${process.env.NEXT_PUBLIC_APP_URL}/analytics?error=invalid_state`
    );
  }

  try {
    const redirectUri = `${process.env.NEXT_PUBLIC_APP_URL}/api/auth/threads/callback`;

    // 認証コードをアクセストークンに交換
    const tokenResponse = await exchangeCodeForToken(code, redirectUri);

    // 長期トークンに交換
    const longLivedToken = await exchangeForLongLivedToken(tokenResponse.access_token);

    // トークンをcookieに保存（本番環境では暗号化推奨）
    const response = NextResponse.redirect(`${process.env.NEXT_PUBLIC_APP_URL}/analytics?connected=true`);

    response.cookies.set('threads_access_token', longLivedToken.access_token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: longLivedToken.expires_in,
    });

    response.cookies.set('threads_user_id', tokenResponse.user_id, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: longLivedToken.expires_in,
    });

    // stateクッキーを削除
    response.cookies.delete('threads_oauth_state');

    return response;
  } catch (err) {
    console.error('Threads OAuth error:', err);
    return NextResponse.redirect(
      `${process.env.NEXT_PUBLIC_APP_URL}/analytics?error=auth_failed`
    );
  }
}
