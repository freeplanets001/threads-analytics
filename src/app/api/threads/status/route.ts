import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { ThreadsAPIClient } from '@/lib/threads/client';

export async function GET(request: NextRequest) {
  // URLパラメータからトークンを取得（アカウント追加時の検証用）
  const tokenParam = request.nextUrl.searchParams.get('token');

  const cookieStore = await cookies();
  const cookieToken = cookieStore.get('threads_access_token')?.value;
  const userId = cookieStore.get('threads_user_id')?.value;

  // 優先順位: URLパラメータ > cookie > 環境変数
  const accessToken = tokenParam || cookieToken || process.env.THREADS_ACCESS_TOKEN;

  if (!accessToken) {
    return NextResponse.json({
      connected: false,
      user: null,
    });
  }

  try {
    const client = new ThreadsAPIClient(accessToken);
    const profile = await client.getMe();

    return NextResponse.json({
      connected: true,
      user: {
        id: userId || profile.id,
        username: profile.username,
        name: profile.name,
        profilePicture: profile.threads_profile_picture_url,
      },
    });
  } catch {
    // トークンが無効な場合
    return NextResponse.json({
      connected: false,
      user: null,
      error: 'Token expired or invalid',
    });
  }
}

// ログアウト
export async function DELETE() {
  const response = NextResponse.json({ success: true });

  response.cookies.delete('threads_access_token');
  response.cookies.delete('threads_user_id');

  return response;
}
