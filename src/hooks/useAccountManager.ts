'use client';

import { useState, useEffect, useCallback } from 'react';

export interface Account {
  id: string;
  username: string;
  name?: string;
  profilePicture?: string;
  accessToken: string;
  addedAt: string;
  // Meta App設定（アカウントごと）
  appId?: string;
  appSecret?: string;
  // トークン有効期限
  tokenExpiresAt?: string; // ISO 8601形式
}

// トークンの状態を判定するユーティリティ
export type TokenStatus = 'valid' | 'expiring_soon' | 'expired' | 'unknown';

export function getTokenStatus(expiresAt?: string): TokenStatus {
  if (!expiresAt) return 'unknown';

  const now = new Date();
  const expiry = new Date(expiresAt);
  const daysUntilExpiry = (expiry.getTime() - now.getTime()) / (1000 * 60 * 60 * 24);

  if (daysUntilExpiry < 0) return 'expired';
  if (daysUntilExpiry < 7) return 'expiring_soon';
  return 'valid';
}

export function getDaysUntilExpiry(expiresAt?: string): number | null {
  if (!expiresAt) return null;

  const now = new Date();
  const expiry = new Date(expiresAt);
  return Math.ceil((expiry.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
}

const STORAGE_KEY = 'threads_accounts';
const CURRENT_ACCOUNT_KEY = 'threads_current_account';

export function useAccountManager() {
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [currentAccountId, setCurrentAccountId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Load accounts from localStorage and sync to database
  useEffect(() => {
    if (typeof window === 'undefined') return;

    const loadAndSync = async () => {
      const savedAccounts = localStorage.getItem(STORAGE_KEY);
      const savedCurrentId = localStorage.getItem(CURRENT_ACCOUNT_KEY);

      let localAccounts: Account[] = [];
      if (savedAccounts) {
        try {
          localAccounts = JSON.parse(savedAccounts);
          setAccounts(localAccounts);
        } catch {
          setAccounts([]);
        }
      }

      if (savedCurrentId) {
        setCurrentAccountId(savedCurrentId);
      }

      // localStorageのアカウントをデータベースに同期
      if (localAccounts.length > 0) {
        for (const account of localAccounts) {
          try {
            await fetch('/api/accounts', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                threadsUserId: account.id,
                username: account.username,
                name: account.name,
                profilePicture: account.profilePicture,
                accessToken: account.accessToken,
              }),
            });
          } catch (err) {
            console.log('Failed to sync account to database', err);
          }
        }
      }

      setIsLoading(false);
    };

    loadAndSync();
  }, []);

  // Save accounts to localStorage
  const saveAccounts = useCallback((newAccounts: Account[]) => {
    if (typeof window === 'undefined') return;
    localStorage.setItem(STORAGE_KEY, JSON.stringify(newAccounts));
    setAccounts(newAccounts);
  }, []);

  // アカウント追加オプション
  interface AddAccountOptions {
    appId?: string;
    appSecret?: string;
    tokenExpiresAt?: string;
  }

  // Add a new account
  const addAccount = useCallback(async (
    accessToken: string,
    options?: AddAccountOptions
  ): Promise<{ success: boolean; error?: string; account?: Account }> => {
    try {
      // Fetch profile with the token
      const res = await fetch(`/api/threads/status?token=${encodeURIComponent(accessToken)}`);
      if (!res.ok) {
        return { success: false, error: 'Invalid access token' };
      }

      const data = await res.json();
      if (!data.connected || !data.user) {
        return { success: false, error: 'Could not verify account' };
      }

      // 既存のアカウント情報を取得（App設定を保持するため）
      const existingAccount = accounts.find(a => a.id === data.user.id);

      const newAccount: Account = {
        id: data.user.id,
        username: data.user.username,
        name: data.user.name,
        profilePicture: data.user.threads_profile_picture_url,
        accessToken,
        addedAt: existingAccount?.addedAt || new Date().toISOString(),
        // App設定: 新しい値 > 既存値
        appId: options?.appId ?? existingAccount?.appId,
        appSecret: options?.appSecret ?? existingAccount?.appSecret,
        // トークン有効期限
        tokenExpiresAt: options?.tokenExpiresAt ?? existingAccount?.tokenExpiresAt,
      };

      // データベースにも保存
      try {
        await fetch('/api/accounts', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            threadsUserId: data.user.id,
            username: data.user.username,
            name: data.user.name,
            profilePicture: data.user.threads_profile_picture_url,
            accessToken,
          }),
        });
      } catch (dbErr) {
        console.log('Failed to save to database, continuing with localStorage', dbErr);
      }

      // Check if account already exists
      const existingIndex = accounts.findIndex(a => a.id === newAccount.id);
      let newAccounts: Account[];

      if (existingIndex >= 0) {
        // Update existing account
        newAccounts = [...accounts];
        newAccounts[existingIndex] = newAccount;
      } else {
        // Add new account
        newAccounts = [...accounts, newAccount];
      }

      saveAccounts(newAccounts);

      // Set as current if it's the first account
      if (!currentAccountId || newAccounts.length === 1) {
        switchAccount(newAccount.id);
      }

      return { success: true, account: newAccount };
    } catch (err) {
      return { success: false, error: 'Failed to add account' };
    }
  }, [accounts, currentAccountId, saveAccounts]);

  // Update an existing account (App設定やトークンの更新に使用)
  const updateAccount = useCallback((
    accountId: string,
    updates: Partial<Omit<Account, 'id' | 'addedAt'>>
  ) => {
    const existingIndex = accounts.findIndex(a => a.id === accountId);
    if (existingIndex < 0) return false;

    const updatedAccount: Account = {
      ...accounts[existingIndex],
      ...updates,
    };

    const newAccounts = [...accounts];
    newAccounts[existingIndex] = updatedAccount;
    saveAccounts(newAccounts);

    return true;
  }, [accounts, saveAccounts]);

  // Remove an account
  const removeAccount = useCallback((accountId: string) => {
    const newAccounts = accounts.filter(a => a.id !== accountId);
    saveAccounts(newAccounts);

    // If removing current account, switch to another one
    if (currentAccountId === accountId) {
      const newCurrentId = newAccounts[0]?.id || null;
      setCurrentAccountId(newCurrentId);
      if (newCurrentId) {
        localStorage.setItem(CURRENT_ACCOUNT_KEY, newCurrentId);
      } else {
        localStorage.removeItem(CURRENT_ACCOUNT_KEY);
      }
    }
  }, [accounts, currentAccountId, saveAccounts]);

  // Switch to a different account
  const switchAccount = useCallback((accountId: string) => {
    if (typeof window === 'undefined') return;
    setCurrentAccountId(accountId);
    localStorage.setItem(CURRENT_ACCOUNT_KEY, accountId);
  }, []);

  // Get current account
  const currentAccount = accounts.find(a => a.id === currentAccountId) || null;

  return {
    accounts,
    currentAccount,
    currentAccountId,
    isLoading,
    addAccount,
    updateAccount,
    removeAccount,
    switchAccount,
  };
}
