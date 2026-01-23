import 'next-auth';
import { DefaultSession } from 'next-auth';

declare module 'next-auth' {
  interface Session {
    user: {
      id: string;
      name?: string | null;
      email?: string | null;
      image?: string | null;
      role?: string;
      plan?: string;
      planExpiresAt?: string;
    } & DefaultSession['user'];
  }

  interface User {
    id: string;
    role?: string;
    plan?: string;
    planExpiresAt?: string;
  }
}

declare module 'next-auth/jwt' {
  interface JWT {
    id?: string;
    role?: string;
    plan?: string;
    planExpiresAt?: string;
  }
}
