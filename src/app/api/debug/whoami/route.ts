import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma, isDatabaseAvailable } from '@/lib/db';

// 一時診断用: セッションとDBのrole不整合を切り分けるためのエンドポイント
// 自分自身の情報のみ返す（他者の情報は返さない）
export async function GET() {
  const session = await auth();

  if (!session?.user) {
    return NextResponse.json({ session: null, note: 'Not signed in' }, { status: 401 });
  }

  const sessionInfo = {
    id: session.user.id,
    email: session.user.email,
    role: (session.user as { role?: string }).role,
    plan: (session.user as { plan?: string }).plan,
  };

  let dbBySessionId = null;
  let dbByEmail = null;

  if (isDatabaseAvailable() && prisma) {
    if (session.user.id) {
      dbBySessionId = await prisma.user.findUnique({
        where: { id: session.user.id },
        select: { id: true, email: true, role: true, plan: true },
      });
    }
    if (session.user.email) {
      dbByEmail = await prisma.user.findUnique({
        where: { email: session.user.email },
        select: { id: true, email: true, role: true, plan: true },
      });
    }
  }

  return NextResponse.json({
    session: sessionInfo,
    dbBySessionId,
    dbByEmail,
    sessionIdMatchesDbId: dbByEmail ? session.user.id === dbByEmail.id : null,
    diagnosis: !sessionInfo.role
      ? 'JWT に role が入っていない → jwt callback の DB lookup が走っていない可能性'
      : sessionInfo.role !== dbByEmail?.role
        ? 'JWT の role が DB と不一致 → 古い JWT がキャッシュされている可能性。再ログイン必要'
        : 'JWT と DB は一致している → UI 側のキャッシュ/状態問題',
  });
}
