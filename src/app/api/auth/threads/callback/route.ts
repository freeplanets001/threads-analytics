import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { exchangeCodeForToken, exchangeForLongLivedToken } from '@/lib/threads/auth';
import { ThreadsAPIClient } from '@/lib/threads/client';
import { auth } from '@/lib/auth';
import { prisma, isDatabaseAvailable } from '@/lib/db';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const code = searchParams.get('code');
  const state = searchParams.get('state');
  const error = searchParams.get('error');
  const errorDescription = searchParams.get('error_description');
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || '';

  if (error) {
    return NextResponse.redirect(
      `${appUrl}/?threads_error=${encodeURIComponent(errorDescription || error)}`
    );
  }

  if (!code) {
    return NextResponse.redirect(`${appUrl}/?threads_error=missing_code`);
  }

  // CSRF 検証
  const cookieStore = await cookies();
  const savedState = cookieStore.get('threads_oauth_state')?.value;
  if (!savedState || savedState !== state) {
    return NextResponse.redirect(`${appUrl}/?threads_error=invalid_state`);
  }

  // ログインユーザー必須（DBにアカウントを紐づけるため）
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.redirect(`${appUrl}/login?next=${encodeURIComponent('/')}&threads_error=not_signed_in`);
  }

  try {
    const redirectUri = `${appUrl}/api/auth/threads/callback`;

    // 認可コード→短期トークン→長期トークン
    const tokenResponse = await exchangeCodeForToken(code, redirectUri);
    const longLivedToken = await exchangeForLongLivedToken(tokenResponse.access_token);
    const expiresAt = new Date(Date.now() + longLivedToken.expires_in * 1000);

    // プロフィール取得（DBに保存する username/name/profilePicture を得るため）
    const profile = await new ThreadsAPIClient(longLivedToken.access_token).getMe();

    // DB に upsert（NextAuthのuserIdに紐づけ）
    if (isDatabaseAvailable() && prisma) {
      const existing = await prisma.threadsAccount.findUnique({
        where: { threadsUserId: profile.id },
      });

      if (existing && existing.userId !== session.user.id) {
        // 別ユーザーがすでに紐づけているThreadsアカウントは奪わない
        return NextResponse.redirect(
          `${appUrl}/?threads_error=${encodeURIComponent('このThreadsアカウントは別の利用者に紐づいています')}`
        );
      }

      await prisma.threadsAccount.upsert({
        where: { threadsUserId: profile.id },
        create: {
          userId: session.user.id,
          threadsUserId: profile.id,
          username: profile.username,
          name: profile.name ?? null,
          profilePicture: profile.threads_profile_picture_url ?? null,
          accessToken: longLivedToken.access_token,
          tokenExpiresAt: expiresAt,
        },
        update: {
          username: profile.username,
          name: profile.name ?? null,
          profilePicture: profile.threads_profile_picture_url ?? null,
          accessToken: longLivedToken.access_token,
          tokenExpiresAt: expiresAt,
        },
      });
    }

    // ダッシュボードへ。クッキーは互換性のため残す
    const response = NextResponse.redirect(`${appUrl}/?threads_connected=1`);
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
    response.cookies.delete('threads_oauth_state');

    return response;
  } catch (err) {
    console.error('Threads OAuth callback error:', err);
    const message = err instanceof Error ? err.message : 'auth_failed';
    return NextResponse.redirect(
      `${appUrl}/?threads_error=${encodeURIComponent(message)}`
    );
  }
}
