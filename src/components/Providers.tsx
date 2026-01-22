'use client';

import { ReactNode } from 'react';

export function Providers({ children }: { children: ReactNode }) {
  // SessionProvider will be added when authentication is fully implemented
  return <>{children}</>;
}
