import { NextRequest, NextResponse } from 'next/server';
import { Role, DEFAULT_PERMISSIONS, RolePermissions } from '@/lib/permissions';

// カスタム権限を保存（本番ではDBに保存）
let customPermissions: Partial<Record<Role, RolePermissions>> = {};

export async function GET() {
  try {
    // デフォルト権限とカスタム権限をマージして返す
    const permissions: Record<Role, RolePermissions> = {
      ADMIN: { ...DEFAULT_PERMISSIONS.ADMIN, ...customPermissions.ADMIN },
      PRO: { ...DEFAULT_PERMISSIONS.PRO, ...customPermissions.PRO },
      STANDARD: { ...DEFAULT_PERMISSIONS.STANDARD, ...customPermissions.STANDARD },
    };

    return NextResponse.json(permissions);
  } catch (error) {
    console.error('Roles fetch error:', error);
    return NextResponse.json({ error: 'Failed to fetch roles' }, { status: 500 });
  }
}

export async function PUT(request: NextRequest) {
  try {
    const { role, permissions } = await request.json();

    if (!role || !permissions) {
      return NextResponse.json({ error: 'Missing role or permissions' }, { status: 400 });
    }

    // カスタム権限を保存（本番ではDBに保存）
    customPermissions[role as Role] = permissions;

    console.log(`Updated permissions for ${role}:`, permissions);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Role update error:', error);
    return NextResponse.json({ error: 'Failed to update role' }, { status: 500 });
  }
}
