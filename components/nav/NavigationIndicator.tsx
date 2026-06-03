"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";

type NavigationContextValue = {
  startNavigation: () => void;
};

const NavigationContext = createContext<NavigationContextValue | null>(null);

function isCurrentPath(pathname: string, href: string): boolean {
  const norm = (p: string) => {
    const base = p.split("?")[0].split("#")[0];
    return base.length > 1 && base.endsWith("/")
      ? base.slice(0, -1)
      : base || "/";
  };
  return norm(pathname) === norm(href);
}

export function NavigationProvider({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const [isNavigating, setIsNavigating] = useState(false);

  useEffect(() => {
    setIsNavigating(false);
  }, [pathname]);

  const startNavigation = useCallback(() => {
    setIsNavigating(true);
  }, []);

  return (
    <NavigationContext.Provider value={{ startNavigation }}>
      {isNavigating && (
        <div
          className="fixed inset-x-0 top-0 z-100 h-1 overflow-hidden bg-[#2555F3]/20"
          role="progressbar"
          aria-label="Loading page"
        >
          <div className="h-full w-1/3 animate-pulse bg-[#2555F3]" />
        </div>
      )}
      {children}
    </NavigationContext.Provider>
  );
}

export function NavLink({
  href,
  className,
  children,
  onClick,
}: {
  href: string;
  className?: string;
  children: ReactNode;
  onClick?: () => void;
}) {
  const pathname = usePathname();
  const ctx = useContext(NavigationContext);

  return (
    <Link
      href={href}
      className={className}
      onClick={() => {
        if (!isCurrentPath(pathname, href)) {
          ctx?.startNavigation();
        }
        onClick?.();
      }}
    >
      {children}
    </Link>
  );
}
