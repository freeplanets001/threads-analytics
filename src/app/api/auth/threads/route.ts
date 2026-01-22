import { NextResponse } from 'next/server';
import { getAuthorizationUrl } from '@/lib/threads/auth';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const redirectUri = searchParams.get('redirect_uri') || `${process.env.NEXT_PUBLIC_APP_URL}/api/auth/threads/callback`;

  // ランダムなstateを生成（CSRF対策）
  const state = crypto.randomUUID();

  const authUrl = getAuthorizationUrl(redirectUri, state);

  // stateをcookieに保存
  const response = NextResponse.redirect(authUrl);
  response.cookies.set('threads_oauth_state', state, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 60 * 10, // 10分
  });

  return response;
}
