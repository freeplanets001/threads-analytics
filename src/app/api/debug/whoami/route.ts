import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma, isDatabaseAvailable } from '@/lib/db';

export const dynamic = 'force-dynamic';

// 一時診断用: セッションとDBのrole不整合を切り分けるためのエンドポイント
export async function GET() {
  const result: Record<string, unknown> = {
    step: 'start',
  };

  try {
    result.step = 'before-auth';
    const session = await auth();
    result.step = 'after-auth';

    if (!session) {
      result.session = null;
      result.note = 'auth() returned null';
      return NextResponse.json(result);
    }

    if (!session.user) {
      result.session = { exists: true, user: null };
      result.note = 'session.user is null';
      return NextResponse.json(result);
    }

    const u = session.user as {
      id?: string;
      email?: string | null;
      role?: string;
      plan?: string;
    };

    result.session = {
      id: u.id ?? null,
      email: u.email ?? null,
      role: u.role ?? null,
      plan: u.plan ?? null,
    };

    result.step = 'before-db';
    if (!isDatabaseAvailable() || !prisma) {
      result.note = 'DB not available';
      return NextResponse.json(result);
    }

    result.step = 'db-query-by-email';
    if (u.email) {
      const dbByEmail = await prisma.user.findUnique({
        where: { email: u.email },
        select: { id: true, email: true, role: true, plan: true },
      });
      result.dbByEmail = dbByEmail;
    }

    result.step = 'done';
    return NextResponse.json(result);
  } catch (err) {
    result.error = {
      message: err instanceof Error ? err.message : String(err),
      stack: err instanceof Error ? err.stack?.split('\n').slice(0, 5) : undefined,
    };
    return NextResponse.json(result, { status: 500 });
  }
}
