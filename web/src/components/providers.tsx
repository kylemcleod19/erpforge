"use client";

import type { ReactNode } from "react";

/**
 * Client-side providers wrapper.
 * Add any global client context (toast, theme, etc.) here.
 */
export function Providers({ children }: { children: ReactNode }) {
  return <>{children}</>;
}
