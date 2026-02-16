// ロール権限管理

export type Role = 'ADMIN' | 'PRO' | 'STANDARD';

export interface RolePermissions {
  // 予約投稿
  scheduledPosts: boolean;
  maxScheduledPosts: number; // -1 = 無制限

  // アカウント
  maxAccounts: number; // -1 = 無制限

  // 下書き
  drafts: boolean;
  maxDrafts: number; // -1 = 無制限

  // テンプレート
  templates: boolean;
  maxTemplates: number;

  // AI機能
  aiGeneration: boolean;
  aiBulkGeneration: boolean;
  maxAiGenerationsPerDay: number;

  // 分析機能
  advancedAnalytics: boolean;
  weeklyReports: boolean;
  monthlyReports: boolean;
  exportData: boolean;

  // 自動化
  recurringPosts: boolean;
  autoReply: boolean;
  autoHashtags: boolean;

  // その他
  darkMode: boolean;
  notifications: boolean;
  emailNotifications: boolean;

  // 管理機能
  adminPanel: boolean;
  userManagement: boolean;
  roleManagement: boolean;
  systemSettings: boolean;
}

// デフォルトのロール権限
export const DEFAULT_PERMISSIONS: Record<Role, RolePermissions> = {
  ADMIN: {
    scheduledPosts: true,
    maxScheduledPosts: -1,
    maxAccounts: -1,
    drafts: true,
    maxDrafts: -1,
    templates: true,
    maxTemplates: -1,
    aiGeneration: true,
    aiBulkGeneration: true,
    maxAiGenerationsPerDay: -1,
    advancedAnalytics: true,
    weeklyReports: true,
    monthlyReports: true,
    exportData: true,
    recurringPosts: true,
    autoReply: true,
    autoHashtags: true,
    darkMode: true,
    notifications: true,
    emailNotifications: true,
    adminPanel: true,
    userManagement: true,
    roleManagement: true,
    systemSettings: true,
  },
  PRO: {
    scheduledPosts: true,
    maxScheduledPosts: 50,
    maxAccounts: 5,
    drafts: true,
    maxDrafts: -1,
    templates: true,
    maxTemplates: 20,
    aiGeneration: true,
    aiBulkGeneration: true,
    maxAiGenerationsPerDay: 100,
    advancedAnalytics: true,
    weeklyReports: true,
    monthlyReports: true,
    exportData: true,
    recurringPosts: true,
    autoReply: true,
    autoHashtags: true,
    darkMode: true,
    notifications: true,
    emailNotifications: true,
    adminPanel: false,
    userManagement: false,
    roleManagement: false,
    systemSettings: false,
  },
  STANDARD: {
    scheduledPosts: false,
    maxScheduledPosts: 0,
    maxAccounts: 1,
    drafts: true,
    maxDrafts: 5,
    templates: false,
    maxTemplates: 0,
    aiGeneration: true,
    aiBulkGeneration: false,
    maxAiGenerationsPerDay: 10,
    advancedAnalytics: false,
    weeklyReports: false,
    monthlyReports: false,
    exportData: false,
    recurringPosts: false,
    autoReply: false,
    autoHashtags: false,
    darkMode: true,
    notifications: true,
    emailNotifications: false,
    adminPanel: false,
    userManagement: false,
    roleManagement: false,
    systemSettings: false,
  },
};

// ロール権限を取得
export function getPermissions(role: Role, customPermissions?: Partial<RolePermissions>): RolePermissions {
  const basePermissions = DEFAULT_PERMISSIONS[role] || DEFAULT_PERMISSIONS.STANDARD;

  if (customPermissions) {
    return { ...basePermissions, ...customPermissions };
  }

  return basePermissions;
}

// 特定の機能が利用可能かチェック
export function hasPermission(
  role: Role,
  permission: keyof RolePermissions,
  customPermissions?: Partial<RolePermissions>
): boolean {
  const permissions = getPermissions(role, customPermissions);
  const value = permissions[permission];

  if (typeof value === 'boolean') {
    return value;
  }

  // 数値の場合は0より大きいか-1（無制限）かをチェック
  if (typeof value === 'number') {
    return value !== 0;
  }

  return false;
}

// 制限値を取得
export function getLimit(
  role: Role,
  permission: keyof RolePermissions,
  customPermissions?: Partial<RolePermissions>
): number {
  const permissions = getPermissions(role, customPermissions);
  const value = permissions[permission];

  if (typeof value === 'number') {
    return value;
  }

  return 0;
}

// ロール名を日本語で取得
export function getRoleName(role: Role): string {
  const names: Record<Role, string> = {
    ADMIN: '管理者',
    PRO: 'Pro',
    STANDARD: 'Standard',
  };
  return names[role] || role;
}

// ロールの説明を取得
export function getRoleDescription(role: Role): string {
  const descriptions: Record<Role, string> = {
    ADMIN: '全ての機能にアクセスできる管理者権限',
    PRO: '予約投稿、AI一括生成、詳細分析など全ての主要機能が利用可能',
    STANDARD: '基本的な投稿機能と分析機能が利用可能',
  };
  return descriptions[role] || '';
}
