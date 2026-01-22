'use client';

import { useState, useEffect, useCallback } from 'react';

interface ThreadsUser {
  id: string;
  username: string;
  name?: string;
  profilePicture?: string;
}

interface AuthStatus {
  connected: boolean;
  user: ThreadsUser | null;
  error?: string;
}

export function useThreadsAuth() {
  const [status, setStatus] = useState<AuthStatus>({
    connected: false,
    user: null,
  });
  const [loading, setLoading] = useState(true);

  const checkStatus = useCallback(async () => {
    try {
      const response = await fetch('/api/threads/status');
      const data = await response.json();
      setStatus(data);
    } catch {
      setStatus({ connected: false, user: null, error: 'Failed to check status' });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    checkStatus();
  }, [checkStatus]);

  const connect = useCallback(() => {
    window.location.href = '/api/auth/threads';
  }, []);

  const disconnect = useCallback(async () => {
    try {
      await fetch('/api/threads/status', { method: 'DELETE' });
      setStatus({ connected: false, user: null });
    } catch {
      console.error('Failed to disconnect');
    }
  }, []);

  return {
    ...status,
    loading,
    connect,
    disconnect,
    refresh: checkStatus,
  };
}
