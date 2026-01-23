'use client';

import { useState, useEffect } from 'react';
import { Account, TokenStatus, getTokenStatus, getDaysUntilExpiry } from '@/hooks/useAccountManager';

interface AccountManagerModalProps {
  accounts: Account[];
  currentAccount: Account | null;
  onClose: () => void;
  onSwitchAccount: (accountId: string) => void;
  onAddAccount: (token: string, options?: {
    appId?: string;
    appSecret?: string;
    tokenExpiresAt?: string;
  }) => Promise<{ success: boolean; error?: string; account?: Account }>;
  onUpdateAccount: (accountId: string, updates: Partial<Account>) => boolean;
  onRemoveAccount: (accountId: string) => void;
}

type ModalTab = 'accounts' | 'add' | 'settings';

export function AccountManagerModal({
  accounts,
  currentAccount,
  onClose,
  onSwitchAccount,
  onAddAccount,
  onUpdateAccount,
  onRemoveAccount,
}: AccountManagerModalProps) {
  const [activeTab, setActiveTab] = useState<ModalTab>('accounts');
  const [error, setError] = useState<string | null>(null);

  // アカウント追加用
  const [newToken, setNewToken] = useState('');
  const [newAppId, setNewAppId] = useState('');
  const [newAppSecret, setNewAppSecret] = useState('');
  const [addingAccount, setAddingAccount] = useState(false);

  // トークン変換用
  const [shortToken, setShortToken] = useState('');
  const [convertedToken, setConvertedToken] = useState('');
  const [converting, setConverting] = useState(false);
  const [convertError, setConvertError] = useState<string | null>(null);
  const [tokenExpiresIn, setTokenExpiresIn] = useState<number | null>(null);
  const [selectedAppSecretForConvert, setSelectedAppSecretForConvert] = useState('');

  // 設定編集用
  const [editingAccountId, setEditingAccountId] = useState<string | null>(null);
  const [editAppId, setEditAppId] = useState('');
  const [editAppSecret, setEditAppSecret] = useState('');

  // 既存のApp Secretを選択肢として取得
  const availableAppSecrets = accounts
    .filter(a => a.appSecret)
    .map(a => ({ id: a.id, username: a.username, appId: a.appId, appSecret: a.appSecret! }));

  // トークン変換
  const handleConvertToken = async () => {
    if (!shortToken.trim()) return;
    setConverting(true);
    setConvertError(null);
    setConvertedToken('');
    setTokenExpiresIn(null);

    try {
      // 選択されたApp Secretを使用、なければ新規入力のものを使用
      const appSecretToUse = selectedAppSecretForConvert || newAppSecret;

      if (!appSecretToUse) {
        setConvertError('App Secretを入力または選択してください。\n「Meta App設定」セクションでApp Secretを入力するか、既存のアカウントのApp Secretを選択してください。');
        setConverting(false);
        return;
      }

      const res = await fetch('/api/threads/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          shortLivedToken: shortToken.trim(),
          appSecret: appSecretToUse,
        }),
      });
      const data = await res.json();

      if (!res.ok || !data.success) {
        const errorMsg = data.error || '変換に失敗しました';
        const hint = data.hint ? `\n${data.hint}` : '';
        setConvertError(errorMsg + hint);
      } else {
        setConvertedToken(data.accessToken);
        setTokenExpiresIn(data.expiresIn);
      }
    } catch {
      setConvertError('通信エラーが発生しました');
    } finally {
      setConverting(false);
    }
  };

  // トークンリフレッシュ
  const handleRefreshToken = async (account: Account) => {
    if (!account.accessToken) return;

    try {
      const res = await fetch('/api/threads/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          shortLivedToken: account.accessToken,
          action: 'refresh',
        }),
      });
      const data = await res.json();

      if (!res.ok || !data.success) {
        setError(`トークンのリフレッシュに失敗しました: ${data.error || '不明なエラー'}`);
      } else {
        // トークンと有効期限を更新
        const expiresAt = new Date(Date.now() + data.expiresIn * 1000).toISOString();
        onUpdateAccount(account.id, {
          accessToken: data.accessToken,
          tokenExpiresAt: expiresAt,
        });
        setError(null);
        alert('トークンをリフレッシュしました');
      }
    } catch {
      setError('通信エラーが発生しました');
    }
  };

  // アカウント追加
  const handleAddAccount = async () => {
    if (!newToken.trim()) return;
    setAddingAccount(true);
    setError(null);

    // トークン有効期限を計算（トークン変換で取得した場合）
    let tokenExpiresAt: string | undefined;
    if (tokenExpiresIn) {
      tokenExpiresAt = new Date(Date.now() + tokenExpiresIn * 1000).toISOString();
    }

    const result = await onAddAccount(newToken.trim(), {
      appId: newAppId.trim() || undefined,
      appSecret: newAppSecret.trim() || selectedAppSecretForConvert || undefined,
      tokenExpiresAt,
    });

    setAddingAccount(false);

    if (result.success) {
      setNewToken('');
      setNewAppId('');
      setNewAppSecret('');
      setConvertedToken('');
      setShortToken('');
      setTokenExpiresIn(null);
      setActiveTab('accounts');
    } else {
      setError(result.error || 'アカウントの追加に失敗しました');
    }
  };

  // App設定を編集
  const startEditingAccount = (account: Account) => {
    setEditingAccountId(account.id);
    setEditAppId(account.appId || '');
    setEditAppSecret(account.appSecret || '');
  };

  const saveAccountSettings = () => {
    if (!editingAccountId) return;
    onUpdateAccount(editingAccountId, {
      appId: editAppId.trim() || undefined,
      appSecret: editAppSecret.trim() || undefined,
    });
    setEditingAccountId(null);
    setEditAppId('');
    setEditAppSecret('');
  };

  // トークン状態のバッジ
  const TokenStatusBadge = ({ status, daysLeft }: { status: TokenStatus; daysLeft: number | null }) => {
    const config = {
      valid: { bg: 'bg-emerald-100', text: 'text-emerald-700', label: daysLeft !== null ? `${daysLeft}日` : '有効' },
      expiring_soon: { bg: 'bg-amber-100', text: 'text-amber-700', label: `残り${daysLeft}日` },
      expired: { bg: 'bg-red-100', text: 'text-red-700', label: '期限切れ' },
      unknown: { bg: 'bg-slate-100', text: 'text-slate-500', label: '不明' },
    };
    const { bg, text, label } = config[status];

    return (
      <span className={`px-2 py-0.5 text-xs font-medium rounded-full ${bg} ${text}`}>
        {label}
      </span>
    );
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl max-w-lg w-full max-h-[85vh] overflow-hidden flex flex-col">
        {/* ヘッダー */}
        <div className="p-4 border-b border-slate-200">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-lg font-bold text-slate-900">アカウント管理</h2>
            <button
              onClick={onClose}
              className="text-slate-400 hover:text-slate-600 text-xl leading-none"
            >
              ×
            </button>
          </div>

          {/* タブ */}
          <div className="flex gap-1">
            {[
              { id: 'accounts', label: 'アカウント一覧' },
              { id: 'add', label: '追加' },
              { id: 'settings', label: '設定' },
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as ModalTab)}
                className={`px-3 py-1.5 text-sm font-medium rounded-lg transition-colors ${
                  activeTab === tab.id
                    ? 'bg-violet-100 text-violet-700'
                    : 'text-slate-600 hover:bg-slate-100'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        {/* コンテンツ */}
        <div className="flex-1 overflow-y-auto p-4">
          {error && (
            <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg">
              <p className="text-sm text-red-700">{error}</p>
            </div>
          )}

          {/* アカウント一覧タブ */}
          {activeTab === 'accounts' && (
            <div className="space-y-3">
              {accounts.length === 0 ? (
                <p className="text-slate-500 text-sm text-center py-8">
                  アカウントがありません。「追加」タブから追加してください。
                </p>
              ) : (
                accounts.map((account) => {
                  const tokenStatus = getTokenStatus(account.tokenExpiresAt);
                  const daysLeft = getDaysUntilExpiry(account.tokenExpiresAt);
                  const isEditing = editingAccountId === account.id;

                  return (
                    <div
                      key={account.id}
                      className={`p-3 rounded-xl border transition-colors ${
                        currentAccount?.id === account.id
                          ? 'border-violet-300 bg-violet-50'
                          : 'border-slate-200 hover:bg-slate-50'
                      }`}
                    >
                      <div className="flex items-start justify-between">
                        <button
                          onClick={() => {
                            onSwitchAccount(account.id);
                            onClose();
                          }}
                          className="flex items-center gap-3 flex-1 text-left"
                        >
                          <span className="w-10 h-10 rounded-full bg-violet-200 flex items-center justify-center text-lg font-bold text-violet-700 shrink-0">
                            {account.username[0].toUpperCase()}
                          </span>
                          <div className="min-w-0">
                            <p className="font-medium text-slate-900 truncate">@{account.username}</p>
                            {account.name && (
                              <p className="text-sm text-slate-500 truncate">{account.name}</p>
                            )}
                            <div className="flex items-center gap-2 mt-1">
                              <TokenStatusBadge status={tokenStatus} daysLeft={daysLeft} />
                              {account.appSecret && (
                                <span className="text-xs text-slate-400">App設定済</span>
                              )}
                            </div>
                          </div>
                        </button>

                        <div className="flex items-center gap-1">
                          {(tokenStatus === 'expiring_soon' || tokenStatus === 'valid') && (
                            <button
                              onClick={() => handleRefreshToken(account)}
                              className="p-1.5 text-cyan-600 hover:bg-cyan-50 rounded-lg transition-colors"
                              title="トークンをリフレッシュ"
                            >
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                              </svg>
                            </button>
                          )}
                          <button
                            onClick={() => startEditingAccount(account)}
                            className="p-1.5 text-slate-400 hover:text-violet-600 hover:bg-violet-50 rounded-lg transition-colors"
                            title="設定を編集"
                          >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                            </svg>
                          </button>
                          <button
                            onClick={() => {
                              if (confirm(`@${account.username}を削除しますか？`)) {
                                onRemoveAccount(account.id);
                              }
                            }}
                            className="p-1.5 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                            title="削除"
                          >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                            </svg>
                          </button>
                        </div>
                      </div>

                      {/* 編集モード */}
                      {isEditing && (
                        <div className="mt-3 pt-3 border-t border-slate-200 space-y-2">
                          <div>
                            <label className="block text-xs font-medium text-slate-600 mb-1">
                              App ID
                            </label>
                            <input
                              type="text"
                              value={editAppId}
                              onChange={(e) => setEditAppId(e.target.value)}
                              placeholder="オプション"
                              className="w-full px-3 py-1.5 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-violet-500"
                            />
                          </div>
                          <div>
                            <label className="block text-xs font-medium text-slate-600 mb-1">
                              App Secret
                            </label>
                            <input
                              type="password"
                              value={editAppSecret}
                              onChange={(e) => setEditAppSecret(e.target.value)}
                              placeholder="トークン変換に必要"
                              className="w-full px-3 py-1.5 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-violet-500"
                            />
                          </div>
                          <div className="flex gap-2">
                            <button
                              onClick={saveAccountSettings}
                              className="flex-1 py-1.5 bg-violet-600 text-white text-sm font-medium rounded-lg hover:bg-violet-700"
                            >
                              保存
                            </button>
                            <button
                              onClick={() => setEditingAccountId(null)}
                              className="px-3 py-1.5 text-sm text-slate-600 hover:bg-slate-100 rounded-lg"
                            >
                              キャンセル
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })
              )}
            </div>
          )}

          {/* アカウント追加タブ */}
          {activeTab === 'add' && (
            <div className="space-y-4">
              {/* Meta App設定 */}
              <div className="p-3 bg-slate-50 rounded-xl">
                <h3 className="text-sm font-semibold text-slate-700 mb-2">Meta App設定（推奨）</h3>
                <p className="text-xs text-slate-500 mb-3">
                  トークン変換に必要です。各アカウントで異なるMeta Appを使用している場合は、それぞれのApp Secretを設定してください。
                </p>
                <div className="space-y-2">
                  <div>
                    <label className="block text-xs font-medium text-slate-600 mb-1">
                      App ID（オプション）
                    </label>
                    <input
                      type="text"
                      value={newAppId}
                      onChange={(e) => setNewAppId(e.target.value)}
                      placeholder="123456789..."
                      className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-violet-500"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-600 mb-1">
                      App Secret
                    </label>
                    <input
                      type="password"
                      value={newAppSecret}
                      onChange={(e) => {
                        setNewAppSecret(e.target.value);
                        if (e.target.value) setSelectedAppSecretForConvert('');
                      }}
                      placeholder="abc123..."
                      className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-violet-500"
                    />
                  </div>
                  {availableAppSecrets.length > 0 && !newAppSecret && (
                    <div>
                      <label className="block text-xs font-medium text-slate-600 mb-1">
                        または既存のApp Secretを使用
                      </label>
                      <select
                        value={selectedAppSecretForConvert}
                        onChange={(e) => setSelectedAppSecretForConvert(e.target.value)}
                        className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-violet-500"
                      >
                        <option value="">選択してください</option>
                        {availableAppSecrets.map((a) => (
                          <option key={a.id} value={a.appSecret}>
                            @{a.username}のApp Secret
                          </option>
                        ))}
                      </select>
                    </div>
                  )}
                </div>
              </div>

              {/* トークン変換ツール */}
              <div className="p-3 bg-cyan-50 rounded-xl">
                <h3 className="text-sm font-semibold text-cyan-700 mb-2">トークン変換ツール</h3>
                <p className="text-xs text-cyan-600 mb-3">
                  Graph API Explorerから取得した短期トークンを長期トークンに変換します。
                </p>
                <div className="space-y-2">
                  <textarea
                    value={shortToken}
                    onChange={(e) => setShortToken(e.target.value)}
                    placeholder="短期トークンを貼り付け..."
                    className="w-full px-3 py-2 text-sm border border-cyan-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-cyan-500 h-20 resize-none bg-white"
                  />
                  <div className="flex gap-2">
                    <button
                      onClick={() => {
                        if (shortToken.trim()) {
                          setNewToken(shortToken.trim());
                          setShortToken('');
                          setConvertError(null);
                        }
                      }}
                      disabled={!shortToken.trim()}
                      className="flex-1 py-2 bg-violet-600 text-white text-sm font-medium rounded-lg hover:bg-violet-700 transition-colors disabled:opacity-50"
                    >
                      直接使用
                    </button>
                    <button
                      onClick={handleConvertToken}
                      disabled={converting || !shortToken.trim()}
                      className="flex-1 py-2 bg-cyan-600 text-white text-sm font-medium rounded-lg hover:bg-cyan-700 transition-colors disabled:opacity-50"
                    >
                      {converting ? '変換中...' : '長期に変換'}
                    </button>
                  </div>

                  <div className="p-2 bg-amber-50 border border-amber-200 rounded-lg">
                    <p className="text-xs text-amber-700">
                      <strong>ヒント:</strong> 変換でエラーが出る場合は「直接使用」をお試しください。
                      Graph API Explorerのトークンは既に長期トークンの場合があります。
                    </p>
                  </div>

                  {convertError && (
                    <div className="p-2 bg-red-50 border border-red-200 rounded-lg">
                      <p className="text-xs text-red-600 whitespace-pre-line">{convertError}</p>
                    </div>
                  )}

                  {convertedToken && (
                    <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-lg">
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-xs font-medium text-emerald-700">長期トークン（約60日間有効）</span>
                        <button
                          onClick={() => navigator.clipboard.writeText(convertedToken)}
                          className="text-xs text-emerald-600 hover:text-emerald-800"
                        >
                          コピー
                        </button>
                      </div>
                      <p className="text-xs text-emerald-800 break-all font-mono bg-emerald-100 p-2 rounded">
                        {convertedToken.substring(0, 50)}...
                      </p>
                      {tokenExpiresIn && (
                        <p className="text-xs text-emerald-600 mt-1">
                          有効期限: {Math.floor(tokenExpiresIn / 86400)}日
                        </p>
                      )}
                      <button
                        onClick={() => {
                          setNewToken(convertedToken);
                          setConvertedToken('');
                          setShortToken('');
                        }}
                        className="mt-2 w-full py-1.5 bg-emerald-600 text-white text-xs font-medium rounded hover:bg-emerald-700"
                      >
                        このトークンを下の入力欄にセット
                      </button>
                    </div>
                  )}
                </div>
              </div>

              {/* アクセストークン入力 */}
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  アクセストークン
                </label>
                <textarea
                  value={newToken}
                  onChange={(e) => setNewToken(e.target.value)}
                  placeholder="THQWxxxxxx..."
                  className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-violet-500 h-20 resize-none"
                />
              </div>

              <button
                onClick={handleAddAccount}
                disabled={addingAccount || !newToken.trim()}
                className="w-full py-3 bg-violet-600 text-white font-semibold rounded-lg hover:bg-violet-700 transition-colors disabled:opacity-50"
              >
                {addingAccount ? '確認中...' : 'アカウントを追加'}
              </button>
            </div>
          )}

          {/* 設定タブ */}
          {activeTab === 'settings' && (
            <div className="space-y-4">
              <div className="p-4 bg-slate-50 rounded-xl">
                <h3 className="text-sm font-semibold text-slate-700 mb-2">トークンについて</h3>
                <div className="text-xs text-slate-600 space-y-2">
                  <p>
                    Threads APIのアクセストークンには有効期限があります。長期トークンは約60日間有効です。
                  </p>
                  <p>
                    期限切れになる前に「リフレッシュ」ボタンでトークンを更新してください。
                    リフレッシュにより、トークンの有効期限が延長されます。
                  </p>
                </div>
              </div>

              <div className="p-4 bg-slate-50 rounded-xl">
                <h3 className="text-sm font-semibold text-slate-700 mb-2">Meta App設定について</h3>
                <div className="text-xs text-slate-600 space-y-2">
                  <p>
                    複数のMeta Appを使用している場合、各アカウントに対応するApp Secretを設定してください。
                  </p>
                  <p>
                    App Secretはトークンの変換・リフレッシュに必要です。Meta for Developersの
                    アプリダッシュボードで確認できます。
                  </p>
                </div>
              </div>

              <div className="p-4 bg-amber-50 rounded-xl border border-amber-200">
                <h3 className="text-sm font-semibold text-amber-700 mb-2">トークン取得手順</h3>
                <ol className="text-xs text-amber-700 space-y-1 list-decimal ml-4">
                  <li>Meta for Developersでアプリを作成</li>
                  <li>Threads APIの権限を追加</li>
                  <li>Graph API Explorerでトークンを生成</li>
                  <li>「追加」タブの変換ツールで長期トークンに変換</li>
                  <li>変換したトークンでアカウントを追加</li>
                </ol>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
