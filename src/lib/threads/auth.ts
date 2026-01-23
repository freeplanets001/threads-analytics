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
  if (!process.env.THREADS_APP_SECRET) {
    throw new Error('THREADS_APP_SECRET is not configured');
  }

  return exchangeForLongLivedTokenWithSecret(shortLivedToken, process.env.THREADS_APP_SECRET);
}

// 短期トークンを長期トークンに交換（App Secretを引数で受け取る）
export async function exchangeForLongLivedTokenWithSecret(
  shortLivedToken: string,
  appSecret: string
): Promise<ThreadsLongLivedTokenResponse> {
  if (!appSecret) {
    throw new Error('App Secretが必要です');
  }

  const params = new URLSearchParams({
    grant_type: 'th_exchange_token',
    client_secret: appSecret,
    access_token: shortLivedToken,
  });

  const response = await fetch(`${THREADS_LONG_LIVED_TOKEN_URL}?${params.toString()}`);
  const responseText = await response.text();

  let data;
  try {
    data = JSON.parse(responseText);
  } catch {
    throw new Error(`Invalid API response: ${responseText.substring(0, 200)}`);
  }

  if (!response.ok) {
    // 詳細なエラー情報を構築
    const errorCode = data.error?.code || data.error_code || '';
    const errorType = data.error?.type || data.error_type || '';
    const errorMessage = data.error?.message || data.error_message || 'Unknown error';

    // よくあるエラーに対する日本語の説明
    let hint = '';
    if (errorMessage.includes('Invalid OAuth access token') || errorMessage.includes('expired')) {
      hint = 'トークンが無効または期限切れです。';
    } else if (errorMessage.includes('already been used')) {
      hint = 'このトークンは既に使用されています。新しいトークンを取得してください。';
    } else if (errorCode === '190') {
      hint = 'トークンが無効です。Graph API Explorerから新しいトークンを取得してください。';
    } else if (errorMessage.includes('Invalid parameter')) {
      hint = 'App Secretが正しくないか、トークンが既に長期トークンの可能性があります。';
    }

    throw new Error(`${errorMessage}${hint ? ` (${hint})` : ''} [${errorType || errorCode || response.status}]`);
  }

  return data;
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
