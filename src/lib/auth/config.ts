import type { NextAuthConfig } from 'next-auth';
import Credentials from 'next-auth/providers/credentials';
import Google from 'next-auth/providers/google';
import bcrypt from 'bcryptjs';
import { prisma, isDatabaseAvailable } from '@/lib/db';

export const authConfig: NextAuthConfig = {
  // PrismaAdapterは使用せず、コールバックで手動管理
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
    // Email/Password認証
    Credentials({
      name: 'credentials',
      credentials: {
        email: { label: 'Email', type: 'email' },
        password: { label: 'Password', type: 'password' },
      },
      async authorize(credentials) {
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
    async signIn({ user, account, profile }) {
      // Google OAuth の場合、DBにユーザーを作成/更新
      if (account?.provider === 'google' && prisma && user.email) {
        try {
          const existingUser = await prisma.user.findUnique({
            where: { email: user.email },
            include: { accounts: true },
          });

          if (!existingUser) {
            // 新規ユーザー作成 + アカウントリンク
            const newUser = await prisma.user.create({
              data: {
                email: user.email,
                name: user.name || profile?.name || null,
                image: user.image || null,
                emailVerified: new Date(),
                role: 'STANDARD',
                plan: 'free',
                accounts: {
                  create: {
                    type: account.type,
                    provider: account.provider,
                    providerAccountId: account.providerAccountId,
                    access_token: account.access_token,
                    refresh_token: account.refresh_token,
                    expires_at: account.expires_at,
                    token_type: account.token_type,
                    scope: account.scope,
                    id_token: account.id_token,
                    session_state: account.session_state as string | null,
                  },
                },
              },
            });
            // user.id を DB の ID に差し替え（JWT に反映させるため）
            user.id = newUser.id;
            console.log('New Google user created:', user.email);
          } else {
            // 既存ユーザーの場合、user.id を DB の ID に差し替え
            user.id = existingUser.id;

            // Google アカウントがまだリンクされていなければリンク
            const hasGoogleAccount = existingUser.accounts.some(
              (a) => a.provider === 'google'
            );
            if (!hasGoogleAccount) {
              await prisma.account.create({
                data: {
                  userId: existingUser.id,
                  type: account.type,
                  provider: account.provider,
                  providerAccountId: account.providerAccountId,
                  access_token: account.access_token,
                  refresh_token: account.refresh_token,
                  expires_at: account.expires_at,
                  token_type: account.token_type,
                  scope: account.scope,
                  id_token: account.id_token,
                  session_state: account.session_state as string | null,
                },
              });
              console.log('Google account linked for:', user.email);
            } else {
              // トークン更新
              await prisma.account.updateMany({
                where: {
                  userId: existingUser.id,
                  provider: 'google',
                },
                data: {
                  access_token: account.access_token,
                  refresh_token: account.refresh_token,
                  expires_at: account.expires_at,
                  id_token: account.id_token,
                },
              });
            }

            // プロフィール画像の更新
            if (user.image && user.image !== existingUser.image) {
              await prisma.user.update({
                where: { id: existingUser.id },
                data: { image: user.image },
              });
            }
          }
        } catch (error) {
          console.error('[Auth] signIn callback error:', error);
          // エラーでもログインは許可するが、DB操作は失敗している可能性
          return true;
        }
      }
      return true;
    },
    async jwt({ token, user, account, trigger }) {
      if (user) {
        token.id = user.id;
      }

      // ユーザー情報の更新時（サブスク変更など）
      if (trigger === 'update' && prisma && token.id) {
        try {
          const dbUser = await prisma.user.findUnique({
            where: { id: token.id as string },
            select: { role: true, plan: true, planExpiresAt: true },
          });
          if (dbUser) {
            token.role = dbUser.role;
            token.plan = dbUser.plan;
            token.planExpiresAt = dbUser.planExpiresAt?.toISOString();
          }
        } catch (error) {
          console.error('[Auth] jwt update error:', error);
        }
      }

      // 初回サインイン時にロールとプランを取得
      if (account && prisma && token.id) {
        try {
          const dbUser = await prisma.user.findUnique({
            where: { id: token.id as string },
            select: { role: true, plan: true, planExpiresAt: true },
          });
          if (dbUser) {
            token.role = dbUser.role;
            token.plan = dbUser.plan;
            token.planExpiresAt = dbUser.planExpiresAt?.toISOString();
          }
        } catch (error) {
          console.error('[Auth] jwt initial error:', error);
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
};
