'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { Role, DEFAULT_PERMISSIONS, getRoleName, getRoleDescription, RolePermissions } from '@/lib/permissions';

type AdminTab = 'dashboard' | 'users' | 'roles' | 'settings' | 'logs';

interface User {
  id: string;
  email: string;
  name: string | null;
  role: Role;
  createdAt: string;
  threadsAccountsCount: number;
  scheduledPostsCount: number;
}

interface SystemStats {
  totalUsers: number;
  totalAccounts: number;
  totalScheduledPosts: number;
  totalDrafts: number;
  usersByRole: { role: string; count: number }[];
}

export default function AdminPanel() {
  const [activeTab, setActiveTab] = useState<AdminTab>('dashboard');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [currentUserRole, setCurrentUserRole] = useState<Role | null>(null);

  // Dashboard data
  const [stats, setStats] = useState<SystemStats | null>(null);

  // Users data
  const [users, setUsers] = useState<User[]>([]);
  const [usersPage, setUsersPage] = useState(1);
  const [userSearch, setUserSearch] = useState('');
  const [userRoleFilter, setUserRoleFilter] = useState<Role | 'all'>('all');

  // Roles data
  const [rolePermissions, setRolePermissions] = useState<Record<Role, RolePermissions>>(DEFAULT_PERMISSIONS);
  const [editingRole, setEditingRole] = useState<Role | null>(null);

  // Check admin access
  useEffect(() => {
    checkAdminAccess();
  }, []);

  const checkAdminAccess = async () => {
    try {
      const res = await fetch('/api/admin/check');
      const data = await res.json();

      if (!res.ok || !data.isAdmin) {
        setError('管理者権限がありません');
        setLoading(false);
        return;
      }

      setCurrentUserRole(data.role);
      fetchDashboardData();
    } catch {
      setError('認証エラーが発生しました');
      setLoading(false);
    }
  };

  const fetchDashboardData = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/admin/stats');
      const data = await res.json();

      if (res.ok) {
        setStats(data);
      }
    } catch {
      console.error('Failed to fetch stats');
    } finally {
      setLoading(false);
    }
  };

  const fetchUsers = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        page: usersPage.toString(),
        search: userSearch,
        role: userRoleFilter,
      });

      const res = await fetch(`/api/admin/users?${params}`);
      const data = await res.json();

      if (res.ok) {
        setUsers(data.users);
      }
    } catch {
      console.error('Failed to fetch users');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (activeTab === 'users' && currentUserRole) {
      fetchUsers();
    }
  }, [activeTab, usersPage, userSearch, userRoleFilter, currentUserRole]);

  const updateUserRole = async (userId: string, newRole: Role) => {
    try {
      const res = await fetch('/api/admin/users', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, role: newRole }),
      });

      if (res.ok) {
        fetchUsers();
      } else {
        const data = await res.json();
        alert(data.error || 'ロールの更新に失敗しました');
      }
    } catch {
      alert('エラーが発生しました');
    }
  };

  const saveRolePermissions = async (role: Role, permissions: RolePermissions) => {
    try {
      const res = await fetch('/api/admin/roles', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ role, permissions }),
      });

      if (res.ok) {
        setRolePermissions(prev => ({ ...prev, [role]: permissions }));
        setEditingRole(null);
        alert('権限設定を保存しました');
      } else {
        const data = await res.json();
        alert(data.error || '保存に失敗しました');
      }
    } catch {
      alert('エラーが発生しました');
    }
  };

  if (error) {
    return (
      <div className="min-h-screen bg-slate-100 flex items-center justify-center">
        <div className="bg-white rounded-xl shadow-lg p-8 max-w-md text-center">
          <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
          </div>
          <h2 className="text-xl font-bold text-slate-900 mb-2">アクセス拒否</h2>
          <p className="text-slate-600 mb-4">{error}</p>
          <Link href="/" className="text-indigo-600 hover:underline">
            ホームに戻る
          </Link>
        </div>
      </div>
    );
  }

  const tabs: { id: AdminTab; label: string; icon: string }[] = [
    { id: 'dashboard', label: 'ダッシュボード', icon: 'M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6' },
    { id: 'users', label: 'ユーザー管理', icon: 'M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z' },
    { id: 'roles', label: 'ロール設定', icon: 'M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z' },
    { id: 'settings', label: 'システム設定', icon: 'M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z M15 12a3 3 0 11-6 0 3 3 0 016 0z' },
    { id: 'logs', label: '操作ログ', icon: 'M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01' },
  ];

  return (
    <div className="min-h-screen bg-slate-100">
      {/* Header */}
      <header className="bg-white border-b border-slate-200 sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Link href="/" className="text-slate-500 hover:text-slate-700">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
                </svg>
              </Link>
              <div>
                <h1 className="text-xl font-bold text-slate-900">管理パネル</h1>
                <p className="text-sm text-slate-500">Threads Studio Admin</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <span className="px-3 py-1 bg-indigo-100 text-indigo-700 rounded-full text-sm font-medium">
                {currentUserRole && getRoleName(currentUserRole)}
              </span>
            </div>
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-4 py-6">
        <div className="flex gap-6">
          {/* Sidebar */}
          <aside className="w-64 flex-shrink-0">
            <nav className="bg-white rounded-xl border border-slate-200 overflow-hidden">
              {tabs.map(tab => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`w-full flex items-center gap-3 px-4 py-3 text-left transition-colors ${
                    activeTab === tab.id
                      ? 'bg-indigo-50 text-indigo-700 border-l-4 border-indigo-600'
                      : 'text-slate-600 hover:bg-slate-50'
                  }`}
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={tab.icon} />
                  </svg>
                  <span className="font-medium">{tab.label}</span>
                </button>
              ))}
            </nav>
          </aside>

          {/* Main Content */}
          <main className="flex-1">
            {loading ? (
              <div className="bg-white rounded-xl border border-slate-200 p-8 text-center">
                <div className="w-8 h-8 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin mx-auto" />
                <p className="text-slate-500 mt-2">読み込み中...</p>
              </div>
            ) : (
              <>
                {/* Dashboard Tab */}
                {activeTab === 'dashboard' && stats && (
                  <div className="space-y-6">
                    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                      {[
                        { label: '総ユーザー数', value: stats.totalUsers, color: 'bg-blue-500' },
                        { label: '接続アカウント', value: stats.totalAccounts, color: 'bg-green-500' },
                        { label: '予約投稿', value: stats.totalScheduledPosts, color: 'bg-purple-500' },
                        { label: '下書き', value: stats.totalDrafts, color: 'bg-orange-500' },
                      ].map(stat => (
                        <div key={stat.label} className="bg-white rounded-xl border border-slate-200 p-5">
                          <div className={`w-10 h-10 ${stat.color} rounded-lg flex items-center justify-center mb-3`}>
                            <span className="text-white text-lg font-bold">{stat.value}</span>
                          </div>
                          <p className="text-slate-600">{stat.label}</p>
                        </div>
                      ))}
                    </div>

                    <div className="bg-white rounded-xl border border-slate-200 p-5">
                      <h3 className="font-semibold text-slate-900 mb-4">ロール別ユーザー分布</h3>
                      <div className="space-y-3">
                        {stats.usersByRole.map(item => (
                          <div key={item.role} className="flex items-center gap-4">
                            <span className="w-24 text-sm text-slate-600">{getRoleName(item.role as Role)}</span>
                            <div className="flex-1 bg-slate-100 rounded-full h-4 overflow-hidden">
                              <div
                                className="h-full bg-indigo-500 rounded-full"
                                style={{ width: `${(item.count / stats.totalUsers) * 100}%` }}
                              />
                            </div>
                            <span className="text-sm font-medium text-slate-900">{item.count}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                )}

                {/* Users Tab */}
                {activeTab === 'users' && (
                  <div className="space-y-4">
                    <div className="bg-white rounded-xl border border-slate-200 p-4">
                      <div className="flex flex-wrap gap-4">
                        <input
                          type="text"
                          value={userSearch}
                          onChange={(e) => setUserSearch(e.target.value)}
                          placeholder="ユーザーを検索..."
                          className="flex-1 min-w-[200px] px-4 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                        />
                        <select
                          value={userRoleFilter}
                          onChange={(e) => setUserRoleFilter(e.target.value as Role | 'all')}
                          className="px-4 py-2 border border-slate-200 rounded-lg"
                        >
                          <option value="all">全ロール</option>
                          <option value="ADMIN">Admin</option>
                          <option value="PRO">Pro</option>
                          <option value="STANDARD">Standard</option>
                        </select>
                      </div>
                    </div>

                    <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
                      <table className="w-full">
                        <thead className="bg-slate-50 border-b border-slate-200">
                          <tr>
                            <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase">ユーザー</th>
                            <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase">ロール</th>
                            <th className="px-4 py-3 text-center text-xs font-medium text-slate-500 uppercase">アカウント数</th>
                            <th className="px-4 py-3 text-center text-xs font-medium text-slate-500 uppercase">予約投稿</th>
                            <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase">登録日</th>
                            <th className="px-4 py-3 text-right text-xs font-medium text-slate-500 uppercase">操作</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-200">
                          {users.map(user => (
                            <tr key={user.id} className="hover:bg-slate-50">
                              <td className="px-4 py-3">
                                <div>
                                  <p className="font-medium text-slate-900">{user.name || '名前未設定'}</p>
                                  <p className="text-sm text-slate-500">{user.email}</p>
                                </div>
                              </td>
                              <td className="px-4 py-3">
                                <select
                                  value={user.role}
                                  onChange={(e) => updateUserRole(user.id, e.target.value as Role)}
                                  className={`px-2 py-1 rounded text-sm font-medium ${
                                    user.role === 'ADMIN' ? 'bg-red-100 text-red-700' :
                                    user.role === 'PRO' ? 'bg-blue-100 text-blue-700' :
                                    'bg-slate-100 text-slate-700'
                                  }`}
                                >
                                  <option value="ADMIN">Admin</option>
                                  <option value="PRO">Pro</option>
                                  <option value="STANDARD">Standard</option>
                                </select>
                              </td>
                              <td className="px-4 py-3 text-center text-slate-600">
                                {user.threadsAccountsCount}
                              </td>
                              <td className="px-4 py-3 text-center text-slate-600">
                                {user.scheduledPostsCount}
                              </td>
                              <td className="px-4 py-3 text-sm text-slate-500">
                                {new Date(user.createdAt).toLocaleDateString('ja-JP')}
                              </td>
                              <td className="px-4 py-3 text-right">
                                <button className="text-slate-400 hover:text-slate-600">
                                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 5v.01M12 12v.01M12 19v.01M12 6a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2z" />
                                  </svg>
                                </button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}

                {/* Roles Tab */}
                {activeTab === 'roles' && (
                  <div className="space-y-6">
                    {(['ADMIN', 'PRO', 'STANDARD'] as Role[]).map(role => (
                      <div key={role} className="bg-white rounded-xl border border-slate-200 overflow-hidden">
                        <div className="px-5 py-4 border-b border-slate-200 flex items-center justify-between">
                          <div>
                            <h3 className="font-semibold text-slate-900">{getRoleName(role)}</h3>
                            <p className="text-sm text-slate-500">{getRoleDescription(role)}</p>
                          </div>
                          <button
                            onClick={() => setEditingRole(editingRole === role ? null : role)}
                            className="px-4 py-2 text-sm bg-indigo-50 text-indigo-600 rounded-lg hover:bg-indigo-100"
                          >
                            {editingRole === role ? '閉じる' : '編集'}
                          </button>
                        </div>

                        {editingRole === role && (
                          <div className="p-5">
                            <RolePermissionEditor
                              permissions={rolePermissions[role]}
                              onSave={(perms) => saveRolePermissions(role, perms)}
                            />
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}

                {/* Settings Tab */}
                {activeTab === 'settings' && (
                  <div className="bg-white rounded-xl border border-slate-200 p-5">
                    <h3 className="font-semibold text-slate-900 mb-4">システム設定</h3>
                    <p className="text-slate-500">システム設定の機能は開発中です。</p>
                  </div>
                )}

                {/* Logs Tab */}
                {activeTab === 'logs' && (
                  <div className="bg-white rounded-xl border border-slate-200 p-5">
                    <h3 className="font-semibold text-slate-900 mb-4">操作ログ</h3>
                    <p className="text-slate-500">操作ログの機能は開発中です。</p>
                  </div>
                )}
              </>
            )}
          </main>
        </div>
      </div>
    </div>
  );
}

// ロール権限エディター
function RolePermissionEditor({
  permissions,
  onSave,
}: {
  permissions: RolePermissions;
  onSave: (permissions: RolePermissions) => void;
}) {
  const [edited, setEdited] = useState(permissions);

  const permissionGroups = [
    {
      name: '投稿機能',
      items: [
        { key: 'scheduledPosts', label: '予約投稿', type: 'boolean' },
        { key: 'maxScheduledPosts', label: '最大予約投稿数', type: 'number', unit: '件' },
        { key: 'recurringPosts', label: '繰り返し投稿', type: 'boolean' },
      ],
    },
    {
      name: 'アカウント・下書き',
      items: [
        { key: 'maxAccounts', label: '最大アカウント数', type: 'number', unit: '件' },
        { key: 'maxDrafts', label: '最大下書き数', type: 'number', unit: '件' },
        { key: 'templates', label: 'テンプレート機能', type: 'boolean' },
        { key: 'maxTemplates', label: '最大テンプレート数', type: 'number', unit: '件' },
      ],
    },
    {
      name: 'AI機能',
      items: [
        { key: 'aiGeneration', label: 'AI生成', type: 'boolean' },
        { key: 'aiBulkGeneration', label: 'AI一括生成', type: 'boolean' },
        { key: 'maxAiGenerationsPerDay', label: '1日あたりのAI生成上限', type: 'number', unit: '回' },
        { key: 'autoHashtags', label: 'ハッシュタグ自動提案', type: 'boolean' },
      ],
    },
    {
      name: '分析・レポート',
      items: [
        { key: 'advancedAnalytics', label: '詳細分析', type: 'boolean' },
        { key: 'weeklyReports', label: '週次レポート', type: 'boolean' },
        { key: 'monthlyReports', label: '月次レポート', type: 'boolean' },
        { key: 'exportData', label: 'データエクスポート', type: 'boolean' },
      ],
    },
    {
      name: 'その他',
      items: [
        { key: 'darkMode', label: 'ダークモード', type: 'boolean' },
        { key: 'notifications', label: '通知機能', type: 'boolean' },
        { key: 'emailNotifications', label: 'メール通知', type: 'boolean' },
      ],
    },
    {
      name: '管理機能',
      items: [
        { key: 'adminPanel', label: '管理パネルアクセス', type: 'boolean' },
        { key: 'userManagement', label: 'ユーザー管理', type: 'boolean' },
        { key: 'roleManagement', label: 'ロール管理', type: 'boolean' },
        { key: 'systemSettings', label: 'システム設定', type: 'boolean' },
      ],
    },
  ];

  return (
    <div className="space-y-6">
      {permissionGroups.map(group => (
        <div key={group.name}>
          <h4 className="font-medium text-slate-700 mb-3">{group.name}</h4>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {group.items.map(item => (
              <div key={item.key} className="flex items-center justify-between p-3 bg-slate-50 rounded-lg">
                <span className="text-sm text-slate-600">{item.label}</span>
                {item.type === 'boolean' ? (
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      checked={edited[item.key as keyof RolePermissions] as boolean}
                      onChange={(e) => setEdited({ ...edited, [item.key]: e.target.checked })}
                      className="sr-only peer"
                    />
                    <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-indigo-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-indigo-600"></div>
                  </label>
                ) : (
                  <div className="flex items-center gap-2">
                    <input
                      type="number"
                      value={edited[item.key as keyof RolePermissions] as number}
                      onChange={(e) => setEdited({ ...edited, [item.key]: parseInt(e.target.value) || 0 })}
                      className="w-20 px-2 py-1 border border-slate-200 rounded text-sm text-right"
                      min={-1}
                    />
                    <span className="text-xs text-slate-500">{item.unit}</span>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      ))}

      <div className="pt-4 border-t border-slate-200">
        <p className="text-xs text-slate-500 mb-3">※ 数値に -1 を設定すると無制限になります</p>
        <button
          onClick={() => onSave(edited)}
          className="px-6 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 font-medium"
        >
          保存
        </button>
      </div>
    </div>
  );
}
