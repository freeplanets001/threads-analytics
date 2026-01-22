// Threads OAuth Authentication

const THREADS_AUTH_URL = 'https://threads.net/oauth/authorize';
const THREADS_TOKEN_URL = 'https://graph.threads.net/oauth/access_token';
const THREADS_LONG_LIVED_TOKEN_URL = 'https://graph.threads.net/access_token';

export interface ThreadsTokenResponse {
  access_token: string;
  user_id: string;
}

export interface ThreadsLongLivedTokenResponse {
  access_token: string;
  token_type: string;
  expires_in: number;
}

// 認証URLを生成
export function getAuthorizationUrl(redirectUri: string, state?: string): string {
  const params = new URLSearchParams({
    client_id: process.env.THREADS_APP_ID || '',
    redirect_uri: redirectUri,
    scope: 'threads_basic',
    response_type: 'code',
  });

  if (state) {
    params.set('state', state);
  }

  return `${THREADS_AUTH_URL}?${params.toString()}`;
}

// 認証コードをアクセストークンに交換
export async function exchangeCodeForToken(
  code: string,
  redirectUri: string
): Promise<ThreadsTokenResponse> {
  const response = await fetch(THREADS_TOKEN_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams({
      client_id: process.env.THREADS_APP_ID || '',
      client_secret: process.env.THREADS_APP_SECRET || '',
      grant_type: 'authorization_code',
      redirect_uri: redirectUri,
      code,
    }),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error_message || 'Failed to exchange code for token');
  }

  return response.json();
}

// 短期トークンを長期トークンに交換
export async function exchangeForLongLivedToken(
  shortLivedToken: string
): Promise<ThreadsLongLivedTokenResponse> {
  const params = new URLSearchParams({
    grant_type: 'th_exchange_token',
    client_secret: process.env.THREADS_APP_SECRET || '',
    access_token: shortLivedToken,
  });

  const response = await fetch(`${THREADS_LONG_LIVED_TOKEN_URL}?${params.toString()}`);

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error_message || 'Failed to exchange for long-lived token');
  }

  return response.json();
}

// 長期トークンをリフレッシュ
export async function refreshLongLivedToken(
  token: string
): Promise<ThreadsLongLivedTokenResponse> {
  const params = new URLSearchParams({
    grant_type: 'th_refresh_token',
    access_token: token,
  });

  const response = await fetch(`${THREADS_LONG_LIVED_TOKEN_URL}?${params.toString()}`);

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error_message || 'Failed to refresh token');
  }

  return response.json();
}
