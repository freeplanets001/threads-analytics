import type { NextAuthConfig } from 'next-auth';
import Credentials from 'next-auth/providers/credentials';
import Google from 'next-auth/providers/google';
import bcrypt from 'bcryptjs';
import { prisma, isDatabaseAvailable } from '@/lib/db';
import { PrismaAdapter } from '@auth/prisma-adapter';

export const authConfig: NextAuthConfig = {
  debug: true,
  adapter: prisma ? PrismaAdapter(prisma) : undefined,
  providers: [
    // Google OAuth
    Google({
      clientId: process.env.GOOGLE_CLIENT_ID || '',
      clientSecret: process.env.GOOGLE_CLIENT_SECRET || '',
      allowDangerousEmailAccountLinking: true,
      authorization: {
        params: {
          prompt: 'consent',
          access_type: 'offline',
          response_type: 'code',
        },
      },
    }),
    // Email/Password認証（後方互換性のため残す）
    Credentials({
      name: 'credentials',
      credentials: {
        email: { label: 'Email', type: 'email' },
        password: { label: 'Password', type: 'password' },
      },
      async authorize(credentials) {
        // Check if database is available
        if (!isDatabaseAvailable() || !prisma) {
          console.warn('Database not available for authentication');
          return null;
        }

        if (!credentials?.email || !credentials?.password) {
          return null;
        }

        const user = await prisma.user.findUnique({
          where: { email: credentials.email as string },
        });

        if (!user || !user.password) {
          return null;
        }

        const isValid = await bcrypt.compare(
          credentials.password as string,
          user.password
        );

        if (!isValid) {
          return null;
        }

        return {
          id: user.id,
          email: user.email,
          name: user.name,
          image: user.image,
        };
      },
    }),
  ],
  pages: {
    signIn: '/login',
    newUser: '/register',
    error: '/login',
  },
  callbacks: {
    async signIn({ user, account }) {
      try {
        // Google認証の場合、初回ログイン時にSTANDARDロールを設定
        if (account?.provider === 'google' && prisma && user.email) {
          const existingUser = await prisma.user.findUnique({
            where: { email: user.email },
          });

          if (!existingUser) {
            // 新規ユーザーはSTANDARDロールで作成される（デフォルト）
            return true;
          }
        }
        return true;
      } catch (error) {
        console.error('[Auth] signIn callback error:', error);
        return true; // エラーでもログインは許可する
      }
    },
    async jwt({ token, user, account, trigger }) {
      if (user) {
        token.id = user.id;
      }

      // ユーザー情報の更新時（サブスク変更など）
      if (trigger === 'update' && prisma && token.id) {
        const dbUser = await prisma.user.findUnique({
          where: { id: token.id as string },
          select: { role: true, plan: true, planExpiresAt: true },
        });
        if (dbUser) {
          token.role = dbUser.role;
          token.plan = dbUser.plan;
          token.planExpiresAt = dbUser.planExpiresAt?.toISOString();
        }
      }

      // 初回サインイン時にロールとプランを取得
      if (account && prisma && token.id) {
        const dbUser = await prisma.user.findUnique({
          where: { id: token.id as string },
          select: { role: true, plan: true, planExpiresAt: true },
        });
        if (dbUser) {
          token.role = dbUser.role;
          token.plan = dbUser.plan;
          token.planExpiresAt = dbUser.planExpiresAt?.toISOString();
        }
      }

      return token;
    },
    async session({ session, token }) {
      if (session.user && token.id) {
        session.user.id = token.id as string;
        session.user.role = token.role as string;
        session.user.plan = token.plan as string;
        session.user.planExpiresAt = token.planExpiresAt as string | undefined;
      }
      return session;
    },
  },
  session: {
    strategy: 'jwt',
  },
  events: {
    async createUser({ user }) {
      // 新規ユーザー作成時のログ
      console.log('New user created:', user.email);
    },
  },
};
